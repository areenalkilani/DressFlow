-- All security-definer entry points derive the tenant from the authenticated principal.
create function public.require_tenant() returns uuid language plpgsql stable security definer set search_path=public as $$
declare t uuid; begin t:=my_tenant(); if t is null then raise exception 'UNAUTHORIZED'; end if; return t; end $$;

create function public.quote_booking(p_items jsonb,p_event date) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare t uuid:=require_tenant(); original numeric:=0; base numeric:=0; discount numeric:=0; best numeric:=0;
 o record; eligible numeric; cnt integer; target_count integer; matched_count integer; snapshot jsonb:='[]';
 best_id uuid; best_name text:=''; best_eligible numeric:=0; item_quotes jsonb;
begin
 if jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>50 then raise exception 'INVALID_ITEMS'; end if;
 if (select count(distinct x->>'dress_id') from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items) then raise exception 'DUPLICATE_ITEM'; end if;
 if (select count(*) from jsonb_array_elements(p_items) x join dresses d on d.id=(x->>'dress_id')::uuid and d.tenant_id=t)<>jsonb_array_length(p_items) then raise exception 'INVALID_ITEM'; end if;
 select sum(d.default_price),sum(coalesce(nullif(x->>'price','')::numeric,d.default_price)) into original,base
 from jsonb_array_elements(p_items) x join dresses d on d.id=(x->>'dress_id')::uuid and d.tenant_id=t;
 if exists(select 1 from jsonb_array_elements(p_items) x where (x->>'price')::numeric<0) then raise exception 'INVALID_PRICE'; end if;
 -- Best single qualifying offer; no stacking. Bundle with explicit dress targets requires every target.
 for o in select * from offers where tenant_id=t and active and p_event between starts_on and ends_on loop
 select count(*) into target_count from offer_targets where offer_id=o.id;
 select count(*),coalesce(sum(coalesce(nullif(x->>'price','')::numeric,d.default_price)),0) into cnt,eligible
 from jsonb_array_elements(p_items) x join dresses d on d.id=(x->>'dress_id')::uuid and d.tenant_id=t
 where target_count=0 or exists(select 1 from offer_targets ot where ot.offer_id=o.id and (ot.dress_id=d.id or ot.category_id=d.category_id));
 select count(*) into matched_count from offer_targets ot where ot.offer_id=o.id and ot.dress_id is not null
 and not exists(select 1 from jsonb_array_elements(p_items) x where (x->>'dress_id')::uuid=ot.dress_id);
 if cnt>=o.min_items and (o.kind<>'bundle' or matched_count=0) then
 discount:=case o.kind when 'percentage' then round(eligible*o.value/100,2) when 'fixed' then least(eligible,o.value) when 'bundle' then greatest(0,eligible-o.value) end;
 if discount>best then best:=discount; best_id:=o.id; best_name:=o.name; best_eligible:=eligible; snapshot:=jsonb_build_array(jsonb_build_object('id',o.id,'name',o.name,'kind',o.kind,'value',o.value,'discount',discount)); end if;
 end if;
 end loop;
 with lines as (
 select d.id,coalesce(nullif(x->>'price','')::numeric,d.default_price) as price,
 best_id is not null and (not exists(select 1 from offer_targets where offer_id=best_id) or exists(select 1 from offer_targets where offer_id=best_id and (dress_id=d.id or category_id=d.category_id))) as qualifies
 from jsonb_array_elements(p_items) x join dresses d on d.id=(x->>'dress_id')::uuid and d.tenant_id=t
 ), allocations as (
 select *,case when qualifies and best_eligible>0 then floor(price*best/best_eligible*100)/100 else 0 end as allocated_discount from lines
 ), final as (
 select *,case when id=(select id from allocations where qualifies and price>0 order by price desc,id limit 1) then best-(select sum(allocated_discount) from allocations) else 0 end as remainder from allocations
 ) select jsonb_agg(jsonb_build_object('dress_id',id,'offer_price',price-allocated_discount-remainder,'offer_name',case when qualifies then best_name else '' end)) into item_quotes from final;
 return jsonb_build_object('original_subtotal',original,'item_subtotal',base,'automatic_discount',best,'calculated_total',base-best,'offers',snapshot,'item_quotes',item_quotes);
end $$;

create function public.check_availability(p_items jsonb,p_event date,p_town text default '',p_type text default 'bride',p_booking uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare t uuid:=require_tenant(); s tenant_settings; result jsonb; begin
 select * into s from tenant_settings where tenant_id=t;
 select coalesce(jsonb_agg(jsonb_build_object('dress_id',d.id,'unready',d.status in ('cleaning','out_of_service','delivered','awaiting_return','late','returned'),
 'conflict',exists(select 1 from booking_items bi where bi.tenant_id=t and bi.dress_id=d.id and bi.active and (p_booking is null or bi.booking_id<>p_booking)
 and coalesce(nullif(x->>'blocked_from','')::date,p_event-s.days_before_event)<=bi.blocked_until
 and coalesce(nullif(x->>'blocked_until','')::date,p_event+s.days_after_event)>=bi.blocked_from),
 'same_town',s.same_town_warning_enabled and p_type='bride' and trim(p_town)<>'' and exists(
 select 1 from booking_items bi join bookings b on b.id=bi.booking_id where bi.tenant_id=t and bi.dress_id=d.id and b.status<>'cancelled' and b.customer_type='bride'
 and lower(trim(b.customer_town))=lower(trim(p_town)) and (p_booking is null or b.id<>p_booking)))),'[]') into result
 from jsonb_array_elements(p_items) x join dresses d on d.id=(x->>'dress_id')::uuid and d.tenant_id=t;
 return result;
end $$;

create function public.save_booking(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare t uuid:=require_tenant(); s tenant_settings; b uuid:=nullif(p->>'id','')::uuid; c uuid; q jsonb; x jsonb; d record;
 ev date:=(p->>'event_date')::date; bf date; bu date; dv date; rt date; agreed numeric; existing bookings;
begin
 select * into s from tenant_settings where tenant_id=t;
 if ev is null or p->>'customer_type' not in ('bride','companion') or length(trim(p->>'name'))=0 or length(p->>'phone')<7 then raise exception 'INVALID_BOOKING'; end if;
 -- Serialize edits of one agreement and acquire inventory locks in stable order.
 if b is not null then
 select * into existing from bookings where id=b and tenant_id=t for update;
 if not found or existing.status<>'active' then raise exception 'INVALID_BOOKING'; end if;
 if exists(select 1 from booking_items where booking_id=b and status not in ('reserved','ready_for_delivery','cancelled')) then raise exception 'BOOKING_ALREADY_DELIVERED'; end if;
 end if;
 perform id from dresses where tenant_id=t and id in(select (v->>'dress_id')::uuid from jsonb_array_elements(p->'items') v) order by id for update;
 if exists(select 1 from jsonb_array_elements(check_availability(p->'items',ev,p->>'town',p->>'customer_type',b)) v where (v->>'conflict')::boolean or (v->>'unready')::boolean) then raise exception 'DATE_CONFLICT'; end if;
 if exists(select 1 from dresses inv join categories cat on cat.id=inv.category_id where inv.tenant_id=t and (not inv.visible or not cat.visible) and inv.id in(select (v->>'dress_id')::uuid from jsonb_array_elements(p->'items') v)) then raise exception 'ITEM_HIDDEN'; end if;
 q:=quote_booking(p->'items',ev); agreed:=coalesce(nullif(p->>'agreed_total','')::numeric,(q->>'calculated_total')::numeric);
 if agreed<0 or coalesce(nullif(p->>'deposit','')::numeric,0)<0 then raise exception 'INVALID_PRICE'; end if;
 if b is not null and agreed<(select coalesce(sum(amount),0) from payments where booking_id=b) then raise exception 'PRICE_BELOW_PAID'; end if;
 insert into customers(tenant_id,name,phone,secondary_phone,city,town) values(t,trim(p->>'name'),trim(p->>'phone'),coalesce(p->>'secondary_phone',''),coalesce(p->>'city',''),coalesce(p->>'town',''))
 on conflict(tenant_id,phone) do update set name=excluded.name,secondary_phone=excluded.secondary_phone,city=excluded.city,town=excluded.town returning id into c;
 if b is null then
 insert into bookings(tenant_id,customer_id,customer_name,customer_phone,secondary_phone,customer_city,customer_town,customer_type,event_date,original_subtotal,automatic_discount,calculated_total,agreed_total,offer_snapshot,notes)
 values(t,c,p->>'name',p->>'phone',coalesce(p->>'secondary_phone',''),coalesce(p->>'city',''),coalesce(p->>'town',''),p->>'customer_type',ev,(q->>'original_subtotal')::numeric,(q->>'automatic_discount')::numeric,(q->>'calculated_total')::numeric,agreed,q->'offers',coalesce(p->>'notes','')) returning id into b;
 else
 update bookings set customer_id=c,customer_name=p->>'name',customer_phone=p->>'phone',secondary_phone=coalesce(p->>'secondary_phone',''),customer_city=coalesce(p->>'city',''),customer_town=coalesce(p->>'town',''),customer_type=p->>'customer_type',event_date=ev,
 original_subtotal=(q->>'original_subtotal')::numeric,automatic_discount=(q->>'automatic_discount')::numeric,calculated_total=(q->>'calculated_total')::numeric,agreed_total=agreed,offer_snapshot=q->'offers',notes=coalesce(p->>'notes','') where id=b;
 delete from booking_items where booking_id=b;
 end if;
 for x in select * from jsonb_array_elements(p->'items') loop
 select dresses.*,categories.name as cat_name into d from dresses join categories on categories.id=dresses.category_id where dresses.id=(x->>'dress_id')::uuid and dresses.tenant_id=t;
 bf:=coalesce(nullif(x->>'blocked_from','')::date,ev-s.days_before_event); bu:=coalesce(nullif(x->>'blocked_until','')::date,ev+s.days_after_event);
 dv:=coalesce(nullif(x->>'delivery_date','')::date,bf); rt:=coalesce(nullif(x->>'expected_return_date','')::date,bu);
 insert into booking_items(tenant_id,booking_id,dress_id,dress_name,dress_code,category_name,original_price,price,offer_price,offer_name,blocked_from,blocked_until,delivery_date,expected_return_date)
 values(t,b,d.id,d.name,d.code,d.cat_name,d.default_price,coalesce(nullif(x->>'price','')::numeric,d.default_price),
 (select (v->>'offer_price')::numeric from jsonb_array_elements(q->'item_quotes') v where (v->>'dress_id')::uuid=d.id),
 (select v->>'offer_name' from jsonb_array_elements(q->'item_quotes') v where (v->>'dress_id')::uuid=d.id),bf,bu,dv,rt);
 end loop;
 if p->>'customer_type'='bride' then
 insert into fittings(tenant_id,booking_id,scheduled_at) values(t,b,coalesce(nullif(p->>'fitting_at','')::timestamptz,((ev-s.fitting_days_before_event)+time '12:00') at time zone s.timezone))
 on conflict(booking_id) do update set scheduled_at=coalesce(nullif(p->>'fitting_at','')::timestamptz,fittings.scheduled_at);
 else delete from fittings where booking_id=b; end if;
 if existing.id is null and coalesce(nullif(p->>'deposit','')::numeric,0)>0 then
 if (p->>'deposit')::numeric>agreed then raise exception 'PAYMENT_EXCEEDS_BALANCE'; end if;
 insert into payments(tenant_id,booking_id,amount,note) values(t,b,(p->>'deposit')::numeric,'عربون الحجز'); end if;
 return b;
end $$;

create function public.record_payment(p_booking uuid,p_amount numeric,p_date date,p_note text default '') returns void language plpgsql security definer set search_path=public as $$
declare t uuid:=require_tenant(); b bookings; total numeric; begin
 select * into b from bookings where id=p_booking and tenant_id=t for update;
 if not found or b.status='cancelled' then raise exception 'INVALID_BOOKING'; end if;
 select coalesce(sum(amount),0) into total from payments where booking_id=b.id;
 if p_amount<=0 or p_amount+total>b.agreed_total then raise exception 'PAYMENT_EXCEEDS_BALANCE'; end if;
 insert into payments(tenant_id,booking_id,amount,payment_date,note) values(t,b.id,p_amount,p_date,p_note);
end $$;

create function public.transition_item(p_item uuid,p_status text) returns void language plpgsql security definer set search_path=public as $$
declare t uuid:=require_tenant(); item booking_items; booking_status text; begin
 select b.status into booking_status from bookings b join booking_items bi on bi.booking_id=b.id where bi.id=p_item and bi.tenant_id=t for update of b;
 if booking_status is distinct from 'active' then raise exception 'INVALID_BOOKING'; end if;
 select * into item from booking_items where id=p_item and tenant_id=t for update;
 if not found then raise exception 'INVALID_ITEM'; end if;
 if not ((item.status='reserved' and p_status='ready_for_delivery') or (item.status='ready_for_delivery' and p_status='delivered') or
 (item.status='delivered' and p_status in ('awaiting_return','returned')) or (item.status='awaiting_return' and p_status='returned') or
 (item.status='returned' and p_status='cleaning') or (item.status='cleaning' and p_status='available')) then raise exception 'INVALID_TRANSITION'; end if;
 perform 1 from dresses where id=item.dress_id for update;
 if p_status='delivered' and exists(select 1 from booking_items where dress_id=item.dress_id and id<>item.id and status in ('delivered','awaiting_return','returned','cleaning')) then raise exception 'ITEM_NOT_RETURNED'; end if;
 update booking_items set status=p_status,actual_return_date=case when p_status='returned' then (now() at time zone (select timezone from tenant_settings where tenant_id=t))::date else actual_return_date end,
 active=case when p_status='available' then false else active end where id=item.id;
 if p_status in ('delivered','awaiting_return','returned','cleaning','available') then update dresses set status=p_status where id=item.dress_id; end if;
 if not exists(select 1 from booking_items where booking_id=item.booking_id and status not in ('available','cancelled')) then update bookings set status='completed' where id=item.booking_id; end if;
end $$;

create function public.cancel_booking(p_booking uuid) returns void language plpgsql security definer set search_path=public as $$
declare t uuid:=require_tenant(); begin
 perform 1 from bookings where id=p_booking and tenant_id=t and status='active' for update;
 if not found then raise exception 'INVALID_BOOKING'; end if;
 if exists(select 1 from booking_items where booking_id=p_booking and status not in ('reserved','ready_for_delivery','available','cancelled')) then raise exception 'RETURN_ITEMS_FIRST'; end if;
 update bookings set status='cancelled' where id=p_booking;
 update booking_items set status='cancelled',active=false where booking_id=p_booking;
 update fittings set status='cancelled' where booking_id=p_booking;
end $$;

create function public.save_offer(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare t uuid:=require_tenant(); o uuid:=nullif(p->>'id','')::uuid; x jsonb; begin
 if o is null then insert into offers(tenant_id,name,kind,value,min_items,starts_on,ends_on,active) values(t,p->>'name',p->>'kind',(p->>'value')::numeric,(p->>'min_items')::integer,(p->>'starts_on')::date,(p->>'ends_on')::date,(p->>'active')::boolean) returning id into o;
 else update offers set name=p->>'name',kind=p->>'kind',value=(p->>'value')::numeric,min_items=(p->>'min_items')::integer,starts_on=(p->>'starts_on')::date,ends_on=(p->>'ends_on')::date,active=(p->>'active')::boolean where id=o and tenant_id=t;
 if not found then raise exception 'INVALID_OFFER'; end if; delete from offer_targets where offer_id=o; end if;
 for x in select * from jsonb_array_elements(p->'targets') loop
 insert into offer_targets(tenant_id,offer_id,dress_id,category_id) values(t,o,nullif(x->>'dress_id','')::uuid,nullif(x->>'category_id','')::uuid); end loop; return o;
end $$;

create function public.save_fitting(p_booking uuid,p_at timestamptz,p_status text,p_notes text) returns void language plpgsql security definer set search_path=public as $$
declare t uuid:=require_tenant(); begin
 if not exists(select 1 from bookings where id=p_booking and tenant_id=t and status='active' and customer_type='bride') then raise exception 'INVALID_BOOKING'; end if;
 insert into fittings(tenant_id,booking_id,scheduled_at,status,notes) values(t,p_booking,p_at,p_status,p_notes)
 on conflict(booking_id) do update set scheduled_at=excluded.scheduled_at,status=excluded.status,notes=excluded.notes;
end $$;

create function public.refresh_notifications() returns void language plpgsql security definer set search_path=public as $$
declare t uuid:=require_tenant(); today date; begin
 select (now() at time zone timezone)::date into today from tenant_settings where tenant_id=t and notifications_enabled;
 if today is null then return; end if;
 insert into notifications(tenant_id,booking_id,dedup_key,message)
 select t,f.booking_id,'fitting:'||f.id||':'||today,'موعد بروفة '||b.customer_name||' — '||to_char(f.scheduled_at at time zone s.timezone,'YYYY-MM-DD HH24:MI')
 from fittings f join bookings b on b.id=f.booking_id join tenant_settings s on s.tenant_id=t
 where f.tenant_id=t and f.status='scheduled' and (f.scheduled_at at time zone s.timezone)::date between today and today+1
 on conflict(tenant_id,dedup_key) do nothing;
 insert into notifications(tenant_id,booking_id,dedup_key,message)
 select t,bi.booking_id,'item:'||bi.id||':'||today||':'||bi.status,
 case when bi.expected_return_date<today then 'تأخر إرجاع ' when bi.status in ('reserved','ready_for_delivery') then 'موعد تسليم ' else 'موعد إرجاع ' end||bi.dress_code
 from booking_items bi join bookings b on b.id=bi.booking_id
 where bi.tenant_id=t and b.status='active' and bi.actual_return_date is null and
 ((bi.status in ('reserved','ready_for_delivery') and bi.delivery_date between today and today+1) or
 (bi.status in ('delivered','awaiting_return') and bi.expected_return_date<=today+1))
 on conflict(tenant_id,dedup_key) do nothing;
end $$;
create function public.read_notification(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin update notifications set read_at=now() where tenant_id=require_tenant() and (p_id is null or id=p_id); end $$;

-- No function defaults to being callable by anonymous clients.
revoke execute on all functions in schema public from public,anon;
grant execute on function public.my_tenant(),public.is_super_admin(),public.require_tenant(),public.quote_booking(jsonb,date),public.check_availability(jsonb,date,text,text,uuid),public.save_booking(jsonb),public.record_payment(uuid,numeric,date,text),public.transition_item(uuid,text),public.cancel_booking(uuid),public.save_offer(jsonb),public.save_fitting(uuid,timestamptz,text,text),public.refresh_notifications(),public.read_notification(uuid) to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

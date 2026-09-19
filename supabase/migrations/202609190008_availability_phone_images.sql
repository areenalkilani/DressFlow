-- A future booking is allowed after the current rental's expected return; only actual overlaps and physical holds block it.
create or replace function public.check_availability(p_items jsonb,p_event date,p_town text default '',p_type text default 'bride',p_booking uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare t uuid:=require_tenant(); s tenant_settings; result jsonb; today date;
begin
 select * into s from tenant_settings where tenant_id=t;
 today:=(now() at time zone s.timezone)::date;
 select coalesce(jsonb_agg(jsonb_build_object('dress_id',d.id,
 'unready',d.status in ('cleaning','out_of_service') or exists(select 1 from booking_items bi where bi.tenant_id=t and bi.dress_id=d.id and bi.active and bi.actual_return_date is null and bi.status in ('delivered','awaiting_return') and bi.expected_return_date<today),
 'conflict',exists(select 1 from booking_items bi where bi.tenant_id=t and bi.dress_id=d.id and bi.active and (p_booking is null or bi.booking_id<>p_booking)
 and coalesce(nullif(x->>'blocked_from','')::date,p_event-s.days_before_event)<=bi.blocked_until
 and coalesce(nullif(x->>'blocked_until','')::date,p_event+s.days_after_event)>=bi.blocked_from),
 'same_town',s.same_town_warning_enabled and p_type='bride' and trim(p_town)<>'' and exists(
 select 1 from booking_items bi join bookings b on b.id=bi.booking_id where bi.tenant_id=t and bi.dress_id=d.id and b.status<>'cancelled' and b.customer_type='bride'
 and lower(trim(b.customer_town))=lower(trim(p_town)) and (p_booking is null or b.id<>p_booking)))),'[]') into result
 from jsonb_array_elements(p_items) x join dresses d on d.id=(x->>'dress_id')::uuid and d.tenant_id=t;
 return result;
end $$;
revoke execute on function public.check_availability(jsonb,date,text,text,uuid) from public,anon;
grant execute on function public.check_availability(jsonb,date,text,text,uuid) to authenticated;

create or replace function public.normalize_mobile_phone(p text) returns text
language plpgsql immutable set search_path=public as $$
declare v text:=regexp_replace(trim(coalesce(p,'')),'[^0-9+]','','g');
begin
 if v='' then return ''; end if;
 if v like '00972%' then v:='+'||substr(v,3); end if;
 if v ~ '^9725[0-9]{8}$' then v:='+'||v; end if;
 if v ~ '^05[0-9]{8}$' then v:='+972'||substr(v,2); end if;
 if v !~ '^\+(970|972)5[0-9]{8}$' then raise exception 'INVALID_PHONE'; end if;
 return v;
end $$;
create or replace function public.guard_customer_phone() returns trigger language plpgsql set search_path=public as $$
begin new.phone:=normalize_mobile_phone(new.phone); new.secondary_phone:=normalize_mobile_phone(new.secondary_phone); return new; end $$;
create or replace function public.guard_booking_phone() returns trigger language plpgsql set search_path=public as $$
begin new.customer_phone:=normalize_mobile_phone(new.customer_phone); new.secondary_phone:=normalize_mobile_phone(new.secondary_phone); return new; end $$;
create trigger normalize_customer_phone before insert or update of phone,secondary_phone on public.customers for each row execute function public.guard_customer_phone();
create trigger normalize_booking_phone before insert or update of customer_phone,secondary_phone on public.bookings for each row execute function public.guard_booking_phone();
revoke execute on function public.normalize_mobile_phone(text),public.guard_customer_phone(),public.guard_booking_phone() from public,anon,authenticated;
create index booking_items_available_date_idx on public.booking_items(tenant_id,dress_id,blocked_from,blocked_until) where active;

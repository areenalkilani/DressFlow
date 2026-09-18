-- Shop owners may select a valid operational state directly; each physical item remains locked and tenant-scoped.
create or replace function public.transition_item(p_item uuid,p_status text) returns void
language plpgsql security definer set search_path=public as $$
declare t uuid:=require_tenant(); item booking_items; booking_status text; returned_on date;
begin
  if p_status not in ('ready_for_delivery','delivered','awaiting_return','returned','cleaning','available') then raise exception 'INVALID_TRANSITION'; end if;
  select b.status into booking_status from bookings b join booking_items bi on bi.booking_id=b.id where bi.id=p_item and bi.tenant_id=t for update of b;
  if booking_status is distinct from 'active' then raise exception 'INVALID_BOOKING'; end if;
  select * into item from booking_items where id=p_item and tenant_id=t for update;
  if not found then raise exception 'INVALID_ITEM'; end if;
  if p_status='delivered' and exists(select 1 from booking_items where dress_id=item.dress_id and id<>item.id and status in ('delivered','awaiting_return','returned','cleaning')) then raise exception 'ITEM_NOT_RETURNED'; end if;
  returned_on:=case when p_status in ('returned','cleaning','available') then coalesce(item.actual_return_date,(now() at time zone (select timezone from tenant_settings where tenant_id=t))::date) else item.actual_return_date end;
  update booking_items set status=p_status,actual_return_date=returned_on,active=case when p_status='available' then false else active end where id=item.id;
  update dresses set status=p_status where id=item.dress_id;
  if not exists(select 1 from booking_items where booking_id=item.booking_id and status not in ('available','cancelled')) then update bookings set status='completed' where id=item.booking_id; end if;
end $$;
revoke execute on function public.transition_item(uuid,text) from public,anon;
grant execute on function public.transition_item(uuid,text) to authenticated;

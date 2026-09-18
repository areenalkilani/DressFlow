-- Inventory edits may not override an item's physical custody/cleaning workflow.
create function public.guard_inventory_status() returns trigger language plpgsql set search_path=public as $$
begin
 if current_user='authenticated' and (tg_op='INSERT' or new.status is distinct from old.status) then
 if new.status not in ('available','cleaning','out_of_service') then raise exception 'INVALID_TRANSITION'; end if;
 if tg_op='UPDATE' and exists(select 1 from booking_items where dress_id=new.id and status in ('delivered','awaiting_return','returned','cleaning')) then raise exception 'ITEM_NOT_RETURNED'; end if;
 end if;
 return new;
end $$;
create trigger protect_inventory before insert or update on public.dresses for each row execute function public.guard_inventory_status();
revoke execute on function public.guard_inventory_status() from public,anon,authenticated;
alter table public.categories add constraint category_image_tenant check(image_path is null or split_part(image_path,'/',1)=tenant_id::text);
alter table public.dresses add constraint dress_image_tenant check(image_path is null or split_part(image_path,'/',1)=tenant_id::text);
alter table public.tenants add constraint logo_tenant check(logo_path is null or split_part(logo_path,'/',1)=id::text);
create index on public.booking_items(tenant_id,booking_id);
create index on public.offer_targets(tenant_id,offer_id);
create index on public.notifications(tenant_id,created_at desc);
revoke insert,delete on public.tenant_settings from authenticated;

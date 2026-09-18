-- Add self-service contact phone updates. Existing rows and policies are preserved.
-- A new RPC name makes a missing deployment detectable instead of silently ignoring phone edits.
create or replace function public.save_shop_settings(p jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare t uuid:=require_tenant(); begin
 if nullif(trim(p->>'phone'),'') is null or (p->>'phone') !~ '^\+[1-9][0-9]{7,14}$' then
   raise exception 'INVALID_PHONE';
 end if;
 if nullif(trim(p->>'name'),'') is null or nullif(trim(p->>'owner_name'),'') is null then
   raise exception 'INVALID_NAME';
 end if;
 perform public.save_settings(p);
 update public.tenants set phone=p->>'phone' where id=t;
end $$;
revoke execute on function public.save_shop_settings(jsonb) from public,anon;
grant execute on function public.save_shop_settings(jsonb) to authenticated;

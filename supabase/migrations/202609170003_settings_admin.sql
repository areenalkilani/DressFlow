create function public.save_settings(p jsonb) returns void language plpgsql security definer set search_path=public as $$
declare t uuid:=require_tenant(); begin
 if p->>'logo_path' is not null and split_part(p->>'logo_path','/',1)<>t::text then raise exception 'INVALID_IMAGE'; end if;
 if not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'INVALID_TIMEZONE'; end if;
 update tenants set name=p->>'name',owner_name=p->>'owner_name',logo_path=p->>'logo_path' where id=t;
 update profiles set name=p->>'owner_name' where id=auth.uid();
 update tenant_settings set days_before_event=(p->>'days_before_event')::integer,days_after_event=(p->>'days_after_event')::integer,
 fitting_days_before_event=(p->>'fitting_days_before_event')::integer,same_town_warning_enabled=(p->>'same_town_warning_enabled')::boolean,
 notifications_enabled=(p->>'notifications_enabled')::boolean,timezone=p->>'timezone' where tenant_id=t;
end $$;
create function public.provision_shop(p_user uuid,p_name text,p_owner text,p_phone text,p_active boolean) returns uuid language plpgsql security definer set search_path=public as $$
declare t uuid; begin
 insert into profiles(id,name,role) values(p_user,p_owner,'shop_admin');
 insert into tenants(name,owner_name,phone,active) values(p_name,p_owner,p_phone,p_active) returning id into t;
 insert into tenant_users(tenant_id,user_id) values(t,p_user); return t;
end $$;
revoke execute on function public.save_settings(jsonb),public.provision_shop(uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.save_settings(jsonb) to authenticated;
grant execute on function public.provision_shop(uuid,text,text,text,boolean) to service_role;

-- Each physical dress remains a separate inventory record, so it can be reserved and returned independently.
create or replace function public.create_dress_variants(p jsonb) returns integer
language plpgsql security definer set search_path=public as $$
declare
  t uuid:=require_tenant(); v jsonb; variant jsonb; n integer:=0; quantity integer; base_code text;
begin
  if jsonb_typeof(p->'variants') <> 'array' or jsonb_array_length(p->'variants')=0 or jsonb_array_length(p->'variants')>50 then raise exception 'INVALID_VARIANTS'; end if;
  if nullif(trim(p->>'name'),'') is null or nullif(trim(p->>'code'),'') is null or (p->>'code') !~ '^[A-Za-z0-9_-]{1,55}$' then raise exception 'INVALID_DRESS'; end if;
  if not exists(select 1 from categories where id=(p->>'category_id')::uuid and tenant_id=t) then raise exception 'INVALID_CATEGORY'; end if;
  base_code:=upper(trim(p->>'code'));
  for variant in select value from jsonb_array_elements(p->'variants') loop
    if nullif(trim(variant->>'size'),'') is null then raise exception 'INVALID_SIZE'; end if;
    quantity:=(variant->>'quantity')::integer;
    if quantity is null or quantity<1 or quantity>50 then raise exception 'INVALID_QUANTITY'; end if;
    for v in select jsonb_build_object('size',trim(variant->>'size')) from generate_series(1,quantity) loop
      n:=n+1;
      insert into dresses(tenant_id,category_id,code,name,color,size,default_price,notes,status,visible,image_path)
      values(t,(p->>'category_id')::uuid,base_code||'-'||n,p->>'name',coalesce(p->>'color',''),v->>'size',(p->>'default_price')::numeric,coalesce(p->>'notes',''),'available',coalesce((p->>'visible')::boolean,true),nullif(p->>'image_path',''));
    end loop;
  end loop;
  return n;
end $$;
revoke execute on function public.create_dress_variants(jsonb) from public,anon;
grant execute on function public.create_dress_variants(jsonb) to authenticated;

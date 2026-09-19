-- Store all mobile numbers in one international format while accepting local Palestinian or Israeli input.
create or replace function public.normalize_mobile_phone(p text) returns text
language plpgsql immutable set search_path=public as $$
declare v text:=regexp_replace(trim(coalesce(p,'')),'[^0-9+]','','g');
begin
 if v='' then return ''; end if;
 if v ~ '^00(970|972)5[0-9]{8}$' then v:='+'||substr(v,3); end if;
 if v ~ '^(970|972)5[0-9]{8}$' then v:='+'||v; end if;
 if v ~ '^0?5[0-9]{8}$' then
   if v ~ '^0?(56|59)' then v:='+970'||regexp_replace(v,'^0','');
   else v:='+972'||regexp_replace(v,'^0',''); end if;
 end if;
 if v !~ '^\+(970|972)5[0-9]{8}$' then raise exception 'INVALID_PHONE'; end if;
 return v;
end $$;
revoke execute on function public.normalize_mobile_phone(text) from public,anon,authenticated;

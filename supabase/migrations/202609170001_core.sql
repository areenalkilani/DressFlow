create extension if not exists btree_gist;

create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 name text not null, role text not null check(role in ('super_admin','shop_admin')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_super_admin on public.profiles(role) where role='super_admin';
create table public.tenants (
 id uuid primary key default gen_random_uuid(), name text not null, owner_name text not null,
 phone text not null unique check(phone ~ '^\+[1-9][0-9]{7,14}$'), active boolean not null default true,
 logo_path text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.tenant_users (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants,
 user_id uuid not null unique references public.profiles on delete cascade,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(tenant_id,user_id)
);
create table public.tenant_settings (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null unique references public.tenants,
 days_before_event integer not null default 2 check(days_before_event between 0 and 60),
 days_after_event integer not null default 2 check(days_after_event between 0 and 60),
 fitting_days_before_event integer not null default 14 check(fitting_days_before_event between 0 and 365),
 same_town_warning_enabled boolean not null default true, notifications_enabled boolean not null default true,
 timezone text not null default 'Asia/Jerusalem',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants,
 name text not null, visible boolean not null default true, image_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(tenant_id,id), unique(tenant_id,name)
);
create table public.dresses (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants,
 category_id uuid not null, code text not null check(code ~ '^[A-Za-z0-9_-]+$'), name text not null,
 color text not null default '', size text not null default '', default_price numeric(12,2) not null check(default_price>=0),
 notes text not null default '', status text not null default 'available' check(status in ('available','reserved','ready_for_delivery','delivered','awaiting_return','returned','cleaning','late','out_of_service')),
 visible boolean not null default true, image_path text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(tenant_id,id), unique(tenant_id,code), foreign key(tenant_id,category_id) references public.categories(tenant_id,id)
);
create table public.customers (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants,
 name text not null, phone text not null check(length(phone)>=7), secondary_phone text not null default '',
 city text not null default '', town text not null default '', notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(tenant_id,id), unique(tenant_id,phone)
);
create table public.offers (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants,
 name text not null, kind text not null check(kind in ('percentage','fixed','bundle')),
 value numeric(12,2) not null check(value>=0), min_items integer not null default 1 check(min_items>0),
 starts_on date not null, ends_on date not null, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(tenant_id,id),
 check(ends_on>=starts_on), check(kind <> 'percentage' or value<=100)
);
create table public.offer_targets (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants,
 offer_id uuid not null, dress_id uuid, category_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(num_nonnulls(dress_id,category_id)=1),
 foreign key(tenant_id,offer_id) references public.offers(tenant_id,id) on delete cascade,
 foreign key(tenant_id,dress_id) references public.dresses(tenant_id,id),
 foreign key(tenant_id,category_id) references public.categories(tenant_id,id),
 unique(offer_id,dress_id), unique(offer_id,category_id)
);
create table public.bookings (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants,
 number bigint generated always as identity, customer_id uuid not null, customer_name text not null,
 customer_phone text not null, customer_city text not null default '', customer_town text not null default '', secondary_phone text not null default '',
 customer_type text not null check(customer_type in ('bride','companion')), event_date date not null,
 status text not null default 'active' check(status in ('active','completed','cancelled')),
 original_subtotal numeric(12,2) not null default 0 check(original_subtotal>=0), automatic_discount numeric(12,2) not null default 0 check(automatic_discount>=0),
 calculated_total numeric(12,2) not null default 0 check(calculated_total>=0), agreed_total numeric(12,2) not null default 0 check(agreed_total>=0),
 offer_snapshot jsonb not null default '[]', notes text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(tenant_id,id),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id)
);
create table public.booking_items (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants,
 booking_id uuid not null, dress_id uuid not null, dress_name text not null, dress_code text not null, category_name text not null,
 original_price numeric(12,2) not null check(original_price>=0), price numeric(12,2) not null check(price>=0),
 offer_price numeric(12,2) not null check(offer_price>=0), offer_name text not null default '',
 blocked_from date not null, blocked_until date not null, delivery_date date not null, expected_return_date date not null, actual_return_date date,
 status text not null default 'reserved' check(status in ('reserved','ready_for_delivery','delivered','awaiting_return','returned','cleaning','available','cancelled')),
 active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(tenant_id,id), unique(booking_id,dress_id),
 foreign key(tenant_id,booking_id) references public.bookings(tenant_id,id),
 foreign key(tenant_id,dress_id) references public.dresses(tenant_id,id),
 check(blocked_until>=blocked_from), check(expected_return_date>=delivery_date),
 check(delivery_date>=blocked_from and expected_return_date<=blocked_until),
 exclude using gist (dress_id with =, daterange(blocked_from,blocked_until,'[]') with &&) where (active)
);
create table public.payments (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants, booking_id uuid not null,
 amount numeric(12,2) not null check(amount>0), payment_date date not null default current_date, note text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(tenant_id,booking_id) references public.bookings(tenant_id,id)
);
create table public.fittings (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants, booking_id uuid not null unique,
 scheduled_at timestamptz not null, status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled')),
 notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(tenant_id,booking_id) references public.bookings(tenant_id,id)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants, booking_id uuid,
 dedup_key text not null, message text not null, read_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(tenant_id,dedup_key),
 foreign key(tenant_id,booking_id) references public.bookings(tenant_id,id)
);

create function public.my_tenant() returns uuid language sql stable security definer set search_path=public as $$
 select tu.tenant_id from tenant_users tu join tenants t on t.id=tu.tenant_id
 join profiles p on p.id=tu.user_id where tu.user_id=auth.uid() and t.active and p.role='shop_admin'
$$;
create function public.is_super_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and role='super_admin')
$$;
create function public.stamp_update() returns trigger language plpgsql set search_path=public as $$
 begin new.updated_at=now(); return new; end
$$;
do $$ declare tab text; begin
 foreach tab in array array['profiles','tenants','tenant_users','tenant_settings','categories','dresses','customers','offers','offer_targets','bookings','booking_items','payments','fittings','notifications'] loop
 execute format('alter table public.%I enable row level security',tab);
 execute format('create trigger stamp before update on public.%I for each row execute function public.stamp_update()',tab);
 if tab not in ('profiles','tenants') then execute format('create index on public.%I(tenant_id)',tab); end if;
 end loop;
end $$;
create policy self_profile on public.profiles for select to authenticated using(id=auth.uid());
create policy own_membership on public.tenant_users for select to authenticated using(user_id=auth.uid());
create policy own_tenant on public.tenants for select to authenticated using(id=public.my_tenant());
do $$ declare tab text; begin
 foreach tab in array array['tenant_settings','categories','dresses','customers','offers','offer_targets','bookings','booking_items','payments','fittings','notifications'] loop
 execute format('create policy tenant_read on public.%I for select to authenticated using(tenant_id=public.my_tenant())',tab);
 end loop;
 foreach tab in array array['categories','dresses','customers','tenant_settings'] loop
 execute format('create policy tenant_write on public.%I for all to authenticated using(tenant_id=public.my_tenant()) with check(tenant_id=public.my_tenant())',tab);
 end loop;
end $$;
-- Financial and lifecycle writes are intentionally RPC-only, preventing bypass of business rules.
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert,update,delete on public.categories,public.dresses,public.customers,public.tenant_settings to authenticated;
revoke insert,update,delete on public.profiles,public.tenants,public.tenant_users,public.bookings,public.booking_items,public.payments,public.fittings,public.offers,public.offer_targets,public.notifications from authenticated,anon;

create function public.seed_tenant() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into tenant_settings(tenant_id) values(new.id);
 insert into categories(tenant_id,name) values(new.id,'بدلات عروس بيضاء'),(new.id,'بدلات عروس ملونة'),(new.id,'فساتين مرافقات');
 return new;
end $$;
create trigger seed_new_tenant after insert on public.tenants for each row execute function public.seed_tenant();

create index on public.bookings(tenant_id,event_date);
create index on public.booking_items(tenant_id,expected_return_date) where actual_return_date is null;
create index on public.fittings(tenant_id,scheduled_at);
create index on public.payments(tenant_id,booking_id);
create index on public.customers(tenant_id,name);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('rental-images','rental-images',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy image_read on storage.objects for select to authenticated using(bucket_id='rental-images' and (storage.foldername(name))[1]=public.my_tenant()::text);
create policy image_insert on storage.objects for insert to authenticated with check(bucket_id='rental-images' and (storage.foldername(name))[1]=public.my_tenant()::text);
create policy image_update on storage.objects for update to authenticated using(bucket_id='rental-images' and (storage.foldername(name))[1]=public.my_tenant()::text) with check(bucket_id='rental-images' and (storage.foldername(name))[1]=public.my_tenant()::text);
create policy image_delete on storage.objects for delete to authenticated using(bucket_id='rental-images' and (storage.foldername(name))[1]=public.my_tenant()::text);

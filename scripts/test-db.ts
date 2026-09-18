import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  const db = new PGlite({ extensions: { btree_gist } });
  let passed = 0;
  const sql = async (q: string, params: unknown[] = []) => db.query(q, params);
  const scalar = async (q: string, params: unknown[] = []) =>
    Object.values((await sql(q, params)).rows[0] as Record<string, unknown>)[0];
  const check = (name: string) => {
    passed++;
    console.log(`PASS ${passed}: ${name}`);
  };
  const rejects = async (fn: () => Promise<unknown>, pattern?: RegExp) => {
    if (pattern) await assert.rejects(fn, pattern);
    else await assert.rejects(fn);
  };
  try {
    // Minimal platform schemas; application migrations below are executed verbatim.
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
grant usage on schema storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated;`);
    for (const file of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    check("all SQL migrations execute successfully");
    const u1 = randomUUID(),
      u2 = randomUUID();
    await sql("insert into auth.users values($1),($2)", [u1, u2]);
    const t1 = (await scalar(
      "select provision_shop($1,'متجر أ','أرين','+972599111111',true)",
      [u1],
    )) as string;
    const t2 = (await scalar(
      "select provision_shop($1,'متجر ب','ريم','+972599222222',true)",
      [u2],
    )) as string;
    assert.equal(
      await scalar(
        "select count(*)::integer from categories where tenant_id=$1",
        [t1],
      ),
      3,
    );
    check("shop provisioning creates categories, settings, and membership");
    const asUser = async (u: string) => {
      await db.exec("reset role");
      await sql("select set_config('request.jwt.claim.sub',$1,false)", [u]);
      await db.exec("set role authenticated");
    };
    await asUser(u1);
    const settingsPayload = {
      name: "Updated shop",
      owner_name: "Owner",
      phone: "+972599111112",
      timezone: "Asia/Jerusalem",
      days_before_event: 2,
      days_after_event: 2,
      fitting_days_before_event: 14,
      same_town_warning_enabled: true,
      notifications_enabled: true,
      tenant_id: t2,
    };
    const updateSettings = (extra: Record<string, unknown> = {}) =>
      sql("select save_shop_settings($1::jsonb)", [
        JSON.stringify({ ...settingsPayload, ...extra }),
      ]);
    await updateSettings();
    assert.equal(
      await scalar("select phone from tenants where id=$1", [t1]),
      settingsPayload.phone,
    );
    await asUser(u2);
    assert.equal(
      await scalar("select phone from tenants where id=$1", [t2]),
      "+972599222222",
    );
    await asUser(u1);
    await rejects(
      () => updateSettings({ phone: "+972599222222", name: "Must rollback" }),
      /unique/,
    );
    assert.equal(
      await scalar("select name from tenants where id=$1", [t1]),
      settingsPayload.name,
    );
    await rejects(() => updateSettings({ phone: "bad" }), /INVALID_PHONE/);
    check(
      "self-service settings are tenant-scoped, validate phone and roll back duplicate phones",
    );
    const cat = (await scalar("select id from categories limit 1")) as string;
    const variantsCreated = await scalar(
      "select create_dress_variants($1::jsonb)",
      [
        JSON.stringify({
          category_id: cat,
          code: "BRIDE",
          name: "فستان تجريبي",
          color: "أبيض",
          default_price: 900,
          visible: true,
          variants: [
            { size: "S", quantity: 2 },
            { size: "M", quantity: 3 },
          ],
        }),
      ],
    );
    assert.equal(variantsCreated, 5);
    assert.deepEqual(
      (
        await sql(
          "select code,size from dresses where name='فستان تجريبي' order by code",
        )
      ).rows.map((r: any) => [r.code, r.size]),
      [
        ["BRIDE-1", "S"],
        ["BRIDE-2", "S"],
        ["BRIDE-3", "M"],
        ["BRIDE-4", "M"],
        ["BRIDE-5", "M"],
      ],
    );
    await asUser(u2);
    await rejects(
      () =>
        sql("select create_dress_variants($1::jsonb)", [
          JSON.stringify({
            category_id: cat,
            code: "ATTACK",
            name: "x",
            default_price: 1,
            variants: [{ size: "M", quantity: 1 }],
          }),
        ]),
      /INVALID_CATEGORY/,
    );
    await asUser(u1);
    check(
      "one dress form creates independently bookable size and quantity variants",
    );
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    for (let i = 0; i < ids.length; i++)
      await sql(
        "insert into dresses(id,tenant_id,category_id,code,name,default_price) values($1,$2,$3,$4,$5,$6)",
        [
          ids[i],
          t1,
          cat,
          `W-${i + 1}`,
          `فستان ${i + 1}`,
          [1000, 800, 800, 500][i],
        ],
      );
    const make = (
      event: string,
      items = ids.slice(0, 1),
      extra: Record<string, unknown> = {},
    ) => ({
      name: "سارة",
      phone: "0599999999",
      town: "بيرزيت",
      city: "رام الله",
      customer_type: "bride",
      event_date: event,
      items: items.map((dress_id) => ({ dress_id })),
      ...extra,
    });
    const book = async (p: unknown) =>
      scalar("select save_booking($1::jsonb)", [
        JSON.stringify(p),
      ]) as Promise<string>;
    const b1 = await book(make("2026-10-10"));
    const dates = (
      await sql(
        "select blocked_from::text,blocked_until::text from booking_items where booking_id=$1",
        [b1],
      )
    ).rows[0] as { blocked_from: string; blocked_until: string };
    assert.deepEqual(dates, {
      blocked_from: "2026-10-08",
      blocked_until: "2026-10-12",
    });
    check("default period blocks October 8 through October 12");
    await sql(
      "select save_fitting($1,'2026-09-24T12:00:00Z','completed','تمت البروفة')",
      [b1],
    );
    await book(make("2026-10-10", ids.slice(0, 1), { id: b1 }));
    assert.equal(
      await scalar("select status from fittings where booking_id=$1", [b1]),
      "completed",
    );
    assert.equal(
      await scalar(
        "select (scheduled_at at time zone 'UTC')::date::text from fittings where booking_id=$1",
        [b1],
      ),
      "2026-09-24",
    );
    check(
      "editing an agreement preserves an existing fitting date and completion status",
    );
    await rejects(() => book(make("2026-10-12")), /DATE_CONFLICT/);
    check("overlapping reservation is rejected server-side");
    await rejects(() => book(make("2026-10-14")), /DATE_CONFLICT/);
    check("inclusive boundary overlap is rejected");
    await book(make("2026-10-15"));
    check("reservation outside blocked period succeeds");
    await book(make("2026-10-10", [ids[1]]));
    check("different physical dress can be booked on same date");
    const offer = await scalar("select save_offer($1::jsonb)", [
      JSON.stringify({
        name: "بدلتان بسعر 1500",
        kind: "bundle",
        value: 1500,
        min_items: 2,
        starts_on: "2026-01-01",
        ends_on: "2026-12-31",
        active: true,
        targets: [{ dress_id: ids[0] }, { dress_id: ids[1] }],
      }),
    ]);
    const b3 = await book(
      make("2026-11-10", ids.slice(0, 3), { agreed_total: 2200, deposit: 500 }),
    );
    assert.equal(
      await scalar(
        "select count(*)::integer from booking_items where booking_id=$1",
        [b3],
      ),
      3,
    );
    check("three items belong to one booking");
    assert.equal(
      await scalar(
        "select sum(amount)::float from payments where booking_id=$1",
        [b3],
      ),
      500,
    );
    check("deposit belongs to entire booking");
    const financial = (
      await sql(
        "select original_subtotal::float,automatic_discount::float,calculated_total::float,agreed_total::float from bookings where id=$1",
        [b3],
      )
    ).rows[0];
    assert.deepEqual(financial, {
      original_subtotal: 2600,
      automatic_discount: 300,
      calculated_total: 2300,
      agreed_total: 2200,
    });
    check(
      "bundle offer applies automatically, negotiated total overrides quote",
    );
    await sql("select record_payment($1,300,'2026-11-01','دفعة إضافية')", [b3]);
    assert.equal(
      await scalar(
        "select (agreed_total-(select sum(amount) from payments where booking_id=b.id))::float from bookings b where id=$1",
        [b3],
      ),
      1400,
    );
    check("multiple payments calculate remaining balance from ledger");
    await rejects(
      () => sql("select record_payment($1,1500,'2026-11-01','')", [b3]),
      /PAYMENT_EXCEEDS_BALANCE/,
    );
    check("overpayment is rejected");
    await sql("update dresses set default_price=9999 where id=$1", [ids[0]]);
    assert.equal(
      await scalar(
        "select original_price::float from booking_items where booking_id=$1 and dress_id=$2",
        [b3, ids[0]],
      ),
      1000,
    );
    check("inventory price changes preserve historical item price");
    await scalar("select save_offer($1::jsonb)", [
      JSON.stringify({
        id: offer,
        name: "عرض معدل",
        kind: "bundle",
        value: 100,
        min_items: 2,
        starts_on: "2026-01-01",
        ends_on: "2026-12-31",
        active: false,
        targets: [],
      }),
    ]);
    assert.deepEqual(
      (
        await sql(
          "select original_subtotal::float,automatic_discount::float,calculated_total::float,agreed_total::float from bookings where id=$1",
          [b3],
        )
      ).rows[0],
      financial,
    );
    check("offer changes preserve historical booking pricing");
    assert.equal(
      await scalar(
        "select sum(offer_price)::float from booking_items where booking_id=$1",
        [b3],
      ),
      2300,
    );
    check("allocated item offer snapshots sum exactly to the quoted total");
    const quoteItems = JSON.stringify([
      { dress_id: ids[0], price: 1000 },
      { dress_id: ids[1], price: 800 },
    ]);
    for (const [kind, value, expected] of [
      ["percentage", 20, 1440],
      ["fixed", 200, 1600],
    ] as const) {
      const o = await scalar("select save_offer($1::jsonb)", [
        JSON.stringify({
          name: kind,
          kind,
          value,
          min_items: 2,
          starts_on: "2026-01-01",
          ends_on: "2026-12-31",
          active: true,
          targets: [{ category_id: cat }],
        }),
      ]);
      const q = (await scalar("select quote_booking($1::jsonb,'2026-11-20')", [
        quoteItems,
      ])) as { calculated_total: number };
      assert.equal(q.calculated_total, expected);
      await scalar("select save_offer($1::jsonb)", [
        JSON.stringify({
          id: o,
          name: kind,
          kind,
          value,
          min_items: 2,
          starts_on: "2026-01-01",
          ends_on: "2026-12-31",
          active: false,
          targets: [],
        }),
      ]);
      check(
        `${kind} category offer applies to manually overridden item prices`,
      );
    }
    const customerCount = await scalar(
      "select count(*)::integer from customers",
    );
    await rejects(
      () =>
        book(
          make("2027-09-20", [ids[2]], {
            phone: "0598888888",
            deposit: 999999,
          }),
        ),
      /PAYMENT_EXCEEDS_BALANCE/,
    );
    assert.equal(
      await scalar("select count(*)::integer from customers"),
      customerCount,
    );
    check(
      "failed booking payment rolls back customer, items, fitting and agreement atomically",
    );
    await sql("update categories set visible=false where id=$1", [cat]);
    await rejects(() => book(make("2027-09-20", [ids[2]])), /ITEM_HIDDEN/);
    await sql("update categories set visible=true where id=$1", [cat]);
    check("hidden categories cannot be bypassed by direct booking requests");
    const warning = (await scalar(
      "select check_availability($1::jsonb,'2026-12-20','بيرزيت','bride')",
      [JSON.stringify([{ dress_id: ids[0] }])],
    )) as { same_town: boolean; conflict: boolean }[];
    assert.equal(warning[0].same_town, true);
    assert.equal(warning[0].conflict, false);
    await book(make("2026-12-20"));
    check("same-town warning is separate and never blocks save");
    await sql(
      "update tenant_settings set same_town_warning_enabled=false where tenant_id=$1",
      [t1],
    );
    const noWarning = (await scalar(
      "select check_availability($1::jsonb,'2027-02-10','بيرزيت','bride')",
      [JSON.stringify([{ dress_id: ids[0] }])],
    )) as { same_town: boolean }[];
    assert.equal(noWarning[0].same_town, false);
    check("shop can disable same-town warning");
    assert.equal(
      await scalar(
        "select (scheduled_at at time zone 'Asia/Jerusalem')::date::text from fittings where booking_id=$1",
        [b3],
      ),
      "2026-10-27",
    );
    check("bride fitting is suggested 14 days before event");
    const companion = await book(
      make("2027-01-20", [ids[3]], { customer_type: "companion" }),
    );
    assert.equal(
      await scalar(
        "select count(*)::integer from fittings where booking_id=$1",
        [companion],
      ),
      0,
    );
    check("companion booking does not create automatic fitting");
    await db.exec("reset role");
    await rejects(
      () =>
        sql(
          `insert into booking_items(tenant_id,booking_id,dress_id,dress_name,dress_code,category_name,original_price,price,offer_price,offer_name,blocked_from,blocked_until,delivery_date,expected_return_date)
      select tenant_id,$1,dress_id,dress_name,dress_code,category_name,original_price,price,offer_price,offer_name,blocked_from,blocked_until,delivery_date,expected_return_date from booking_items where booking_id=$2`,
          [companion, b1],
        ),
      /exclusion constraint/,
    );
    await asUser(u1);
    check(
      "PostgreSQL exclusion constraint itself rejects overlap when application validation is bypassed",
    );
    const b3items = (
      await sql(
        "select id from booking_items where booking_id=$1 order by id",
        [b3],
      )
    ).rows as { id: string }[];
    await sql("select transition_item($1,'delivered')", [b3items[0].id]);
    await rejects(
      () =>
        sql(
          "update dresses set status='available' where id=(select dress_id from booking_items where id=$1)",
          [b3items[0].id],
        ),
      /ITEM_NOT_RETURNED/,
    );
    check("direct inventory writes cannot override physical custody");
    await sql("select transition_item($1,'returned')", [b3items[0].id]);
    assert.equal(
      await scalar(
        "select count(*)::integer from booking_items where booking_id=$1 and status='reserved'",
        [b3],
      ),
      2,
    );
    assert.ok(
      await scalar(
        "select actual_return_date is not null from booking_items where id=$1",
        [b3items[0].id],
      ),
    );
    await sql("select transition_item($1,'available')", [b3items[0].id]);
    assert.equal(
      await scalar("select active from booking_items where id=$1", [
        b3items[0].id,
      ]),
      false,
    );
    check(
      "direct item states preserve custody and release only the selected returned item",
    );
    assert.equal(await scalar("select count(*)::integer from customers"), 1);
    check("repeat customer is reused across bookings");
    await asUser(u2);
    assert.equal(await scalar("select count(*)::integer from bookings"), 0);
    assert.equal(await scalar("select count(*)::integer from dresses"), 0);
    assert.equal(await scalar("select count(*)::integer from payments"), 0);
    check("tenant B cannot read tenant A operational data");
    assert.equal(
      (
        await sql("update dresses set name='هجوم' where id=$1 returning id", [
          ids[0],
        ])
      ).rows.length,
      0,
    );
    await rejects(
      () =>
        sql("insert into categories(tenant_id,name) values($1,'هجوم')", [t1]),
      /row-level security/,
    );
    await rejects(() => book(make("2027-05-01")));
    check(
      "cross-tenant updates, injected tenant IDs, and foreign dress references are rejected",
    );
    await rejects(
      () => sql("select record_payment($1,1,current_date,'')", [b3]),
      /INVALID_BOOKING/,
    );
    await rejects(
      () => sql("update bookings set agreed_total=0 where id=$1", [b3]),
      /permission denied/,
    );
    check(
      "privileged workflow calls and direct financial writes cannot bypass tenant checks",
    );
    await asUser(u1);
    await sql(
      "insert into storage.objects(bucket_id,name) values('rental-images',$1)",
      [`${t1}/dresses/test.jpg`],
    );
    await asUser(u2);
    assert.equal(
      await scalar("select count(*)::integer from storage.objects"),
      0,
    );
    await rejects(
      () =>
        sql(
          "insert into storage.objects(bucket_id,name) values('rental-images',$1)",
          [`${t1}/dresses/attack.jpg`],
        ),
      /row-level security/,
    );
    check("storage folder RLS blocks cross-tenant reads and uploads");
    await db.exec("reset role");
    await sql("update tenants set active=false where id=$1", [t1]);
    await asUser(u1);
    assert.equal(await scalar("select my_tenant()"), null);
    assert.equal(await scalar("select count(*)::integer from bookings"), 0);
    await rejects(() => book(make("2027-06-01")), /UNAUTHORIZED/);
    await rejects(() => updateSettings(), /UNAUTHORIZED/);
    check("disabled account loses access with existing authenticated identity");
    await db.exec("reset role");
    await sql("update tenants set active=true where id=$1", [t1]);
    await asUser(u1);
    const lateBooking = await book(make("2020-01-10", [ids[3]]));
    const lateItem = await scalar(
      "select id from booking_items where booking_id=$1",
      [lateBooking],
    );
    await sql("select transition_item($1,'ready_for_delivery')", [lateItem]);
    await sql("select transition_item($1,'delivered')", [lateItem]);
    await sql("select refresh_notifications()");
    assert.ok(
      Number(
        await scalar(
          "select count(*)::integer from notifications where booking_id=$1 and message like 'تأخر%'",
          [lateBooking],
        ),
      ) > 0,
    );
    const before = await scalar("select count(*)::integer from notifications");
    await sql("select refresh_notifications()");
    assert.equal(
      await scalar("select count(*)::integer from notifications"),
      before,
    );
    check("overdue notifications are date-derived and idempotent");
    await sql("select read_notification(null)");
    assert.equal(
      await scalar(
        "select count(*)::integer from notifications where read_at is null",
      ),
      0,
    );
    check("notification read state persists");
    await sql("select cancel_booking($1)", [companion]);
    assert.equal(
      await scalar("select active from booking_items where booking_id=$1", [
        companion,
      ]),
      false,
    );
    check("cancellation releases reserved dates");
    await rejects(
      () => sql("delete from dresses where id=$1", [ids[0]]),
      /foreign key/,
    );
    check("historical rental records prevent inventory deletion");
    await db.exec("reset role");
    await sql("select set_config('request.jwt.claim.sub','',false)");
    await db.exec("set role anon");
    await rejects(() => sql("select require_tenant()"), /permission denied/);
    await rejects(() => updateSettings(), /permission denied/);
    await rejects(
      () =>
        sql("select provision_shop($1,'x','x','+972599333333',true)", [
          randomUUID(),
        ]),
      /permission denied/,
    );
    check("anonymous callers cannot provision shops or invoke workflows");
    console.log(
      `\n${passed} database checks passed. PostgreSQL engine: PGlite. Live Supabase Auth and Storage HTTP integration still require project credentials.`,
    );
  } finally {
    await db.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

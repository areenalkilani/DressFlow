"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabase, shopSession, superSession } from "@/lib/supabase";
import type { Availability, Quote, RentalInput } from "@/lib/types";

const uuid = z.string().uuid();
const text = z.string().trim().min(1).max(200);
const optional = z.string().trim().max(2000).default("");
const amount = z.coerce.number().min(0).max(99999999);
const phone = z.string().regex(/^\+[1-9]\d{7,14}$/);
const normalizeBookingPhone = (value: string) => {
  let phone = value.trim().replace(/[^\d+]/g, "");
  if (phone.startsWith("00972")) phone = `+${phone.slice(2)}`;
  if (/^9725\d{8}$/.test(phone)) phone = `+${phone}`;
  if (/^05\d{8}$/.test(phone)) phone = `+972${phone.slice(1)}`;
  return phone;
};
const bookingPhone = z
  .string()
  .transform(normalizeBookingPhone)
  .refine((value) => /^\+(?:970|972)5\d{8}$/.test(value));
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const item = z.object({
  dress_id: uuid,
  price: amount.optional(),
  blocked_from: date.optional(),
  blocked_until: date.optional(),
  delivery_date: date.optional(),
  expected_return_date: date.optional(),
});
const bookingSchema = z.object({
  id: uuid.optional(),
  name: text,
  phone: bookingPhone,
  secondary_phone: z
    .string()
    .transform((value) => (value.trim() ? normalizeBookingPhone(value) : ""))
    .refine((value) => !value || /^\+(?:970|972)5\d{8}$/.test(value)),
  city: optional,
  town: optional,
  customer_type: z.enum(["bride", "companion"]),
  event_date: date,
  notes: optional,
  items: z.array(item).min(1).max(50),
  agreed_total: amount.optional(),
  deposit: amount.optional(),
  fitting_at: z.string().datetime({ offset: true }).optional(),
});
function fail(error: { message: string; code?: string } | null) {
  if (!error) return;
  const m = error.message;
  const known: Record<string, string> = {
    DATE_CONFLICT: "هذه البدلة غير متاحة في هذه الفترة.",
    PAYMENT_EXCEEDS_BALANCE: "الدفعة تتجاوز المبلغ المتبقي أو غير صالحة.",
    PRICE_BELOW_PAID: "السعر المتفق عليه أقل من المدفوع.",
    BOOKING_ALREADY_DELIVERED: "لا يمكن تعديل القطع بعد بدء التسليم.",
    RETURN_ITEMS_FIRST: "يجب استلام القطع قبل إلغاء الحجز.",
    INVALID_TRANSITION: "لا يمكن تغيير الحالة بهذه الطريقة.",
    ITEM_NOT_RETURNED: "القطعة لم تُرجع أو لم تنتهِ من التنظيف.",
    ITEM_HIDDEN: "إحدى القطع مخفية.",
    UNAUTHORIZED: "الحساب معطّل أو غير مخوّل.",
  };
  for (const [code, label] of Object.entries(known))
    if (m.includes(code)) throw Error(label);
  if (error.code === "23P01")
    throw Error("هذه البدلة غير متاحة في هذه الفترة.");
  if (error.code === "23505")
    throw Error(
      "هذه البيانات موجودة مسبقاً. تحقق من الرمز أو الهاتف أو الاسم.",
    );
  if (error.code === "23503")
    throw Error("السجل مرتبط ببيانات أخرى. استخدم الإخفاء بدلاً من الحذف.");
  throw Error("تعذر حفظ البيانات. تحقق من القيم والصلاحيات ثم أعد المحاولة.");
}
function refresh() {
  revalidatePath("/", "layout");
}
export async function login(form: FormData) {
  const db = await supabase();
  const password = z.string().min(1).parse(form.get("password"));
  const identifier = String(form.get("identifier")).trim().toLowerCase();
  if (!z.string().email().safeParse(identifier).success)
    return { error: "أدخل بريداً إلكترونياً صحيحاً." };
  const { error } = await db.auth.signInWithPassword({
    email: identifier,
    password,
  });
  if (error)
    return { error: "تعذر تسجيل الدخول. تحقق من بيانات الحساب وحالته." };
  const {
    data: { user },
  } = await db.auth.getUser();
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();
  if (profile?.role === "super_admin") redirect("/admin");
  const { data: tenant } = await db.rpc("my_tenant");
  if (!tenant) {
    await db.auth.signOut();
    return { error: "الحساب معطّل أو غير مخوّل. تواصل مع مدير النظام." };
  }
  redirect("/");
}
export async function logout() {
  const db = await supabase();
  await db.auth.signOut();
  redirect("/login");
}
export async function previewBooking(
  items: RentalInput[],
  event: string,
  town: string,
  type: string,
  id?: string,
): Promise<{ quote: Quote; availability: Availability[] }> {
  const { db } = await shopSession();
  const valid = z.array(item).min(1).max(50).parse(items);
  date.parse(event);
  if (id) uuid.parse(id);
  const results = await Promise.all([
    db.rpc("quote_booking", { p_items: valid, p_event: event }),
    db.rpc("check_availability", {
      p_items: valid,
      p_event: event,
      p_town: town,
      p_type: type,
      p_booking: id ?? null,
    }),
  ]);
  results.forEach((r) => fail(r.error));
  return { quote: results[0].data, availability: results[1].data };
}
export async function checkAvailability(
  items: RentalInput[],
  event: string,
  town = "",
  type = "bride",
  id?: string,
): Promise<Availability[]> {
  const { db } = await shopSession();
  const valid = z.array(item).min(1).max(50).parse(items);
  date.parse(event);
  if (id) uuid.parse(id);
  const { data, error } = await db.rpc("check_availability", {
    p_items: valid,
    p_event: event,
    p_town: town,
    p_type: type,
    p_booking: id ?? null,
  });
  fail(error);
  return data as Availability[];
}
export async function saveBooking(input: unknown) {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    if (
      parsed.error.issues.some((issue) =>
        ["phone", "secondary_phone"].includes(String(issue.path[0])),
      )
    )
      throw Error(
        "أدخلي رقم هاتف فلسطيني صحيحاً: 05XXXXXXXX أو ‎+9725XXXXXXXX.",
      );
    throw Error("تحققي من بيانات الحجز المطلوبة.");
  }
  const p = parsed.data;
  const { db } = await shopSession();
  const { data, error } = await db.rpc("save_booking", { p });
  fail(error);
  refresh();
  return data as string;
}
export async function payment(input: unknown) {
  const p = z
    .object({
      booking_id: uuid,
      amount: amount.positive(),
      payment_date: date,
      note: optional,
    })
    .parse(input);
  const { db } = await shopSession();
  const { error } = await db.rpc("record_payment", {
    p_booking: p.booking_id,
    p_amount: p.amount,
    p_date: p.payment_date,
    p_note: p.note,
  });
  fail(error);
  refresh();
}
export async function transition(id: string, status: string) {
  uuid.parse(id);
  const { db } = await shopSession();
  const { error } = await db.rpc("transition_item", {
    p_item: id,
    p_status: status,
  });
  fail(error);
  refresh();
}
export async function cancelBooking(id: string) {
  uuid.parse(id);
  const { db } = await shopSession();
  const { error } = await db.rpc("cancel_booking", { p_booking: id });
  fail(error);
  refresh();
}
export async function fitting(input: unknown) {
  const p = z
    .object({
      booking_id: uuid,
      scheduled_at: z.string().datetime({ offset: true }),
      status: z.enum(["scheduled", "completed", "cancelled"]),
      notes: optional,
    })
    .parse(input);
  const { db } = await shopSession();
  const { error } = await db.rpc("save_fitting", {
    p_booking: p.booking_id,
    p_at: p.scheduled_at,
    p_status: p.status,
    p_notes: p.notes,
  });
  fail(error);
  refresh();
}
export async function readNotice(id: string | null) {
  if (id) uuid.parse(id);
  const { db } = await shopSession();
  const { error } = await db.rpc("read_notification", { p_id: id });
  fail(error);
  refresh();
}
export async function saveRecord(kind: string, input: unknown) {
  const { db, tenantId } = await shopSession();
  const schemas = {
    categories: z.object({
      id: uuid.optional(),
      name: text,
      visible: z.boolean(),
      image_path: z.string().nullable().optional(),
    }),
    dresses: z.object({
      id: uuid.optional(),
      category_id: uuid,
      code: z
        .string()
        .regex(/^[A-Za-z0-9_-]+$/)
        .max(60),
      name: text,
      color: optional,
      size: optional,
      default_price: amount,
      notes: optional,
      status: z.enum(["available", "cleaning", "out_of_service"]),
      visible: z.boolean(),
      image_path: z.string().nullable().optional(),
    }),
    customers: z.object({
      id: uuid.optional(),
      name: text,
      phone: z.string().trim().min(7).max(30),
      secondary_phone: optional,
      city: optional,
      town: optional,
      notes: optional,
    }),
  };
  if (!(kind in schemas)) throw Error("طلب غير صالح.");
  const p = schemas[kind as keyof typeof schemas].parse(input);
  if (
    "image_path" in p &&
    p.image_path &&
    !p.image_path.startsWith(tenantId + "/")
  )
    throw Error("صورة غير صالحة.");
  const { id, ...values } = p;
  const result = id
    ? await db
        .from(kind)
        .update(values)
        .eq("id", id)
        .eq("tenant_id", tenantId)
        .select("id")
        .single()
    : await db
        .from(kind)
        .insert({ ...values, tenant_id: tenantId })
        .select("id")
        .single();
  fail(result.error);
  refresh();
}
export async function createDressVariants(input: unknown) {
  const p = z
    .object({
      category_id: uuid,
      code: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9_-]{1,55}$/),
      name: text,
      color: optional,
      default_price: amount,
      notes: optional,
      visible: z.boolean(),
      image_path: z.string().nullable().optional(),
      variants: z
        .array(
          z.object({
            size: z.string().trim().min(1).max(100),
            quantity: z.coerce.number().int().min(1).max(50),
          }),
        )
        .min(1)
        .max(50),
    })
    .parse(input);
  const { db, tenantId } = await shopSession();
  if (p.image_path && !p.image_path.startsWith(tenantId + "/"))
    throw Error("صورة غير صالحة.");
  const { data, error } = await db.rpc("create_dress_variants", { p });
  if (error?.code === "PGRST202")
    throw Error("يلزم تطبيق ملف تحديث المخزون رقم 006 في Supabase أولاً.");
  fail(error);
  refresh();
  return data;
}
export async function deleteRecord(kind: string, id: string) {
  if (!["categories", "dresses", "customers"].includes(kind))
    throw Error("طلب غير صالح.");
  uuid.parse(id);
  const { db, tenantId } = await shopSession();
  const { error } = await db
    .from(kind)
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);
  fail(error);
  refresh();
}
export async function saveOffer(input: unknown) {
  const p = z
    .object({
      id: uuid.optional(),
      name: text,
      kind: z.enum(["percentage", "fixed", "bundle"]),
      value: amount,
      min_items: z.coerce.number().int().min(1).max(50),
      starts_on: date,
      ends_on: date,
      active: z.boolean(),
      targets: z
        .array(
          z.object({ dress_id: uuid.optional(), category_id: uuid.optional() }),
        )
        .max(200),
    })
    .parse(input);
  const { db } = await shopSession();
  const { error } = await db.rpc("save_offer", { p });
  fail(error);
  refresh();
}
export async function uploadImage(form: FormData) {
  const { db, tenantId } = await shopSession();
  const file = form.get("file");
  const folder = z
    .enum(["dresses", "categories", "logo"])
    .parse(form.get("folder"));
  if (!(file instanceof File) || file.size > 2 * 1024 * 1024 || !file.size)
    throw Error("حجم الصورة بعد الضغط يجب ألا يتجاوز ٢ ميغابايت.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let ext = "";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ext = "jpg";
  else if (
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71
  )
    ext = "png";
  else if (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    ext = "webp";
  if (!ext) throw Error("اختر صورة JPEG أو PNG أو WebP.");
  const path = `${tenantId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from("rental-images").upload(path, bytes, {
    contentType: ext === "jpg" ? "image/jpeg" : `image/${ext}`,
    upsert: false,
  });
  fail(error);
  return path;
}
export async function saveSettings(input: unknown) {
  const p = z
    .object({
      name: text,
      owner_name: text,
      phone,
      logo_path: z.string().nullable().optional(),
      days_before_event: z.coerce.number().int().min(0).max(60),
      days_after_event: z.coerce.number().int().min(0).max(60),
      fitting_days_before_event: z.coerce.number().int().min(0).max(365),
      same_town_warning_enabled: z.boolean(),
      notifications_enabled: z.boolean(),
      timezone: z.string().max(100),
    })
    .parse(input);
  try {
    new Intl.DateTimeFormat("ar", { timeZone: p.timezone });
  } catch {
    throw Error("المنطقة الزمنية غير صالحة.");
  }
  const { db, tenantId } = await shopSession();
  if (p.logo_path && !p.logo_path.startsWith(tenantId + "/"))
    throw Error("صورة غير صالحة.");
  const { error } = await db.rpc("save_shop_settings", { p });
  if (error?.code === "PGRST202")
    throw Error(
      "يلزم تطبيق ملف تحديث إعدادات الحساب رقم 005 في Supabase أولاً.",
    );
  fail(error);
  refresh();
}
export async function changePassword(input: unknown) {
  const p = z
    .object({
      current: z.string().min(1),
      password: z.string().min(12).max(128),
    })
    .parse(input);
  const { db, user } = await shopSession();
  const { error: check } = await db.auth.signInWithPassword({
    email: user.email!,
    password: p.current,
  });
  if (check) throw Error("كلمة المرور الحالية غير صحيحة.");
  const { error } = await db.auth.updateUser({ password: p.password });
  if (error)
    throw Error("تعذر تغيير كلمة المرور. استخدم كلمة مرور قوية ومختلفة.");
}
export async function changeEmail(
  input: unknown,
): Promise<{ error?: string; message?: string }> {
  const parsed = z
    .object({
      email: z.string().trim().email().toLowerCase(),
      current: z.string().min(1),
    })
    .safeParse(input);
  if (!parsed.success)
    return { error: "أدخلي بريداً إلكترونياً صحيحاً وكلمة المرور الحالية." };
  const { db, user } = await shopSession();
  if (parsed.data.email === user.email)
    return { error: "هذا هو البريد الحالي بالفعل." };
  const { error: check } = await db.auth.signInWithPassword({
    email: user.email!,
    password: parsed.data.current,
  });
  if (check) return { error: "كلمة المرور الحالية غير صحيحة." };
  const origin = (await headers()).get("origin");
  if (!origin)
    return { error: "تعذر تحديد رابط التطبيق. حدّثي الصفحة وأعيدي المحاولة." };
  const { data, error } = await db.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${new URL(origin).origin}/auth/callback` },
  );
  if (error)
    return {
      error:
        "تعذر إرسال طلب تغيير البريد. تحققي من العنوان وإعدادات إرسال البريد في Supabase، ثم حاولي لاحقاً.",
    };
  refresh();
  return {
    message:
      data.user.email === parsed.data.email
        ? "تم تحديث البريد الإلكتروني."
        : "تم طلب تغيير البريد. افتحي رسائل التأكيد في البريد الحالي والجديد لإكماله؛ يبقى بريد الدخول الحالي فعالاً حتى التأكيد.",
  };
}
export async function saveShop(input: unknown) {
  const p = z
    .object({
      id: uuid.optional(),
      name: text,
      owner_name: text,
      phone,
      email: z.string().trim().email().toLowerCase(),
      active: z.boolean(),
      password: z.string().min(12).max(128).optional(),
    })
    .parse(input);
  const { admin } = await superSession();
  if (p.id) {
    const { data: member, error: memberError } = await admin
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", p.id)
      .single();
    fail(memberError);
    // Disable database access before account edits. A failed Auth update leaves the account safely disabled.
    const disabled = await admin
      .from("tenants")
      .update({ active: false })
      .eq("id", p.id);
    fail(disabled.error);
    const { error } = await admin.auth.admin.updateUserById(member!.user_id, {
      email: p.email,
      email_confirm: true,
      ...(p.password ? { password: p.password } : {}),
    });
    if (error)
      throw Error(
        "تعذر تحديث حساب الدخول. بقي الحساب معطلاً؛ تحقق من البريد الإلكتروني وأعد الحفظ.",
      );
    const result = await admin
      .from("tenants")
      .update({
        name: p.name,
        owner_name: p.owner_name,
        phone: p.phone,
        active: p.active,
      })
      .eq("id", p.id);
    if (result.error) {
      fail(result.error);
    }
    await admin
      .from("profiles")
      .update({ name: p.owner_name })
      .eq("id", member!.user_id);
  } else {
    if (!p.password) throw Error("كلمة المرور مطلوبة.");
    const { data, error } = await admin.auth.admin.createUser({
      email: p.email,
      password: p.password,
      email_confirm: true,
    });
    if (error)
      throw Error(
        "تعذر إنشاء حساب الدخول. تحقق من البريد الإلكتروني وعدم استخدامه بحساب آخر.",
      );
    const provision = await admin.rpc("provision_shop", {
      p_user: data.user.id,
      p_name: p.name,
      p_owner: p.owner_name,
      p_phone: p.phone,
      p_active: p.active,
    });
    if (provision.error) {
      await admin.auth.admin.deleteUser(data.user.id);
      fail(provision.error);
    }
  }
  refresh();
}

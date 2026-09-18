import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
export const configured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
export async function supabase() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll(values) {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server components refresh cookies through proxy. */
          }
        },
      },
    },
  );
}
export function adminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw Error("إعداد مفتاح إدارة Supabase مطلوب.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function session() {
  if (!configured()) throw Error("يرجى إعداد اتصال Supabase.");
  const db = await supabase();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw Error("يرجى تسجيل الدخول.");
  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) throw Error("هذا الحساب غير مخوّل.");
  return { db, user, profile };
}
export async function shopSession() {
  const ctx = await session();
  const { data: tenantId, error } = await ctx.db.rpc("my_tenant");
  if (error || !tenantId) throw Error("الحساب معطّل أو غير مخوّل.");
  return { ...ctx, tenantId: tenantId as string };
}
export async function superSession() {
  const ctx = await session();
  if (ctx.profile.role !== "super_admin") throw Error("غير مخوّل.");
  return { ...ctx, admin: adminClient() };
}

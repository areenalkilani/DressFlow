import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
loadEnvConfig(process.cwd());
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!url || !key || !password || password.length < 12)
    throw Error(
      "Provide Supabase URL, service role key and SUPER_ADMIN_PASSWORD (12+ characters) in .env.local.",
    );
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = "areen.alkilani@hotmail.com";
  const { data: existing, error: lookup } = await db
    .from("profiles")
    .select("id")
    .eq("role", "super_admin")
    .maybeSingle();
  if (lookup) throw lookup;
  if (existing) {
    console.log("Super Admin already configured; no password changes made.");
    return;
  }
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const { error: profile } = await db
    .from("profiles")
    .insert({ id: data.user.id, name: "مدير النظام", role: "super_admin" });
  if (profile) {
    await db.auth.admin.deleteUser(data.user.id);
    throw profile;
  }
  console.log(
    "Super Admin created securely. Remove SUPER_ADMIN_PASSWORD from the environment.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

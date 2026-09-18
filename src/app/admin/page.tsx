import { redirect } from "next/navigation";
import { superSession, configured } from "@/lib/supabase";
import { AdminApp } from "@/components/admin-app";
import type { Tenant } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  if (!configured()) redirect("/");
  let ctx;
  try {
    ctx = await superSession();
  } catch {
    redirect("/login");
  }
  const tenants: Tenant[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await ctx.admin
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 499);
    if (error) throw Error("تعذر تحميل المتاجر.");
    tenants.push(...data);
    if (data.length < 500) break;
  }
  const emails = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await ctx.admin.auth.admin.listUsers({
      page,
      perPage: 500,
    });
    if (error) throw Error("تعذر تحميل بريد حسابات المتاجر.");
    for (const user of data.users)
      if (user.email) emails.set(user.id, user.email);
    if (data.users.length < 500) break;
  }
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await ctx.admin
      .from("tenant_users")
      .select("tenant_id,user_id")
      .order("id")
      .range(offset, offset + 499);
    if (error) throw Error("تعذر تحميل حسابات المتاجر.");
    for (const member of data) {
      const tenant = tenants.find((t) => t.id === member.tenant_id);
      if (tenant) tenant.email = emails.get(member.user_id);
    }
    if (data.length < 500) break;
  }
  return <AdminApp tenants={tenants} />;
}

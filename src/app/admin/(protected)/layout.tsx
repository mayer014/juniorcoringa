import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Painel administrativo", robots: { index: false, follow: false } };

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return <AdminShell email={session.email}>{children}</AdminShell>;
}

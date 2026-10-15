import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminShell } from "@/components/admin-shell";
import { getAdminOverview } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";

export default async function AdminPage() {
  const profile = await requireAdmin();
  const overview = await getAdminOverview();
  const generatedAt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok"
  }).format(new Date());

  return (
    <AdminShell
      profile={profile}
      title="Store overview"
      description={`Live data as of ${generatedAt} ICT`}
    >
      <AdminDashboard data={overview.data} error={overview.error} />
    </AdminShell>
  );
}

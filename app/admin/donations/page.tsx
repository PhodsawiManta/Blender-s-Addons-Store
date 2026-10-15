import { AdminDonations } from "@/components/admin-donations";
import { AdminShell } from "@/components/admin-shell";
import { getAdminDonations } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";

export default async function AdminDonationsPage() {
  const profile = await requireAdmin();
  const donations = await getAdminDonations();
  return (
    <AdminShell
      profile={profile}
      title="Donations"
      description="Voluntary USD support for published free add-ons"
    >
      <AdminDonations donations={donations.data} error={donations.error} />
    </AdminShell>
  );
}

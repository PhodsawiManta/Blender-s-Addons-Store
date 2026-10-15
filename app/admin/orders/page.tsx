import { AdminOrders } from "@/components/admin-orders";
import { AdminShell } from "@/components/admin-shell";
import { getAdminOrders } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";

export default async function AdminOrdersPage() {
  const profile = await requireAdmin();
  const orders = await getAdminOrders();
  return (
    <AdminShell profile={profile} title="Orders" description="USD payments and entitlement fulfillment">
      <AdminOrders orders={orders.data} error={orders.error} />
    </AdminShell>
  );
}

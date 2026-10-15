import { AdminProducts } from "@/components/admin-products";
import { AdminShell } from "@/components/admin-shell";
import { getAdminProducts } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";

export default async function AdminProductsPage() {
  const profile = await requireAdmin();
  const products = await getAdminProducts();
  return (
    <AdminShell profile={profile} title="Manage add-ons" description="Create and update your add-ons, download files, and product pages.">
      <AdminProducts products={products.data} error={products.error} />
    </AdminShell>
  );
}

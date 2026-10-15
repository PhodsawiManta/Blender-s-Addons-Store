import { UsersRound } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { getAdminCustomers } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/auth";

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

export default async function AdminCustomersPage() {
  const profile = await requireAdmin();
  const customers = await getAdminCustomers();
  return (
    <AdminShell profile={profile} title="Customers" description="Verified accounts and active add-on ownership">
      {customers.error && (
        <div className="mb-5 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-5 text-amber-300">
          Customer data could not be fully loaded. {customers.error}
        </div>
      )}
      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Customer accounts</p>
            <p className="mt-1 text-[0.62rem] text-zinc-600">{customers.data.totalCount.toLocaleString("en-US")} total</p>
          </div>
          {customers.data.totalCount > customers.data.rows.length && (
            <span className="text-[0.62rem] text-zinc-600">Showing latest {customers.data.rows.length}</span>
          )}
        </div>
        {customers.data.rows.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <UsersRound className="mx-auto text-zinc-700" size={32} strokeWidth={1.3} />
            <p className="mt-4 text-sm font-semibold text-zinc-400">No customer accounts yet.</p>
            <p className="mt-2 text-xs text-zinc-600">Signed-up customer profiles will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-ink/45 text-[0.56rem] uppercase tracking-wider text-zinc-600">
                <tr>{["Customer", "Email", "Active add-ons", "Paid total", "Joined"].map((head) => <th className="px-4 py-3 font-bold" key={head}>{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line text-xs">
                {customers.data.rows.map((customer) => (
                  <tr className="hover:bg-white/[0.02]" key={customer.id}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 place-items-center rounded bg-forge/10 text-forge"><UsersRound size={14} /></span>
                        <b>{customer.displayName}</b>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-zinc-500">{customer.email}</td>
                    <td className="px-4 py-3.5 text-zinc-500">{customer.entitlementCount.toLocaleString("en-US")}</td>
                    <td className="px-4 py-3.5 font-mono text-zinc-400">{formatUsd(customer.paidTotalCents)}</td>
                    <td className="px-4 py-3.5 text-zinc-600">{formatDate(customer.joinedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

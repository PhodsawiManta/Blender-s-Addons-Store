import Link from "next/link";
import { Boxes, CircleDollarSign, Download, ShoppingCart, UsersRound } from "lucide-react";
import type { AdminOverviewData } from "@/lib/admin-data";

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function statusClass(status: string) {
  if (status === "paid") return "bg-emerald-500/10 text-emerald-400";
  if (status === "pending") return "bg-amber-500/10 text-amber-400";
  return "bg-red-500/10 text-red-400";
}

export function AdminDashboard({ data, error }: { data: AdminOverviewData; error: string | null }) {
  const metrics = [
    [CircleDollarSign, formatUsd(data.grossRevenueCents), "Paid revenue"],
    [ShoppingCart, data.orderCount.toLocaleString("en-US"), "Orders"],
    [UsersRound, data.customerCount.toLocaleString("en-US"), "Customers"],
    [Download, data.downloadCount.toLocaleString("en-US"), "Downloads"],
    [Boxes, data.productCount.toLocaleString("en-US"), "Add-ons"]
  ] as const;

  return (
    <>
      <section className="mb-7 rounded-2xl border border-line bg-panel p-5 sm:p-7">
        <h2 className="text-xl font-bold">What would you like to do?</h2>
        <p className="mt-2 text-sm text-zinc-400">Quick access to the tasks you use most.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {[
            ["/admin/products", "Manage add-ons", "Create an add-on, edit its page, or upload a new version."],
            ["/admin/orders", "Review orders", "Check payment status and purchased add-ons."],
            ["/", "View storefront", "See the published catalog your customers see."]
          ].map(([href, title, description]) => <Link key={href} href={href} className="rounded-xl border border-line bg-ink/50 p-5 transition hover:border-forge/50"><h3 className="font-semibold text-forge-soft">{title} →</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p></Link>)}
        </div>
      </section>
      <h2 className="mb-4 text-lg font-semibold">Store at a glance</h2>
      {error && (
        <div className="mb-5 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-5 text-amber-300">
          Some live admin data could not be loaded. {error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([Icon, value, label]) => (
          <div className="rounded-xl border border-line bg-panel p-4" key={label}>
            <span className="grid h-9 w-9 place-items-center rounded-md border border-line bg-ink text-forge"><Icon size={16} /></span>
            <p className="mt-6 text-2xl font-black tracking-tight">{value}</p>
            <p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-wider text-zinc-600">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <section className="overflow-hidden rounded-xl border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div><p className="text-sm font-bold">Recent orders</p><p className="mt-1 text-[0.62rem] text-zinc-600">Latest payment and fulfillment activity</p></div>
            <Link className="button-secondary !min-h-9 !px-3" href="/admin/orders">View all</Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <div className="px-5 py-14 text-center text-xs text-zinc-600">No orders have been created yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left">
                <thead className="bg-ink/50 text-[0.56rem] uppercase tracking-wider text-zinc-600">
                  <tr>{["Order", "Customer", "Products", "Total", "Status", "Created"].map((head) => <th className="px-5 py-3 font-bold" key={head}>{head}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {data.recentOrders.map((order) => (
                    <tr className="hover:bg-white/[0.02]" key={order.id}>
                      <td className="px-5 py-3.5 font-mono text-forge-soft">{shortId(order.id)}</td>
                      <td className="px-5 py-3.5 text-zinc-400">{order.customerEmail}</td>
                      <td className="max-w-56 truncate px-5 py-3.5 text-zinc-400">{order.productSummary}</td>
                      <td className="px-5 py-3.5 text-zinc-300">{formatUsd(order.amountTotalCents)}</td>
                      <td className="px-5 py-3.5"><span className={`rounded px-2 py-1 text-[0.56rem] font-bold uppercase ${statusClass(order.status)}`}>{order.status}</span></td>
                      <td className="px-5 py-3.5 text-zinc-600">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-bold">Most downloaded</p><p className="mt-1 text-[0.62rem] text-zinc-600">Based on recorded downloads</p></div>
            <Boxes size={16} className="text-zinc-600" />
          </div>
          {data.topProducts.length === 0 ? (
            <div className="py-14 text-center text-xs text-zinc-600">No add-ons have been created yet.</div>
          ) : (
            <div className="mt-4 divide-y divide-line">
              {data.topProducts.map((product, index) => (
                <div className="flex items-center gap-3 py-3" key={product.id}>
                  <span className="grid h-7 w-7 place-items-center rounded bg-ink text-[0.62rem] font-black text-zinc-600">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{product.title}</p>
                    <p className="mt-1 text-[0.58rem] text-zinc-600">{product.status.toLowerCase()} · {product.version ? `v${product.version}` : "no version"}</p>
                  </div>
                  <span className="flex items-center gap-1 text-[0.62rem] text-zinc-500"><Download size={11} />{product.downloadCount.toLocaleString("en-US")}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

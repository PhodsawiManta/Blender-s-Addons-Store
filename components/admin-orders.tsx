"use client";

import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { AdminOrderRow } from "@/lib/admin-data";

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
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function statusClass(status: AdminOrderRow["status"]) {
  if (status === "paid") return "bg-emerald-500/10 text-emerald-400";
  if (status === "pending") return "bg-amber-500/10 text-amber-400";
  return "bg-red-500/10 text-red-400";
}

function csvCell(value: string | number) {
  const raw = String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll("\"", "\"\"")}"`;
}

export function AdminOrders({ orders, error }: { orders: AdminOrderRow[]; error: string | null }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((order) => [
      order.id,
      order.customerEmail,
      order.productSummary,
      order.status
    ].join(" ").toLowerCase().includes(needle));
  }, [orders, query]);

  function exportCsv() {
    const header = ["Order ID", "Customer", "Products", "Item count", "Currency", "Total cents", "Status", "Created"];
    const rows = filtered.map((order) => [
      order.id,
      order.customerEmail,
      order.productSummary,
      order.itemCount,
      "USD",
      order.amountTotalCents,
      order.status,
      order.createdAt
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `aoupa-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {error && (
        <div className="mb-5 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-5 text-amber-300">
          Orders could not be fully loaded. {error}
        </div>
      )}
      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
            <input className="field !min-h-9 !pl-9 text-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, email, or product..." />
          </label>
          <button className="button-secondary !min-h-9" disabled={filtered.length === 0} onClick={exportCsv} type="button"><Download size={14} /> Export CSV</button>
        </div>
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-sm font-semibold text-zinc-400">{orders.length === 0 ? "No orders yet." : "No matching orders."}</p>
            <p className="mt-2 text-xs text-zinc-600">{orders.length === 0 ? "Free add-on claims do not create payment orders." : "Try a different search term."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-ink/45 text-[0.56rem] uppercase tracking-wider text-zinc-600">
                <tr>{["Order", "Customer", "Products", "Items", "Currency", "Total", "Status", "Created"].map((head) => <th className="px-4 py-3 font-bold" key={head}>{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line text-xs">
                {filtered.map((order) => (
                  <tr className="hover:bg-white/[0.02]" key={order.id}>
                    <td className="px-4 py-3.5 font-mono text-forge-soft">{shortId(order.id)}</td>
                    <td className="px-4 py-3.5 text-zinc-500">{order.customerEmail}</td>
                    <td className="max-w-64 truncate px-4 py-3.5 text-zinc-500">{order.productSummary}</td>
                    <td className="px-4 py-3.5 text-zinc-500">{order.itemCount}</td>
                    <td className="px-4 py-3.5 text-zinc-500">USD</td>
                    <td className="px-4 py-3.5 font-mono text-zinc-300">{formatUsd(order.amountTotalCents)}</td>
                    <td className="px-4 py-3.5"><span className={`rounded px-2 py-1 text-[0.54rem] font-bold uppercase ${statusClass(order.status)}`}>{order.status}</span></td>
                    <td className="px-4 py-3.5 text-zinc-600">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

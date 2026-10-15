"use client";

import { Download, HandHeart, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { AdminDonationRow } from "@/lib/admin-data";

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

function statusClass(status: AdminDonationRow["status"]) {
  if (status === "paid") return "bg-emerald-500/10 text-emerald-400";
  if (status === "pending") return "bg-amber-500/10 text-amber-400";
  return "bg-red-500/10 text-red-400";
}

function csvCell(value: string | number) {
  const raw = String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll("\"", "\"\"")}"`;
}

export function AdminDonations({
  donations,
  error
}: {
  donations: AdminDonationRow[];
  error: string | null;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return donations;
    return donations.filter((donation) => [
      donation.id,
      donation.customerEmail,
      donation.productTitle,
      donation.status
    ].join(" ").toLowerCase().includes(needle));
  }, [donations, query]);
  const paidTotal = donations
    .filter((donation) => donation.status === "paid")
    .reduce((sum, donation) => sum + donation.amountTotalCents, 0);

  function exportCsv() {
    const header = ["Donation ID", "Customer", "Add-on", "Currency", "Amount cents", "Status", "Created"];
    const rows = filtered.map((donation) => [
      donation.id,
      donation.customerEmail,
      donation.productTitle,
      "USD",
      donation.amountTotalCents,
      donation.status,
      donation.createdAt
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `aoupa-donations-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {error && (
        <div className="mb-5 rounded-md border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-300">
          Donations could not be loaded. {error}
        </div>
      )}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-panel p-4">
          <HandHeart className="text-forge" size={17} />
          <p className="mt-5 text-2xl font-black">{formatUsd(paidTotal)}</p>
          <p className="mt-1 text-[0.62rem] uppercase tracking-wider text-zinc-600">Paid donations</p>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <HandHeart className="text-forge" size={17} />
          <p className="mt-5 text-2xl font-black">{donations.filter((item) => item.status === "paid").length}</p>
          <p className="mt-1 text-[0.62rem] uppercase tracking-wider text-zinc-600">Successful supporters</p>
        </div>
      </div>
      <section className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:justify-between">
          <label className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
            <input className="field !min-h-9 !pl-9 text-xs" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search donation, email, or add-on..." />
          </label>
          <button className="button-secondary !min-h-9" disabled={filtered.length === 0} onClick={exportCsv} type="button">
            <Download size={14} /> Export CSV
          </button>
        </div>
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-zinc-500">No donations yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-ink/45 text-[0.56rem] uppercase tracking-wider text-zinc-600">
                <tr>{["Donation", "Customer", "Add-on", "Amount", "Status", "Created"].map((head) => <th className="px-4 py-3 font-bold" key={head}>{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line text-xs">
                {filtered.map((donation) => (
                  <tr className="hover:bg-white/[0.02]" key={donation.id}>
                    <td className="px-4 py-3.5 font-mono text-forge-soft">{donation.id.slice(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-3.5 text-zinc-500">{donation.customerEmail}</td>
                    <td className="px-4 py-3.5 text-zinc-400">{donation.productTitle}</td>
                    <td className="px-4 py-3.5 font-mono text-zinc-300">{formatUsd(donation.amountTotalCents)}</td>
                    <td className="px-4 py-3.5"><span className={`rounded px-2 py-1 text-[0.54rem] font-bold uppercase ${statusClass(donation.status)}`}>{donation.status}</span></td>
                    <td className="px-4 py-3.5 text-zinc-600">{formatDate(donation.createdAt)}</td>
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

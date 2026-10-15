import { CheckCircle2, CircleAlert, CircleOff, Globe2 } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/auth";
import { env, hasStripe, hasSupabaseAdmin } from "@/lib/env";

type IntegrationState = "configured" | "incomplete" | "disabled";

function StateBadge({ state }: { state: IntegrationState }) {
  if (state === "configured") {
    return <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 text-[0.54rem] font-bold uppercase text-emerald-400"><CheckCircle2 size={11} />Configured</span>;
  }
  if (state === "disabled") {
    return <span className="flex items-center gap-1 rounded bg-zinc-500/10 px-2 py-1 text-[0.54rem] font-bold uppercase text-zinc-500"><CircleOff size={11} />Disabled</span>;
  }
  return <span className="flex items-center gap-1 rounded bg-amber-500/10 px-2 py-1 text-[0.54rem] font-bold uppercase text-amber-400"><CircleAlert size={11} />Incomplete</span>;
}

export default async function AdminSettingsPage() {
  const profile = await requireAdmin();
  const integrations: Array<{
    name: string;
    description: string;
    state: IntegrationState;
  }> = [
    {
      name: "Supabase",
      description: "Authentication, database, and private product files",
      state: hasSupabaseAdmin ? "configured" : "incomplete"
    },
    {
      name: "Stripe",
      description: "Hosted USD checkout and verified payment webhooks",
      state: hasStripe ? "configured" : "incomplete"
    },
    {
      name: "Paid checkout",
      description: "Paid USD product publishing and checkout feature flag",
      state: env.paidCheckoutEnabled ? (hasStripe ? "configured" : "incomplete") : "disabled"
    }
  ];

  return (
    <AdminShell profile={profile} title="Settings" description="Store identity and server-side integration readiness">
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-xl border border-line bg-panel p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md border border-line bg-ink text-forge"><Globe2 size={18} /></span>
            <div><p className="text-sm font-bold">Aoupa</p><p className="mt-1 text-[0.62rem] text-zinc-600">Production store identity</p></div>
          </div>
          <dl className="mt-6 grid gap-4 text-xs">
            <div className="rounded-lg border border-line bg-ink p-4"><dt className="text-[0.58rem] font-bold uppercase tracking-wider text-zinc-600">Canonical domain</dt><dd className="mt-2 text-zinc-300">https://aoupa.online</dd></div>
            <div className="rounded-lg border border-line bg-ink p-4"><dt className="text-[0.58rem] font-bold uppercase tracking-wider text-zinc-600">Store currency</dt><dd className="mt-2 text-zinc-300">USD only</dd></div>
            <div className="rounded-lg border border-line bg-ink p-4"><dt className="text-[0.58rem] font-bold uppercase tracking-wider text-zinc-600">Current release model</dt><dd className="mt-2 text-zinc-300">Free and paid Blender add-ons with account ownership</dd></div>
          </dl>
        </section>
        <section className="rounded-xl border border-line bg-panel p-5">
          <p className="text-sm font-bold">Integration status</p>
          <p className="mt-1 text-[0.62rem] text-zinc-600">Values reflect the current server environment; secrets are never displayed.</p>
          <div className="mt-5 grid gap-3">
            {integrations.map((integration) => (
              <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-ink p-4" key={integration.name}>
                <div><b className="text-xs">{integration.name}</b><p className="mt-1 text-[0.6rem] leading-4 text-zinc-600">{integration.description}</p></div>
                <StateBadge state={integration.state} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

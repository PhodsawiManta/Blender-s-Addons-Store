export function LegalPage({ eyebrow, title, updated, children }: { eyebrow: string; title: string; updated: string; children: React.ReactNode }) {
  return (
    <section className="shell grid gap-10 py-16 lg:grid-cols-[260px_1fr]">
      <aside>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="section-title mt-4">{title}</h1>
        <p className="mt-4 text-[0.66rem] text-zinc-600">Last updated {updated}</p>
      </aside>
      <article className="max-w-3xl rounded-xl border border-line bg-panel p-6 text-sm leading-7 text-zinc-400 sm:p-9 [&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-white [&_h2:first-child]:mt-0 [&_p]:mb-4 [&_ul]:mb-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </article>
    </section>
  );
}

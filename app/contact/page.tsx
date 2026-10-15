import type { Metadata } from "next";
import { Mail, MessageCircleQuestion, ReceiptText } from "lucide-react";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = { title: "Contact & Support" };

export default function ContactPage() {
  return (
    <section className="shell grid gap-10 py-16 lg:grid-cols-[.68fr_1.32fr]">
      <div>
        <p className="eyebrow">Support</p>
        <h1 className="section-title mt-4">Let&apos;s solve it.</h1>
        <p className="mt-5 max-w-sm text-sm leading-6 text-zinc-500">Tell us what you&apos;re building and where you got stuck. A real person will read it.</p>
        <div className="mt-8 grid gap-3">
          {[[Mail, "General", "No contact information available"], [MessageCircleQuestion, "Product support", "No contact information available"], [ReceiptText, "Orders", "No contact information available"]].map(([Icon, label, email]) => {
            const ContactIcon = Icon as typeof Mail;
            return <div className="flex items-center gap-3 rounded-lg border border-line bg-panel p-4" key={label as string}><span className="grid h-9 w-9 place-items-center rounded bg-ink text-forge"><ContactIcon size={15} /></span><div><p className="text-xs font-bold">{label as string}</p><p className="mt-1 text-[0.62rem] text-zinc-600">{email as string}</p></div></div>;
          })}
        </div>
        {/* <div className="mt-8 grid gap-3">
          {[[Mail, "General", "hello@aoupa.online"], [MessageCircleQuestion, "Product support", "support@aoupa.online"], [ReceiptText, "Orders", "orders@aoupa.online"]].map(([Icon, label, email]) => {
            const ContactIcon = Icon as typeof Mail;
            return <div className="flex items-center gap-3 rounded-lg border border-line bg-panel p-4" key={label as string}><span className="grid h-9 w-9 place-items-center rounded bg-ink text-forge"><ContactIcon size={15} /></span><div><p className="text-xs font-bold">{label as string}</p><p className="mt-1 text-[0.62rem] text-zinc-600">{email as string}</p></div></div>;
          })}
        </div> */}
      </div>
      <ContactForm />
    </section>
  );
}

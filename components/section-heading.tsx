import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeading({ eyebrow, title, description, href, linkLabel }: {
  eyebrow: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="section-title mt-4 max-w-3xl text-balance">{title}</h2>
        {description && <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500">{description}</p>}
      </div>
      {href && (
        <Link className="button-secondary w-fit shrink-0" href={href}>
          {linkLabel ?? "Explore all"}<ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}

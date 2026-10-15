import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Legal" title="Terms of use." updated="July 23, 2026">
      <h2>License</h2>
      <p>Claiming or purchasing an add-on gives one individual a non-transferable license to install and use it in personal and commercial projects. The add-on itself may not be redistributed, resold, or shared.</p>
      <h2>Accounts</h2>
      <p>You are responsible for keeping account credentials secure. We may suspend access where there is evidence of fraud, automated abuse, or unauthorized sharing.</p>
      <h2>Compatibility</h2>
      <p>Supported Blender versions are listed on each product page. We aim to maintain compatibility but cannot guarantee support for unreleased or modified builds.</p>
      <h2>Blender trademark</h2>
      <p>Aoupa is an independent store and is not affiliated with, sponsored by, or endorsed by the Blender Foundation.</p>
    </LegalPage>
  );
}

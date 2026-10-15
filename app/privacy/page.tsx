import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy policy." updated="July 23, 2026">
      <h2>Information we collect</h2>
      <p>We collect account details, product ownership, download records, support messages, and the technical information needed to keep Aoupa secure and reliable.</p>
      <h2>How we use information</h2>
      <ul><li>Deliver products and updates.</li><li>Process future payments and prevent fraud.</li><li>Respond to support and improve the service.</li><li>Meet legal and accounting obligations.</li></ul>
      <h2>Service providers</h2>
      <p>Supabase provides authentication, database, and file storage. Stripe processes payments when paid checkout is enabled. Each provider handles information under its own privacy terms.</p>
      <h2>Your choices</h2>
      <p>You may request a copy, correction, or deletion of your personal information by contacting privacy@aoupa.online. Some transaction records must be retained where required by law.</p>
      <h2>Security</h2>
      <p>Private downloads use short-lived signed URLs. Administrative actions are checked on the server and protected by role-based access policies.</p>
    </LegalPage>
  );
}

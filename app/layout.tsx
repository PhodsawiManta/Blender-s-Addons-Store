import type { Metadata } from "next";
import "@/app/globals.css";
import { Providers } from "@/components/providers";
import { SiteChrome } from "@/components/site-chrome";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://aoupa.online"),
  title: {
    default: "Aoupa - Blender add-ons",
    template: "%s - Aoupa"
  },
  description: "Production-ready Blender add-ons with secure downloads and dependable updates.",
  keywords: ["Blender add-ons", "3D modeling", "Blender tools"],
  openGraph: {
    title: "Aoupa - Blender add-ons",
    description: "Production-ready Blender add-ons with secure downloads.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}

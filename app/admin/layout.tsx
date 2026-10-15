import { redirect } from "next/navigation";
import {
  AdminRequiredError,
  AuthenticationRequiredError,
  requireAdmin
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/auth?next=%2Fadmin");
    }
    if (error instanceof AdminRequiredError) {
      redirect("/library?notice=admin-required");
    }
    throw error;
  }

  return children;
}

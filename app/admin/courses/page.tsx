import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

export default async function AdminCoursesPage() {
  await requireAdmin();
  redirect("/admin/products");
}

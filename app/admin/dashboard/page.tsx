import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/session";
import AdminDashboard from "./AdminDashboard";

export default async function AdminDashboardPage() {
  // Check if user is authenticated
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect("/admin");
  }

  return <AdminDashboard />;
}

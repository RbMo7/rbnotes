import { getOptionalUser } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard/Dashboard";

export default async function RootPage() {
  const user = await getOptionalUser();
  return <Dashboard email={user?.email ?? null} />;
}

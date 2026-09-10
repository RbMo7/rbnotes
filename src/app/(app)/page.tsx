import { getAuthedUser } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard/Dashboard";

export default async function RootPage() {
  const user = await getAuthedUser();
  return <Dashboard email={user.email} />;
}

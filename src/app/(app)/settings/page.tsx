import { getAuthedUser } from "@/lib/auth";
import { SettingsView } from "@/components/settings/SettingsView";

export default async function SettingsPage() {
  // Only the email is genuinely page-specific here; the settings values
  // themselves come from the shared workspace store (seeded once by
  // SettingsHydrator in (app)/layout.tsx) so this page and an already-open
  // note editor can never show two different, independently-fetched
  // copies of the same settings.
  const user = await getAuthedUser();
  return <SettingsView email={user.email} />;
}

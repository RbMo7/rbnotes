import { getOptionalUser } from "@/lib/auth";
import { SettingsView } from "@/components/settings/SettingsView";

export default async function SettingsPage() {
  // Only the email is genuinely page-specific here; the settings values
  // themselves come from the shared workspace store (seeded once by
  // SettingsHydrator in (app)/layout.tsx) so this page and an already-open
  // note editor can never show two different, independently-fetched
  // copies of the same settings. Optional, not redirecting: editor
  // preferences are a free-tier feature too, not account data (ADR 0002).
  const user = await getOptionalUser();
  return <SettingsView email={user?.email ?? null} />;
}

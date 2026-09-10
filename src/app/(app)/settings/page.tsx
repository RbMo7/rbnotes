import { getAuthedUser } from "@/lib/auth";
import { settingsSchema, defaultSettings } from "@/lib/schemas";
import { SettingsView } from "@/components/settings/SettingsView";

export default async function SettingsPage() {
  const user = await getAuthedUser();
  const parsed = settingsSchema.safeParse(user.settings);
  const settings = parsed.success ? parsed.data : defaultSettings;

  return <SettingsView email={user.email} initialSettings={settings} />;
}

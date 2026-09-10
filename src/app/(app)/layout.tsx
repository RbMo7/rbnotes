import { getAuthedUser } from "@/lib/auth";
import { listNotesForSidebar } from "@/lib/notes";
import { Sidebar } from "@/components/shell/Sidebar";
import { AppShell } from "@/components/shell/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthedUser();
  const notes = await listNotesForSidebar(user.id);

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface select-none antialiased min-h-screen">
      <Sidebar notes={notes} />
      <AppShell email={user.email} notes={notes}>
        {children}
      </AppShell>
    </div>
  );
}

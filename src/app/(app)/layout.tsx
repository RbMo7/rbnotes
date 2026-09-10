import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getAuthedUser } from "@/lib/auth";
import { listAllNotesFull } from "@/lib/notes";
import { settingsSchema, defaultSettings } from "@/lib/schemas";
// Imported from note-types, not notes-query -- notes-query.ts is a "use
// client" module, and a Server Component importing a plain constant from
// one gets an opaque client reference instead of the real array (see
// note-types.ts for the full explanation). note-types.ts has no directive,
// so this is the actual value.
import { notesQueryKey } from "@/lib/note-types";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SettingsHydrator } from "@/components/shell/SettingsHydrator";
import { Sidebar } from "@/components/shell/Sidebar";
import { AppShell } from "@/components/shell/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthedUser();

  // The one real fetch the whole app is built on: every note, full
  // content, once. Prefetched here (server-side, scoped to this user) and
  // handed to the client as already-hydrated query cache -- everything
  // downstream (sidebar, editor, tags, graph, search) reads this same
  // cache and never re-fetches per click. See lib/notes-query.ts.
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: notesQueryKey,
    queryFn: () => listAllNotesFull(user.id),
  });

  const parsedSettings = settingsSchema.safeParse(user.settings);
  const settings = parsedSettings.success ? parsedSettings.data : defaultSettings;

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface select-none antialiased min-h-screen">
      <QueryProvider>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <SettingsHydrator settings={settings} />
          <Sidebar />
          <AppShell email={user.email}>{children}</AppShell>
        </HydrationBoundary>
      </QueryProvider>
    </div>
  );
}

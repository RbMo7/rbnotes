import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getAuthedUser } from "@/lib/auth";
import { listAllNotesMeta } from "@/lib/notes";
import { settingsSchema, defaultSettings } from "@/lib/schemas";
// Imported from note-types, not notes-query -- notes-query.ts is a "use
// client" module, and a Server Component importing a plain constant from
// one gets an opaque client reference instead of the real array (see
// note-types.ts for the full explanation). note-types.ts has no directive,
// so this is the actual value.
import { notesQueryKey } from "@/lib/note-types";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SettingsHydrator } from "@/components/shell/SettingsHydrator";
import { WorkspaceProvider } from "@/components/workspace/WorkspaceProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthedUser();

  // First paint blocks on this and only this: every note's metadata, no
  // content. Prefetched here (server-side, scoped to this user) and handed
  // to the client as already-hydrated query cache -- the sidebar orients
  // instantly from it, and each note's content warms in separately (on
  // open, or via the background warm-up loop) once the shell has mounted.
  // See lib/notes-query.ts.
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: notesQueryKey,
    queryFn: () => listAllNotesMeta(user.id),
  });

  const parsedSettings = settingsSchema.safeParse(user.settings);
  const settings = parsedSettings.success ? parsedSettings.data : defaultSettings;

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface select-none antialiased min-h-screen">
      <QueryProvider>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <SettingsHydrator settings={settings} />
          <WorkspaceProvider email={user.email}>{children}</WorkspaceProvider>
        </HydrationBoundary>
      </QueryProvider>
    </div>
  );
}

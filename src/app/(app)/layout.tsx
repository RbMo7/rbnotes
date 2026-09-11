import type { Metadata } from "next";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getOptionalUser } from "@/lib/auth";
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

// Everything under this layout is a signed-in user's private workspace --
// never meant to be indexed, regardless of what robots.ts already tells
// crawlers not to fetch. Applies to every route in this group (/, /notes/*,
// /settings) since Next.js metadata is inherited down from a layout.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Optional, not redirecting: an anonymous session gets a fully-featured
  // Local-only workspace (CONTEXT.md), never bounced to /login. See ADR
  // 0002 -- presence of a session is what turns Local-only notes into
  // Synced notes, not a requirement to use the app at all.
  const user = await getOptionalUser();

  // First paint blocks on this and only this: every note's metadata, no
  // content. Prefetched here (server-side, scoped to this user) and handed
  // to the client as already-hydrated query cache -- the sidebar orients
  // instantly from it, and each note's content warms in separately (on
  // open, or via the background warm-up loop) once the shell has mounted.
  // See lib/notes-query.ts. An anonymous session has nothing to prefetch
  // here -- its notes live in the Local store instead, hydrated client-side.
  const queryClient = new QueryClient();
  if (user) {
    await queryClient.prefetchQuery({
      queryKey: notesQueryKey,
      queryFn: () => listAllNotesMeta(user.id),
    });
  }

  const parsedSettings = user ? settingsSchema.safeParse(user.settings) : null;
  const settings = parsedSettings?.success ? parsedSettings.data : defaultSettings;

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface select-none antialiased min-h-screen">
      <QueryProvider>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <SettingsHydrator settings={settings} syncEnabled={!!user} userId={user?.id ?? null} />
          <WorkspaceProvider email={user?.email ?? null}>{children}</WorkspaceProvider>
        </HydrationBoundary>
      </QueryProvider>
    </div>
  );
}

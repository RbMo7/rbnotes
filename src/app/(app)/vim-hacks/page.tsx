import { VimHacksView } from "@/components/vim-hacks/VimHacksView";

// Static reference content, not account data (same trust level as
// robots.ts/sitemap.ts) -- no getOptionalUser() needed, unlike
// settings/page.tsx which needs the signed-in email for its own body.
export default function VimHacksPage() {
  return <VimHacksView />;
}

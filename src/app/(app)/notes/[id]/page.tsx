/**
 * Entry/deep-link only (see ADR-0001) -- this route's job ends the moment
 * the page loads. WorkspaceProvider (mounted above this in (app)/layout.tsx)
 * reads the id straight from the URL via usePathname() to seed its initial
 * state, and every switch after that is client-side history, never a
 * navigation back through this route. There is nothing left to render here.
 */
export default function NotePage() {
  return null;
}

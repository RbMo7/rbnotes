/**
 * Shared responsive shape for the app's centered overlay dialogs (Quick
 * Switcher, Search): full-screen below the `sm` breakpoint, the original
 * centered floating panel at `sm` and up. Presentational details that
 * deliberately differ between them (QuickSwitcher's zero elevation vs
 * Search's shadow) stay local to each file.
 */
export const RESPONSIVE_DIALOG_CONTENT =
  "fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-[20vh] sm:-translate-x-1/2 w-full sm:w-[90vw] h-full sm:h-auto sm:max-w-[38rem] bg-surface-container border border-outline-variant z-[61] font-code-editor text-code-editor flex flex-col";

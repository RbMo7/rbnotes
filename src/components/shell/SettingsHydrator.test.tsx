// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { useWorkspaceStore } from "@/lib/store";
import { defaultSettings, type Settings } from "@/lib/schemas";

const mocks = vi.hoisted(() => ({ loadLocalSettings: vi.fn() }));

vi.mock("@/lib/local-settings", () => ({ loadLocalSettings: mocks.loadLocalSettings }));

import { SettingsHydrator } from "@/components/shell/SettingsHydrator";

const syncedSettings: Settings = { ...defaultSettings, theme: "dark" };

afterEach(cleanup);

/**
 * Integration-level: this component's whole job is timing (what runs
 * synchronously on mount vs. what re-runs on a later prop change without a
 * remount), which has no pure-function core to extract -- render it for
 * real and assert against the shared store, the same way
 * save-state.integration.test.tsx exercises useAutosave through the real
 * command-dispatch seam instead of unit-testing pieces of it in isolation.
 */
describe("SettingsHydrator", () => {
  beforeEach(() => {
    mocks.loadLocalSettings.mockReset().mockReturnValue(null);
    useWorkspaceStore.setState({
      settings: defaultSettings,
      syncEnabled: false,
      currentUserId: null,
    });
  });

  it("seeds settings/syncEnabled/currentUserId from server-safe props on first mount", () => {
    render(<SettingsHydrator settings={syncedSettings} syncEnabled={true} userId="user-1" />);

    expect(useWorkspaceStore.getState().settings).toEqual(syncedSettings);
    expect(useWorkspaceStore.getState().syncEnabled).toBe(true);
    expect(useWorkspaceStore.getState().currentUserId).toBe("user-1");
  });

  it("regression: syncEnabled/currentUserId re-sync on a later prop change without a remount -- a soft sign-out route refresh doesn't unmount this component", () => {
    const { rerender } = render(
      <SettingsHydrator settings={syncedSettings} syncEnabled={true} userId="user-1" />,
    );
    expect(useWorkspaceStore.getState().syncEnabled).toBe(true);

    // Sign-out: the layout re-renders with a null user, same component
    // instance (no key change, no unmount) -- exactly what a Next.js
    // Server Action's route refresh does.
    rerender(<SettingsHydrator settings={defaultSettings} syncEnabled={false} userId={null} />);

    expect(useWorkspaceStore.getState().syncEnabled).toBe(false);
    expect(useWorkspaceStore.getState().currentUserId).toBeNull();
  });

  it("overlays real Local-only settings from loadLocalSettings via the effect, not the synchronous seed", () => {
    const localOnlyTheme: Settings = { ...defaultSettings, theme: "light" };
    mocks.loadLocalSettings.mockReturnValue(localOnlyTheme);

    render(<SettingsHydrator settings={defaultSettings} syncEnabled={false} userId={null} />);

    expect(useWorkspaceStore.getState().settings).toEqual(localOnlyTheme);
  });

  it("a Synced session never calls loadLocalSettings -- server-provided settings are authoritative", () => {
    render(<SettingsHydrator settings={syncedSettings} syncEnabled={true} userId="user-1" />);
    expect(mocks.loadLocalSettings).not.toHaveBeenCalled();
  });

  it("applies data-theme to <html> and keeps it in sync with the active theme", () => {
    const { rerender } = render(
      <SettingsHydrator settings={syncedSettings} syncEnabled={true} userId="user-1" />,
    );
    expect(document.documentElement.dataset.theme).toBe("dark");

    rerender(
      <SettingsHydrator
        settings={{ ...syncedSettings, theme: "light" }}
        syncEnabled={true}
        userId="user-1"
      />,
    );
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

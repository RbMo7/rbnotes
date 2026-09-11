// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkspaceStore } from "@/lib/store";

const mocks = vi.hoisted(() => ({
  purgeSyncedNotes: vi.fn(),
  signOutAction: vi.fn(),
}));

vi.mock("@/lib/local-notes-store", () => ({ purgeSyncedNotes: mocks.purgeSyncedNotes }));
vi.mock("@/server/actions/auth", () => ({ signOutAction: mocks.signOutAction }));

import { useSignOut } from "@/lib/use-sign-out";

/**
 * Integration-level, same reasoning as SettingsHydrator.test.tsx -- this
 * is pure orchestration/timing (flush, then purge, then sign out; a
 * bounded best-effort wait, not a blocking one) with no separable pure
 * logic to unit test in isolation.
 */
describe("useSignOut", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.purgeSyncedNotes.mockReset().mockResolvedValue(undefined);
    mocks.signOutAction.mockReset().mockResolvedValue(undefined);
    useWorkspaceStore.setState({ currentUserId: "user-1", flushAllDirty: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("flushes pending dirty notes, then purges this account's synced notes, then signs out -- in that order", async () => {
    const order: string[] = [];
    const flushAllDirty = vi.fn(async () => {
      order.push("flush");
    });
    mocks.purgeSyncedNotes.mockImplementation(async () => {
      order.push("purge");
    });
    mocks.signOutAction.mockImplementation(async () => {
      order.push("signOut");
    });
    useWorkspaceStore.setState({ flushAllDirty });

    const { result } = renderHook(() => useSignOut());
    await act(async () => {
      result.current();
      await vi.runAllTimersAsync();
    });

    expect(order).toEqual(["flush", "purge", "signOut"]);
    expect(mocks.purgeSyncedNotes).toHaveBeenCalledWith("user-1");
  });

  it("proceeds with sign-out even if nothing is registered to flush (no buffer mounted -- nothing dirty anyway)", async () => {
    const { result } = renderHook(() => useSignOut());
    await act(async () => {
      result.current();
      await vi.runAllTimersAsync();
    });

    expect(mocks.purgeSyncedNotes).toHaveBeenCalledWith("user-1");
    expect(mocks.signOutAction).toHaveBeenCalledOnce();
  });

  it("times out a hanging flush instead of blocking sign-out forever", async () => {
    const flushAllDirty = vi.fn(() => new Promise<void>(() => {})); // never resolves
    useWorkspaceStore.setState({ flushAllDirty });

    const { result } = renderHook(() => useSignOut());
    await act(async () => {
      result.current();
      await vi.advanceTimersByTimeAsync(2100);
    });

    expect(mocks.purgeSyncedNotes).toHaveBeenCalledWith("user-1");
    expect(mocks.signOutAction).toHaveBeenCalledOnce();
  });

  it("does not purge (or need a userId) when there's no current account -- nothing to purge for an anonymous session", async () => {
    useWorkspaceStore.setState({ currentUserId: null, flushAllDirty: null });

    const { result } = renderHook(() => useSignOut());
    await act(async () => {
      result.current();
      await vi.runAllTimersAsync();
    });

    expect(mocks.purgeSyncedNotes).not.toHaveBeenCalled();
    expect(mocks.signOutAction).toHaveBeenCalledOnce();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getOrCreateDeviceId: vi.fn(),
  pingDeviceAction: vi.fn(),
}));

vi.mock("@/lib/local-notes-store", () => ({ getOrCreateDeviceId: mocks.getOrCreateDeviceId }));
vi.mock("@/server/actions/device", () => ({ pingDeviceAction: mocks.pingDeviceAction }));

import { DeviceTracking } from "@/components/shell/DeviceTracking";

describe("DeviceTracking", () => {
  beforeEach(() => {
    mocks.getOrCreateDeviceId.mockReset().mockResolvedValue("device-123");
    mocks.pingDeviceAction.mockReset().mockResolvedValue(undefined);
  });

  it("pings the server once on mount with this browser's device id", async () => {
    await act(async () => {
      render(<DeviceTracking />);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.pingDeviceAction).toHaveBeenCalledWith({ deviceId: "device-123" });
    cleanup();
  });
});

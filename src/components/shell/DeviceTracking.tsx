"use client";

import { useEffect } from "react";
import { getOrCreateDeviceId } from "@/lib/local-notes-store";
import { pingDeviceAction } from "@/server/actions/device";

/**
 * Counts a Device's (CONTEXT.md) free-tier usage without requiring sign-in.
 * Mounted only for an anonymous session (see WorkspaceProvider) -- once a
 * session is signed in, the account itself is the usage signal and this
 * stops mounting.
 */
export function DeviceTracking() {
  useEffect(() => {
    void (async () => {
      const deviceId = await getOrCreateDeviceId();
      await pingDeviceAction({ deviceId });
    })().catch(() => {
      // Best-effort usage tracking -- a failed ping (offline, transient
      // server error) has no user-visible effect and must never surface.
    });
  }, []);

  return null;
}

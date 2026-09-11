import "server-only";
import { db } from "@/lib/db";

/**
 * Records/refreshes a Device's presence (CONTEXT.md) -- an anonymous,
 * local-only browser install, never a person. Upsert keyed on the
 * client-generated id: no note content, no account link, just first/last
 * seen for counting free-tier usage.
 */
export async function pingDevice(deviceId: string): Promise<void> {
  await db.anonymousDevice.upsert({
    where: { id: deviceId },
    create: { id: deviceId },
    update: {},
  });
}

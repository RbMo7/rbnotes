"use server";

import { pingDevice } from "@/lib/devices";
import { pingDeviceSchema } from "@/lib/schemas";

/**
 * Counts an anonymous Device's usage without requiring sign-in -- no
 * userId, no auth check, deliberately (unlike every action in
 * server/actions/notes.ts). Only ever called with a random client-generated
 * id; carries no note content.
 */
export async function pingDeviceAction(input: unknown) {
  const { deviceId } = pingDeviceSchema.parse(input);
  await pingDevice(deviceId);
}

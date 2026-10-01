import type { Event } from './events';

export type QRPayload = {
  v: 1;
  event: string;
  title?: string;
  start?: string;
  end?: string;
};

export type ParseQRResult =
  | { ok: true; payload: QRPayload }
  | { ok: false; message: string };

export function buildQRPayload(event: Event): string {
  return JSON.stringify({
    v: 1,
    event: event.eventId,
    ...(event.title ? { title: event.title } : {}),
    ...(event.start ? { start: event.start } : {}),
    ...(event.end ? { end: event.end } : {}),
  });
}

export function parseQRPayload(raw: string): ParseQRResult {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'Invalid QR code.' };
  }

  if (
    typeof value !== 'object' ||
    value === null ||
    (value as QRPayload).v !== 1 ||
    typeof (value as QRPayload).event !== 'string' ||
    !(value as QRPayload).event.trim()
  ) {
    return { ok: false, message: 'Not an attendance QR code.' };
  }

  return { ok: true, payload: value as QRPayload };
}

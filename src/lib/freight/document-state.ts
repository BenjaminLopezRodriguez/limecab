/** Minimal document state machine. Pure. */

export const DOCUMENT_TYPES = [
  "RATE_CONFIRMATION",
  "BOL",
  "POD",
  "LUMPER_RECEIPT",
  "OTHER",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = [
  "PENDING",
  "UPLOADED",
  "VERIFIED",
  "REJECTED",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

const ALLOWED: Record<DocumentStatus, readonly DocumentStatus[]> = {
  PENDING: ["UPLOADED", "REJECTED"],
  UPLOADED: ["VERIFIED", "REJECTED"],
  VERIFIED: [],
  REJECTED: ["UPLOADED"],
};

export function isDocumentStatus(value: string): value is DocumentStatus {
  return (DOCUMENT_STATUSES as readonly string[]).includes(value);
}

export function canTransitionDocument(
  from: DocumentStatus,
  to: DocumentStatus,
): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

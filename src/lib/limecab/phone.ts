/** Digits-only, US +1 when the rider types a 10-digit local number. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  if (digits.length >= 8 && digits.length <= 15) return digits;
  return null;
}

export function phoneEmail(digits: string): string {
  return `${digits}@phone.limecab`;
}

export function signInOtpId(digits: string): string {
  return `signin:${digits}`;
}

export function formatPhone(digits: string): string {
  if (digits.length === 11 && digits.startsWith("1")) {
    const local = digits.slice(1);
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return `+${digits}`;
}

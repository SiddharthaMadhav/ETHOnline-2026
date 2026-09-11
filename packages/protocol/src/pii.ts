/**
 * Minimal PII heuristics for sanitized semantic summaries (CLAUDE.md section 24).
 * This is NOT a complete PII detection system - it only catches obvious
 * email addresses and phone numbers so publishers don't accidentally leak
 * raw private conversation into Hark.
 */
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /(\+?\d[\d\-.\s]{7,}\d)/;

export function containsObviousPii(text: string): boolean {
  return EMAIL_PATTERN.test(text) || PHONE_PATTERN.test(text);
}

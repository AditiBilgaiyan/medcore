import DOMPurify from "dompurify";

/**
 * Sanitise user-supplied rich text before rendering it as HTML (PRD §10, XSS).
 * Prefer rendering plain text; use this only where HTML is genuinely needed.
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof window === "undefined") return dirty.replace(/<[^>]*>/g, "");
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "u", "p", "br", "ul", "ol", "li"],
    ALLOWED_ATTR: [],
  });
}

/** Strip all markup — for free-text clinical fields stored as plain text. */
export function toPlainText(dirty: string): string {
  if (typeof window === "undefined") return dirty.replace(/<[^>]*>/g, "");
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

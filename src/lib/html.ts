/**
 * HTML utility functions for security
 */

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return str.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

/**
 * Sanitize email header values to prevent header injection
 * Removes newlines and carriage returns that could inject additional headers
 */
export function sanitizeEmailHeader(value: string): string {
  return value.replace(/[\r\n]/g, "").trim();
}

/**
 * Sanitize a subject line for email
 */
export function sanitizeEmailSubject(subject: string): string {
  // Remove newlines and limit length
  return sanitizeEmailHeader(subject).slice(0, 200);
}

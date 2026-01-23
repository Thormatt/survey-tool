/**
 * Privacy utilities for session recording
 *
 * Handles masking of sensitive form fields and PII in rrweb recordings.
 * Follows GDPR and privacy-first principles.
 */

// Input types that should be masked by default
const SENSITIVE_INPUT_TYPES = new Set([
  "password",
  "email",
  "tel",
  "credit-card",
  "ssn",
  "pin",
]);

// Input name/id patterns that indicate sensitive data
const SENSITIVE_NAME_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /credit.?card/i,
  /card.?number/i,
  /cvv/i,
  /cvc/i,
  /ssn/i,
  /social.?security/i,
  /tax.?id/i,
  /national.?id/i,
  /pin/i,
  /token/i,
  /api.?key/i,
  /auth/i,
];

// CSS selectors for elements to always mask
const ALWAYS_MASK_SELECTORS = [
  "[data-private]",
  "[data-mask]",
  ".private",
  ".sensitive",
  ".pii",
];

// CSS selectors for elements to never mask (survey inputs)
const NEVER_MASK_SELECTORS = [
  "[data-survey-input]",
  "[data-question-input]",
  ".survey-input",
];

/**
 * Check if an element should be masked based on its attributes
 */
export function shouldMaskElement(element: Element): boolean {
  // Never mask survey inputs unless explicitly marked
  for (const selector of NEVER_MASK_SELECTORS) {
    if (element.matches(selector)) {
      return false;
    }
  }

  // Always mask elements with privacy attributes
  for (const selector of ALWAYS_MASK_SELECTORS) {
    if (element.matches(selector)) {
      return true;
    }
  }

  // Check input type
  if (element instanceof HTMLInputElement) {
    if (SENSITIVE_INPUT_TYPES.has(element.type)) {
      return true;
    }

    // Check name/id patterns
    const identifier = `${element.name} ${element.id}`.toLowerCase();
    for (const pattern of SENSITIVE_NAME_PATTERNS) {
      if (pattern.test(identifier)) {
        return true;
      }
    }
  }

  // Check autocomplete attribute
  const autocomplete = element.getAttribute("autocomplete");
  if (autocomplete) {
    const sensitiveAutocomplete = [
      "cc-number",
      "cc-exp",
      "cc-csc",
      "cc-name",
      "new-password",
      "current-password",
    ];
    if (sensitiveAutocomplete.includes(autocomplete)) {
      return true;
    }
  }

  return false;
}

/**
 * Generate rrweb mask input options
 * Returns configuration for rrweb's maskInputOptions
 */
export function getMaskInputOptions(maskAll = false): Record<string, boolean> {
  if (maskAll) {
    return {
      password: true,
      email: true,
      tel: true,
      text: true,
      textarea: true,
      select: true,
    };
  }

  return {
    password: true,
  };
}

/**
 * Generate CSS selector for elements to block (completely hide)
 * These elements won't be recorded at all
 */
export function getBlockSelector(): string {
  return [
    "[data-rrweb-block]",
    "[data-block]",
    ".rrweb-block",
    // Common third-party widgets that shouldn't be recorded
    ".intercom-lightweight-app",
    "#hubspot-messages-iframe-container",
    ".drift-widget-container",
    ".crisp-client",
  ].join(", ");
}

/**
 * Generate CSS selector for elements to mask (replace with placeholder)
 */
export function getMaskTextSelector(): string {
  return ALWAYS_MASK_SELECTORS.join(", ");
}

/**
 * Generate rrweb recording configuration for privacy
 */
export function getPrivacyConfig(options: { maskInputs: boolean }) {
  return {
    maskInputOptions: getMaskInputOptions(options.maskInputs),
    maskTextSelector: getMaskTextSelector(),
    blockSelector: getBlockSelector(),
    maskAllInputs: options.maskInputs,
    // Custom input masking function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    maskInputFn: ((text: string, element: HTMLElement): string => {
      if (shouldMaskElement(element)) {
        return "*".repeat(Math.min(text.length, 20));
      }
      return text;
    }) as any,
  };
}

/**
 * Sanitize text content for privacy
 * Used for any text that might contain PII
 */
export function sanitizeText(text: string): string {
  // Mask email addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  text = text.replace(emailRegex, "[EMAIL]");

  // Mask phone numbers (various formats)
  const phoneRegex = /(\+?[\d\s\-()]{10,})/g;
  text = text.replace(phoneRegex, "[PHONE]");

  // Mask credit card numbers
  const ccRegex = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
  text = text.replace(ccRegex, "[CARD]");

  // Mask SSN
  const ssnRegex = /\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/g;
  text = text.replace(ssnRegex, "[SSN]");

  return text;
}

/**
 * Check if recording is allowed based on browser signals
 * Respects Do Not Track and Global Privacy Control
 */
export function isRecordingAllowed(): boolean {
  if (typeof window === "undefined") return false;

  // Respect Do Not Track
  if (navigator.doNotTrack === "1") {
    return false;
  }

  // Respect Global Privacy Control
  // @ts-expect-error globalPrivacyControl is not in standard types
  if (navigator.globalPrivacyControl === true) {
    return false;
  }

  return true;
}

/**
 * Get consent storage key for a survey
 */
export function getConsentStorageKey(surveyId: string): string {
  return `survey_behavior_consent_${surveyId}`;
}

/**
 * Check if user has previously given consent for this survey
 */
export function hasStoredConsent(surveyId: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const stored = localStorage.getItem(getConsentStorageKey(surveyId));
    if (!stored) return false;

    const { consent, expires } = JSON.parse(stored);
    if (expires && new Date(expires) < new Date()) {
      localStorage.removeItem(getConsentStorageKey(surveyId));
      return false;
    }

    return consent === true;
  } catch {
    return false;
  }
}

/**
 * Store consent decision
 */
export function storeConsent(surveyId: string, consent: boolean, daysValid = 30): void {
  if (typeof window === "undefined") return;

  try {
    const expires = new Date();
    expires.setDate(expires.getDate() + daysValid);

    localStorage.setItem(
      getConsentStorageKey(surveyId),
      JSON.stringify({ consent, expires: expires.toISOString() })
    );
  } catch {
    // Ignore storage errors (private browsing, etc.)
  }
}

/**
 * Clear stored consent
 */
export function clearStoredConsent(surveyId: string): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(getConsentStorageKey(surveyId));
  } catch {
    // Ignore storage errors
  }
}

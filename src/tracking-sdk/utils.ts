/**
 * Utility functions for the tracking SDK
 */

const VISITOR_ID_KEY = "svtr_visitor_id";
const SESSION_TOKEN_KEY = "svtr_session_token";
const SESSION_EXPIRY_KEY = "svtr_session_expiry";
const SESSION_DURATION = 30 * 60 * 1000; // 30 minutes

export function generateVisitorId(): string {
  let visitorId = localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = generateUUID();
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }
  return visitorId;
}

export function getSessionToken(): string | null {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  const expiry = sessionStorage.getItem(SESSION_EXPIRY_KEY);

  if (!token || !expiry) {
    return null;
  }

  if (Date.now() > parseInt(expiry, 10)) {
    // Session expired
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_EXPIRY_KEY);
    return null;
  }

  // Extend session
  sessionStorage.setItem(SESSION_EXPIRY_KEY, String(Date.now() + SESSION_DURATION));
  return token;
}

export function setSessionToken(token: string): void {
  sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  sessionStorage.setItem(SESSION_EXPIRY_KEY, String(Date.now() + SESSION_DURATION));
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  limit: number
): T {
  let lastCall = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    }
  }) as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((...args: any[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delay);
  }) as T;
}

export function getViewportBreakpoint(): "mobile" | "tablet" | "desktop" {
  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export function getDeviceType(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) {
    return "mobile";
  }
  if (/ipad|tablet|playbook|silk/i.test(ua)) {
    return "tablet";
  }
  return "desktop";
}

export function getBrowserInfo(): { browser: string; os: string } {
  const ua = navigator.userAgent;
  let browser = "Unknown";
  let os = "Unknown";

  // Detect browser
  if (ua.includes("Firefox")) {
    browser = "Firefox";
  } else if (ua.includes("SamsungBrowser")) {
    browser = "Samsung Internet";
  } else if (ua.includes("Opera") || ua.includes("OPR")) {
    browser = "Opera";
  } else if (ua.includes("Edge") || ua.includes("Edg")) {
    browser = "Edge";
  } else if (ua.includes("Chrome")) {
    browser = "Chrome";
  } else if (ua.includes("Safari")) {
    browser = "Safari";
  } else if (ua.includes("MSIE") || ua.includes("Trident")) {
    browser = "Internet Explorer";
  }

  // Detect OS
  if (ua.includes("Windows")) {
    os = "Windows";
  } else if (ua.includes("Mac")) {
    os = "macOS";
  } else if (ua.includes("Linux")) {
    os = "Linux";
  } else if (ua.includes("Android")) {
    os = "Android";
  } else if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad")) {
    os = "iOS";
  }

  return { browser, os };
}

export function getElementSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }

  const path: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.className && typeof current.className === "string") {
      const classes = current.className.split(/\s+/).filter(Boolean).slice(0, 2);
      if (classes.length) {
        selector += `.${classes.join(".")}`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(" > ");
}

export function sendBeacon(url: string, data: unknown): boolean {
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });

  if (navigator.sendBeacon) {
    return navigator.sendBeacon(url, blob);
  }

  // Fallback to synchronous XHR
  try {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, false);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.send(JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

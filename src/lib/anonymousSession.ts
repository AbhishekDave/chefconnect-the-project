const KEY = "cheftoman.anonymous_session_token";
const NUDGE_KEY = "cheftoman.nudge_count";

function uuidv4(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback
  const bytes = new Uint8Array(16);
  (typeof crypto !== "undefined" ? crypto : { getRandomValues: (b: Uint8Array) => b.forEach((_, i) => (b[i] = Math.floor(Math.random() * 256))) }).getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getOrCreateAnonymousSessionToken(): string {
  if (typeof window === "undefined") return "";
  let t = window.localStorage.getItem(KEY);
  if (!t) {
    t = uuidv4();
    window.localStorage.setItem(KEY, t);
  }
  return t;
}

export function getAnonymousSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

export function bumpNudgeCount(): number {
  if (typeof window === "undefined") return 0;
  const cur = Number(window.localStorage.getItem(NUDGE_KEY) ?? "0");
  const next = cur + 1;
  window.localStorage.setItem(NUDGE_KEY, String(next));
  return next;
}

export function getNudgeCount(): number {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(NUDGE_KEY) ?? "0");
}

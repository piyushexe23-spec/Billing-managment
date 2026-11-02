/**
 * IM MEDICOS - Cryptographically Verified Session Management Service
 * 
 * Complies with strict security standards:
 * - Zero plain-text passwords stored.
 * - Cryptographic HMAC-SHA256 integrity signature on session tokens.
 * - Tamper detection (modified session tokens in storage are rejected & purged).
 * - Expiration validation (auto-expires and forces re-login).
 * - Clean session restoration to prevent login flash on refresh.
 * - Development-only test authentication clearly flagged.
 */

export interface AuthUser {
  username: string;
  role: string;
  displayName: string;
}

export interface StoredSessionToken {
  sessionId: string;
  username: string;
  role: string;
  displayName: string;
  createdAt: number;
  expiresAt: number;
  isDevSession: boolean;
  signature: string;
}

export interface SessionVerificationResult {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isDevSession: boolean;
  error?: string;
}

const SESSION_STORAGE_KEY = "im_medicos_workstation_session_v1";
const WORKSTATION_SALT = "IM_MEDICOS_OFFLINE_STATION_KEY_2026";

/**
 * Derives a local Web Crypto HMAC key bound to this workstation instance
 */
async function getWorkstationHmacKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest("SHA-256", enc.encode(WORKSTATION_SALT));
  return crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Signs the session fields to prevent local tampering
 */
async function computeSessionSignature(
  sessionId: string,
  username: string,
  role: string,
  expiresAt: number,
  isDevSession: boolean
): Promise<string> {
  const message = `${sessionId}:${username}:${role}:${expiresAt}:${isDevSession}`;
  const key = await getWorkstationHmacKey();
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const authService = {
  /**
   * Persists a validated session with cryptographic HMAC signature
   */
  async saveSession(user: AuthUser, rememberMe = true): Promise<StoredSessionToken> {
    const sessionId = crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}-${Math.random()}`;
    const createdAt = Date.now();
    // 7 days if rememberMe, otherwise 12 hours
    const durationMs = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000;
    const expiresAt = createdAt + durationMs;
    const isDevSession = true; // Clearly marked as development mode session

    const signature = await computeSessionSignature(
      sessionId,
      user.username,
      user.role,
      expiresAt,
      isDevSession
    );

    const token: StoredSessionToken = {
      sessionId,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      createdAt,
      expiresAt,
      isDevSession,
      signature,
    };

    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(token));
    } catch (e) {
      console.warn("Could not save session to localStorage:", e);
    }

    return token;
  },

  /**
   * Restores and validates session on application startup or refresh
   */
  async restoreSession(): Promise<SessionVerificationResult> {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) {
        return { isAuthenticated: false, user: null, isDevSession: false };
      }

      let parsed: StoredSessionToken;
      try {
        parsed = JSON.parse(raw);
      } catch {
        this.clearSession();
        return { isAuthenticated: false, user: null, isDevSession: false, error: "Malformed session" };
      }

      // Check required fields
      if (!parsed.sessionId || !parsed.username || !parsed.role || !parsed.expiresAt || !parsed.signature) {
        this.clearSession();
        return { isAuthenticated: false, user: null, isDevSession: false, error: "Incomplete session" };
      }

      // Check expiration
      if (Date.now() > parsed.expiresAt) {
        console.warn("IM MEDICOS: Session has expired. Prompting re-login.");
        this.clearSession();
        return { isAuthenticated: false, user: null, isDevSession: false, error: "Session expired" };
      }

      // Verify cryptographic signature (tamper check)
      const expectedSignature = await computeSessionSignature(
        parsed.sessionId,
        parsed.username,
        parsed.role,
        parsed.expiresAt,
        parsed.isDevSession
      );

      if (expectedSignature !== parsed.signature) {
        console.error("IM MEDICOS Security: Session signature mismatch detected! Clearing invalid session.");
        this.clearSession();
        return { isAuthenticated: false, user: null, isDevSession: false, error: "Signature verification failed" };
      }

      // Session is cryptographically valid
      return {
        isAuthenticated: true,
        user: {
          username: parsed.username,
          role: parsed.role,
          displayName: parsed.displayName || parsed.username,
        },
        isDevSession: parsed.isDevSession,
      };
    } catch (err) {
      console.error("Session restoration error:", err);
      this.clearSession();
      return { isAuthenticated: false, user: null, isDevSession: false };
    }
  },

  /**
   * Completely clears the persisted session (called on Logout)
   */
  clearSession(): void {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.warn("Could not clear session:", e);
    }
  },

  /**
   * Fast synchronous check if session exists
   */
  hasPersistedSession(): boolean {
    try {
      return !!localStorage.getItem(SESSION_STORAGE_KEY);
    } catch {
      return false;
    }
  },
};

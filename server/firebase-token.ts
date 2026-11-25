import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Request } from "express";
import { getApps, getApp, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface VerifiedFirebaseUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  signInProvider: string | null;
}

const ADMIN_EMAILS = new Set(["phreakfrog@gmail.com"]);

let cachedProjectId: string | null | undefined;
let cachedAdminApp: App | null | undefined;

function readFirebaseProjectId(): string | null {
  if (cachedProjectId !== undefined) return cachedProjectId;

  const envId = String(process.env.FIREBASE_PROJECT_ID || "").trim();
  if (envId && envId !== "remixed-project-id") {
    cachedProjectId = envId;
    return cachedProjectId;
  }

  const candidates = [
    path.resolve(__dirname, "..", "firebase-applet-config.json"),
    path.resolve(process.cwd(), "firebase-applet-config.json"),
  ];

  for (const cfgPath of candidates) {
    try {
      if (!fs.existsSync(cfgPath)) continue;
      const raw = JSON.parse(fs.readFileSync(cfgPath, "utf8")) as {
        projectId?: unknown;
      };
      const pid = String(raw?.projectId || "").trim();
      if (pid && pid !== "remixed-project-id") {
        cachedProjectId = pid;
        return cachedProjectId;
      }
    } catch {
      // Try next candidate
    }
  }

  cachedProjectId = null;
  return null;
}

function getFirebaseVerifyApp(): App | null {
  if (cachedAdminApp !== undefined) return cachedAdminApp;

  const projectId = readFirebaseProjectId();
  if (!projectId) {
    cachedAdminApp = null;
    return null;
  }

  try {
    // Only projectId is needed for verifyIdToken(token) — requires no IAM or service account key.
    cachedAdminApp = getApps().length ? getApp() : initializeApp({ projectId });
    return cachedAdminApp;
  } catch (err) {
    console.error("[FirebaseAuth] Failed to initialize token verifier:", err);
    cachedAdminApp = null;
    return null;
  }
}

export async function verifyFirebaseBearerToken(
  req: Request,
): Promise<VerifiedFirebaseUser | null> {
  const authHeader = String(req.headers.authorization || "").trim();
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token || token.length > 8192) {
    return null;
  }

  const app = getFirebaseVerifyApp();
  if (!app) {
    return null;
  }

  try {
    const decoded = await getAuth(app).verifyIdToken(token);
    if (!decoded?.uid) return null;
    return {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : null,
      emailVerified: Boolean(decoded.email_verified),
      name: typeof decoded.name === "string" ? decoded.name : null,
      signInProvider:
        typeof decoded.firebase?.sign_in_provider === "string"
          ? decoded.firebase.sign_in_provider
          : null,
    };
  } catch {
    return null;
  }
}

export function isVerifiedAdminUser(user: VerifiedFirebaseUser | null): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  return ADMIN_EMAILS.has(user.email.trim().toLowerCase());
}

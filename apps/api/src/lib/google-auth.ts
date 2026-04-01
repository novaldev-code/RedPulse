import { OAuth2Client } from "google-auth-library";

const redirectPath = "/auth/google/callback";

let oauthClient: OAuth2Client | null = null;
let oauthRedirectClient: OAuth2Client | null = null;

function getGoogleClientIdValue() {
  return process.env.GOOGLE_CLIENT_ID ?? "";
}

function getGoogleClientSecretValue() {
  return process.env.GOOGLE_CLIENT_SECRET ?? "";
}

function getApiOriginValue() {
  return process.env.API_ORIGIN ?? `http://localhost:${process.env.PORT ?? "3001"}`;
}

function getAppOriginValue() {
  return process.env.APP_ORIGIN ?? "http://localhost:5173";
}

function getGoogleClient() {
  const googleClientId = getGoogleClientIdValue();

  if (!googleClientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
  }

  if (!oauthClient) {
    oauthClient = new OAuth2Client(googleClientId);
  }

  return oauthClient;
}

export function getGoogleClientId() {
  return getGoogleClientIdValue();
}

function getGoogleRedirectUri() {
  return `${getApiOriginValue()}${redirectPath}`;
}

function getGoogleRedirectClient() {
  const googleClientId = getGoogleClientIdValue();
  const googleClientSecret = getGoogleClientSecretValue();

  if (!googleClientId || !googleClientSecret) {
    throw new Error("Google OAuth redirect is not configured.");
  }

  if (!oauthRedirectClient) {
    oauthRedirectClient = new OAuth2Client(googleClientId, googleClientSecret, getGoogleRedirectUri());
  }

  return oauthRedirectClient;
}

export function getAppOrigin() {
  return getAppOriginValue();
}

export function getGoogleAuthUrl() {
  return getGoogleRedirectClient().generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "select_account",
    scope: ["openid", "email", "profile"]
  });
}

export async function verifyGoogleCredential(credential: string) {
  const googleClientId = getGoogleClientIdValue();

  if (!googleClientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured.");
  }

  const ticket = await getGoogleClient().verifyIdToken({
    idToken: credential,
    audience: googleClientId
  });

  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) {
    throw new Error("Google payload is missing required fields.");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    displayName: payload.name ?? payload.email.split("@")[0] ?? "redpulse_user",
    avatarUrl: payload.picture ?? null,
    emailVerified: payload.email_verified ?? false
  };
}

export async function exchangeGoogleCode(code: string) {
  const client = getGoogleRedirectClient();
  const googleClientId = getGoogleClientIdValue();
  const { tokens } = await client.getToken(code);

  if (!tokens.id_token) {
    throw new Error("Google did not return an ID token.");
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: googleClientId
  });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email) {
    throw new Error("Google payload is missing required fields.");
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    displayName: payload.name ?? payload.email.split("@")[0] ?? "redpulse_user",
    avatarUrl: payload.picture ?? null,
    emailVerified: payload.email_verified ?? false
  };
}

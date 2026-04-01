import jwt, { type SignOptions } from "jsonwebtoken";
import type { Request, Response } from "express";

export type AuthUser = {
  id: string;
  username: string;
};

type TokenPayload = AuthUser & {
  sub: string;
};

const authCookieName = process.env.AUTH_COOKIE_NAME ?? "redpulse_token";
const jwtSecret = process.env.JWT_SECRET ?? "redpulse-dev-secret";
const jwtExpiresInRaw = process.env.JWT_EXPIRES_IN ?? "7d";
const jwtExpiresIn = jwtExpiresInRaw as SignOptions["expiresIn"];
const isProduction = process.env.NODE_ENV === "production";
const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

function getCookieMaxAge() {
  if (jwtExpiresInRaw.endsWith("d")) {
    const days = Number.parseInt(jwtExpiresInRaw, 10);
    if (!Number.isNaN(days)) {
      return days * 24 * 60 * 60 * 1000;
    }
  }

  return sevenDaysMs;
}

export function signAuthToken(user: AuthUser) {
  return jwt.sign(
    {
      sub: user.id,
      id: user.id,
      username: user.username
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, jwtSecret) as TokenPayload;
}

export function setAuthCookie(response: Response, token: string) {
  response.cookie(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: getCookieMaxAge()
  });
}

export function clearAuthCookie(response: Response) {
  response.clearCookie(authCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/"
  });
}

export function getAuthCookieName() {
  return authCookieName;
}

export function readAuthUserFromRequest(request: Request): AuthUser | null {
  const token = request.cookies?.[authCookieName];

  if (!token) {
    return null;
  }

  try {
    const payload = verifyAuthToken(token);

    return {
      id: payload.sub,
      username: payload.username
    };
  } catch {
    return null;
  }
}

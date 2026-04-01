import { Router, type Router as ExpressRouter } from "express";
import { googleAuthSchema, loginSchema, registerSchema } from "@redpulse/validation";
import { exchangeGoogleCode, getAppOrigin, getGoogleAuthUrl, getGoogleClientId, verifyGoogleCredential } from "../lib/google-auth.js";
import { clearAuthCookie, setAuthCookie, signAuthToken } from "../lib/jwt.js";
import { createRateLimiter } from "../lib/rate-limit.js";
import { authenticate } from "../middleware/auth.js";
import { getSafeUserById, loginUser, loginWithGoogleAccount, registerUser } from "../services/auth-service.js";

export const authRouter: ExpressRouter = Router();

const registerLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 8,
  keyPrefix: "auth-register",
  message: "Terlalu banyak percobaan daftar. Tunggu sebentar lalu coba lagi."
});

const loginLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 12,
  keyPrefix: "auth-login",
  message: "Terlalu banyak percobaan login. Tunggu sebentar lalu coba lagi."
});

const googleAuthLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 20,
  keyPrefix: "auth-google",
  message: "Terlalu banyak percobaan login Google. Tunggu sebentar lalu coba lagi."
});

function getGoogleCallbackErrorCode(error: unknown) {
  if (!(error instanceof Error)) {
    return "google-login-failed";
  }

  const message = error.message.toLowerCase();

  if (message.includes("redirect_uri_mismatch")) {
    return "google-redirect-mismatch";
  }

  if (message.includes("invalid_client")) {
    return "google-invalid-client";
  }

  if (message.includes("invalid_grant")) {
    return "google-invalid-grant";
  }

  if (message.includes("id token")) {
    return "google-missing-id-token";
  }

  return "google-login-failed";
}

function getGoogleLoginErrorResponse(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("wrong recipient") || message.includes("payload audience")) {
    return {
      status: 401,
      message: "Google Client ID tidak cocok dengan credential yang dikirim."
    };
  }

  if (message.includes("token used too late") || message.includes("token used too early")) {
    return {
      status: 401,
      message: "Credential Google kedaluwarsa. Coba login lagi."
    };
  }

  if (message.includes("failed to fetch public keys")) {
    return {
      status: 503,
      message: "Server gagal memverifikasi Google credential. Coba lagi sebentar."
    };
  }

  if (message.includes("google payload is missing") || message.includes("wrong number of segments")) {
    return {
      status: 401,
      message: "Google credential tidak valid."
    };
  }

  if (code === "ECONNREFUSED" || message.includes("connect econnrefused")) {
    return {
      status: 500,
      message: "Server tidak bisa terhubung ke database."
    };
  }

  if (message.includes('relation "') && message.includes("does not exist")) {
    return {
      status: 500,
      message: "Schema database belum siap. Jalankan migrasi database dulu."
    };
  }

  if (code === "23505") {
    return {
      status: 409,
      message: "Akun Google ini bentrok dengan data user yang sudah ada."
    };
  }

  return {
    status: 401,
    message: error instanceof Error && process.env.NODE_ENV !== "production" ? error.message : "Google login failed."
  };
}

authRouter.post("/register", registerLimiter, async (request, response) => {
  const parsed = registerSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid register payload.",
      issues: parsed.error.flatten()
    });
    return;
  }

  const result = await registerUser(parsed.data);

  if ("message" in result) {
    response.status(result.status).json({
      message: result.message
    });
    return;
  }

  const token = signAuthToken({
    id: result.user.id,
    username: result.user.username
  });

  setAuthCookie(response, token);
  response.status(result.status).json({
    user: result.user
  });
});

authRouter.post("/login", loginLimiter, async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid login payload.",
      issues: parsed.error.flatten()
    });
    return;
  }

  const result = await loginUser(parsed.data);

  if ("message" in result) {
    response.status(result.status).json({
      message: result.message
    });
    return;
  }

  const token = signAuthToken({
    id: result.user.id,
    username: result.user.username
  });

  setAuthCookie(response, token);
  response.status(result.status).json({
    user: result.user
  });
});

authRouter.post("/logout", (_request, response) => {
  clearAuthCookie(response);
  response.status(204).send();
});

authRouter.get("/auth/google/start", (_request, response) => {
  try {
    response.redirect(getGoogleAuthUrl());
  } catch {
    response.redirect(`${getAppOrigin()}?authError=google-not-configured`);
  }
});

authRouter.get("/auth/google/config", (_request, response) => {
  const clientId = getGoogleClientId();

  if (!clientId) {
    response.status(503).json({
      message: "Google login is not configured."
    });
    return;
  }

  response.json({ clientId });
});

authRouter.get("/auth/google/callback", async (request, response) => {
  const code = typeof request.query.code === "string" ? request.query.code : "";

  if (!code) {
    response.redirect(`${getAppOrigin()}?authError=google-missing-code`);
    return;
  }

  try {
    const googleUser = await exchangeGoogleCode(code);

    if (!googleUser.emailVerified) {
      response.redirect(`${getAppOrigin()}?authError=google-email-not-verified`);
      return;
    }

    const user = await loginWithGoogleAccount(googleUser);
    const token = signAuthToken({
      id: user.id,
      username: user.username
    });

    setAuthCookie(response, token);
    response.redirect(`${getAppOrigin()}?auth=success`);
  } catch (error) {
    console.error(error);
    response.redirect(`${getAppOrigin()}?authError=${getGoogleCallbackErrorCode(error)}`);
  }
});

authRouter.post("/auth/google", googleAuthLimiter, async (request, response) => {
  const parsed = googleAuthSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid Google login payload.",
      issues: parsed.error.flatten()
    });
    return;
  }

  try {
    const googleUser = await verifyGoogleCredential(parsed.data.credential);

    if (!googleUser.emailVerified) {
      response.status(401).json({
        message: "Google account email is not verified."
      });
      return;
    }

    const user = await loginWithGoogleAccount(googleUser);
    const token = signAuthToken({
      id: user.id,
      username: user.username
    });

    setAuthCookie(response, token);
    response.status(200).json({ user });
  } catch (error) {
    console.error(error);
    const failure = getGoogleLoginErrorResponse(error);
    response.status(failure.status).json({
      message: failure.message
    });
  }
});

authRouter.get("/me", authenticate, async (request, response) => {
  const user = await getSafeUserById(request.user!.id);

  if (!user) {
    clearAuthCookie(response);
    response.status(404).json({
      message: "User not found."
    });
    return;
  }

  response.json({ user });
});

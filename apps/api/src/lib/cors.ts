import type { NextFunction, Request, Response } from "express";

const defaultOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const allowMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const allowHeaders = "Content-Type, Authorization, X-Requested-With";

function getConfiguredOrigins() {
  const configured = [process.env.APP_ORIGIN, process.env.ALLOWED_ORIGINS]
    .filter(Boolean)
    .flatMap((value) => value!.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : defaultOrigins;
}

function matchesWildcardOrigin(pattern: string, origin: string) {
  if (!pattern.includes("*")) {
    return false;
  }

  try {
    const patternUrl = new URL(pattern.replace("*.", ""));
    const originUrl = new URL(origin);

    return (
      patternUrl.protocol === originUrl.protocol &&
      originUrl.hostname.endsWith(`.${patternUrl.hostname}`) &&
      originUrl.pathname === patternUrl.pathname
    );
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string) {
  return getConfiguredOrigins().some((pattern) => pattern === origin || matchesWildcardOrigin(pattern, origin));
}

export function applyCors(request: Request, response: Response, next: NextFunction) {
  const origin = request.headers.origin;

  if (!origin) {
    if (request.method === "OPTIONS") {
      response.status(204).end();
      return;
    }

    next();
    return;
  }

  if (!isAllowedOrigin(origin)) {
    if (request.method === "OPTIONS") {
      response.status(403).json({
        message: "Origin is not allowed."
      });
      return;
    }

    next();
    return;
  }

  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Access-Control-Allow-Methods", allowMethods);
  response.setHeader("Access-Control-Allow-Headers", allowHeaders);
  response.append("Vary", "Origin");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
}

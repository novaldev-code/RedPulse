import type { NextFunction, Request, Response } from "express";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimiterOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message: string;
  keyGenerator?: (request: Request) => string;
};

type RateLimitStore = {
  increment: (key: string, windowMs: number) => Promise<RateLimitEntry>;
};

const memoryStore = new Map<string, RateLimitEntry>();
let lastCleanupAt = 0;
let hasLoggedStoreMode = false;

function getClientAddress(request: Request) {
  const forwardedFor = request.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim().length > 0) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0] ?? "unknown";
  }

  return request.ip || "unknown";
}

function cleanupExpiredMemoryEntries(now: number) {
  if (now - lastCleanupAt < 60_000) {
    return;
  }

  lastCleanupAt = now;

  for (const [key, entry] of memoryStore.entries()) {
    if (entry.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}

const localMemoryStore: RateLimitStore = {
  async increment(key, windowMs) {
    const now = Date.now();
    cleanupExpiredMemoryEntries(now);

    const existing = memoryStore.get(key);

    if (!existing || existing.resetAt <= now) {
      const nextEntry = {
        count: 1,
        resetAt: now + windowMs,
      };

      memoryStore.set(key, nextEntry);
      return nextEntry;
    }

    existing.count += 1;
    return existing;
  },
};

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

async function callUpstashPipeline(
  url: string,
  token: string,
  commands: Array<Array<string | number>>,
) {
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    throw new Error(`Upstash pipeline request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as Array<{
    result?: unknown;
    error?: string;
  }>;

  const firstError = payload.find((item) => item.error);

  if (firstError?.error) {
    throw new Error(`Upstash pipeline error: ${firstError.error}`);
  }

  return payload;
}

const upstashStore: RateLimitStore = {
  async increment(key, windowMs) {
    const config = getUpstashConfig();

    if (!config) {
      return localMemoryStore.increment(key, windowMs);
    }

    const now = Date.now();
    const resetAt = now + windowMs;
    const ttlMs = Math.max(windowMs, 1_000);
    const payload = await callUpstashPipeline(config.url, config.token, [
      ["INCR", key],
      ["PEXPIRE", key, ttlMs],
    ]);

    return {
      count: Number(payload[0]?.result ?? 0),
      resetAt,
    };
  },
};

function getRateLimitStore() {
  const hasUpstash = Boolean(getUpstashConfig());

  if (!hasLoggedStoreMode) {
    hasLoggedStoreMode = true;
    console.info(
      hasUpstash
        ? "Rate limiter memakai Upstash Redis."
        : "Rate limiter memakai memory store lokal.",
    );
  }

  return hasUpstash ? upstashStore : localMemoryStore;
}

function applyRateLimitHeaders(
  response: Response,
  max: number,
  count: number,
  resetAt: number,
) {
  response.setHeader("X-RateLimit-Limit", String(max));
  response.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - count)));
  response.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
}

export function createRateLimiter(options: RateLimiterOptions) {
  return function rateLimitMiddleware(
    request: Request,
    response: Response,
    next: NextFunction,
  ) {
    const identity =
      options.keyGenerator?.(request) ??
      request.user?.id ??
      getClientAddress(request);
    const key = `${options.keyPrefix}:${identity}`;

    void getRateLimitStore()
      .increment(key, options.windowMs)
      .then(({ count, resetAt }) => {
        applyRateLimitHeaders(response, options.max, count, resetAt);

        if (count > options.max) {
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((resetAt - Date.now()) / 1000),
          );

          response.setHeader("Retry-After", String(retryAfterSeconds));
          response.status(429).json({
            message: options.message,
            retryAfterSeconds,
          });
          return;
        }

        next();
      })
      .catch((error) => {
        console.error("Rate limiter fallback:", error);
        void localMemoryStore
          .increment(key, options.windowMs)
          .then(({ count, resetAt }) => {
            applyRateLimitHeaders(response, options.max, count, resetAt);

            if (count > options.max) {
              const retryAfterSeconds = Math.max(
                1,
                Math.ceil((resetAt - Date.now()) / 1000),
              );

              response.setHeader("Retry-After", String(retryAfterSeconds));
              response.status(429).json({
                message: options.message,
                retryAfterSeconds,
              });
              return;
            }

            next();
          })
          .catch(next);
      });
  };
}

export class ApiError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
const defaultRequestTimeoutMs = 12_000;

type ApiFetchInit = RequestInit & {
  timeoutMs?: number;
};

function resolveApiUrl(input: string) {
  if (/^https?:\/\//i.test(input)) {
    return input;
  }

  if (!apiBaseUrl) {
    return input;
  }

  return `${apiBaseUrl}${input.startsWith("/") ? input : `/${input}`}`;
}

export async function apiFetch<T>(input: string, init?: ApiFetchInit): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const controller = new AbortController();
  const timeoutMs = init?.timeoutMs ?? defaultRequestTimeoutMs;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;

  try {
    response = await fetch(resolveApiUrl(input), {
      credentials: "include",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...(init?.headers ?? {})
      },
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    window.clearTimeout(timeout);

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Request terlalu lama. Coba lagi sebentar.", 408);
    }

    throw error;
  }

  window.clearTimeout(timeout);

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json().catch(() => null)) as { message?: string; retryAfterSeconds?: number } | null;

  if (!response.ok) {
    throw new ApiError(
      data?.message ?? "Request failed.",
      response.status,
      typeof data?.retryAfterSeconds === "number" ? data.retryAfterSeconds : undefined
    );
  }

  return data as T;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

function resolveApiUrl(input: string) {
  if (/^https?:\/\//i.test(input)) {
    return input;
  }

  if (!apiBaseUrl) {
    return input;
  }

  return `${apiBaseUrl}${input.startsWith("/") ? input : `/${input}`}`;
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  const response = await fetch(resolveApiUrl(input), {
    credentials: "include",
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json().catch(() => null)) as { message?: string } | null;

  if (!response.ok) {
    throw new ApiError(data?.message ?? "Request failed.", response.status);
  }

  return data as T;
}

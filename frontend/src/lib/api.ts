export class ApiError extends Error {
  status: number;
  statusText: string;
  body: unknown;

  constructor(status: number, statusText: string, body: unknown) {
    super(statusText);
    this.name = "ApiError";
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

let authHeader: string | null = null;

/** @internal Exposed for WebSocket auth — do not use outside this module. */
export function _getAuthHeader(): string | null {
  return authHeader;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (authHeader) {
    headers["Authorization"] = authHeader;
  }
  return headers;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("/") ? `/api${path}` : path;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...buildHeaders(),
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, response.statusText, body);
  }

  if (response.status === 204) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },

  del<T = void>(path: string): Promise<T> {
    return request<T>(path, { method: "DELETE" });
  },

  /** POST multipart/form-data (file uploads). Skips Content-Type so browser sets it. */
  upload<T>(path: string, formData: FormData): Promise<T> {
    const url = path.startsWith("/") ? `/api${path}` : path;
    const headers: Record<string, string> = {};
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }
    // Intentionally omit Content-Type — browser sets multipart boundary automatically
    return fetch(url, {
      method: "POST",
      headers,
      body: formData,
    }).then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new ApiError(response.status, response.statusText, body);
      }
      if (response.status === 204) {
        return null as T;
      }
      return response.json() as Promise<T>;
    });
  },

  setAuth(user: string, pass: string): void {
    authHeader = `Basic ${btoa(`${user}:${pass}`)}`;
  },

  clearAuth(): void {
    authHeader = null;
  },
};
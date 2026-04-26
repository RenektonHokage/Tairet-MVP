import { QueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details ?? null;
  }
}

export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minuto
      refetchOnWindowFocus: false,
    },
  },
});

function resolveApiErrorMessage(details: unknown, fallbackMessage: string): string {
  if (
    details &&
    typeof details === "object" &&
    "error" in details &&
    typeof (details as { error?: unknown }).error === "string"
  ) {
    return (details as { error: string }).error;
  }

  return fallbackMessage;
}

async function throwApiError(response: Response): Promise<never> {
  const details = await response.json().catch(() => null);
  throw new ApiError(
    response.status,
    resolveApiErrorMessage(details, `API Error: ${response.statusText}`),
    details
  );
}

/**
 * Obtiene el access token de Supabase Auth para incluir en requests del panel
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Crea headers con Authorization si hay sesión activa
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  const token = await getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

// Fetcher básico
export async function fetcher<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${getApiBase()}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  return response.json();
}

// Helpers para API (sin auth, para endpoints públicos)
export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  return response.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  return response.json();
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  return response.json();
}

// Helpers para API del panel (con autenticación)
export async function apiGetWithAuth<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${getApiBase()}${path}`, {
    method: "GET",
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  return response.json();
}

export async function apiPostWithAuth<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${getApiBase()}${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  return response.json();
}

export async function apiPatchWithAuth<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${getApiBase()}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    await throwApiError(response);
  }

  return response.json();
}

export async function apiDeleteWithAuth(path: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${getApiBase()}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    await throwApiError(response);
  }
}

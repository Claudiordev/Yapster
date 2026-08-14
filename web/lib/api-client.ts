import { API_BASE_URL } from "./constants";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function authHeaders(token?: string, json = false): Record<string, string> {
  const headers: Record<string, string> = {};

  if (json) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return headers;
}

/**
 * Shared response handling for every verb:
 *  - 204 / empty body → null
 *  - otherwise → parsed JSON
 *  - non-2xx → log it and throw ApiError, so the BFF (withAuth) can map it to
 *    the right HTTP status for the browser.
 */
async function handleResponse<TRes>(response: Response): Promise<TRes> {
  if (!response.ok) {
    let message = response.statusText;

    try {
      const body = await response.json();

      message = body.detail || body.message || message;
    } catch {
      const text = await response.text();

      if (text) message = text;
    }

    console.error(`API ${response.status} ${response.url} — ${message}`);
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return null as TRes;

  const text = await response.text();

  return (text ? JSON.parse(text) : null) as TRes;
}

export async function apiGet<TRes>(path: string, token?: string): Promise<TRes> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: authHeaders(token),
  });

  return handleResponse<TRes>(response);
}

export async function apiPost<TReq, TRes>(
  path: string,
  body: TReq,
  token?: string,
): Promise<TRes> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders(token, true),
    body: JSON.stringify(body),
  });

  return handleResponse<TRes>(response);
}

export async function apiPut<TReq, TRes>(
  path: string,
  body: TReq,
  token?: string,
): Promise<TRes> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: authHeaders(token, true),
    body: JSON.stringify(body),
  });

  return handleResponse<TRes>(response);
}

export async function apiDelete<TRes>(path: string, token?: string): Promise<TRes> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });

  return handleResponse<TRes>(response);
}

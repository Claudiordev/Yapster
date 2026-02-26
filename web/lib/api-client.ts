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

export async function apiPost<TReq, TRes>(
  path: string,
  body: TReq,
  token?: string,
): Promise<TRes> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = response.statusText;

    try {
      const body = await response.json();

      message = body.detail || body.message || message;
    } catch {
      const text = await response.text();

      if (text) message = text;
    }
    throw new ApiError(response.status, message);
  }

  return response.json();
}

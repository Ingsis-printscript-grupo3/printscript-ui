export class HttpError extends Error {
  status: number;
  body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
  }
}

let customBaseUrl: string | null = null;
let customUserId: string | null = null;

export const setBaseUrl = (url: string | null): void => {
  customBaseUrl = url;
};

export const getBaseUrl = (): string => {
  if (customBaseUrl && customBaseUrl.trim() !== '') {
    return customBaseUrl.trim().replace(/\/+$/, '');
  }

  let envUrl: string | undefined;
  try {
    envUrl = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL;
  } catch {
    // import.meta may not be available in all execution contexts
  }

  if (!envUrl && typeof process !== 'undefined' && process.env) {
    envUrl = process.env.VITE_API_URL || process.env.BACKEND_URL;
  }

  return (envUrl && envUrl.trim() !== '' ? envUrl.trim() : 'http://localhost:8080').replace(/\/+$/, '');
};

export const setUserId = (userId: string | null): void => {
  customUserId = userId;
  try {
    if (typeof localStorage !== 'undefined') {
      if (userId !== null && userId.trim() !== '') {
        localStorage.setItem('userId', userId.trim());
      } else {
        localStorage.removeItem('userId');
      }
    }
  } catch {
    // ignore storage errors
  }
};

export const getUserId = (): string => {
  if (customUserId && customUserId.trim() !== '') {
    return customUserId.trim();
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const stored =
        localStorage.getItem('userId') ||
        localStorage.getItem('user_id');
      if (stored && stored.trim() !== '') {
        return stored.trim();
      }
    }
    return 'test-user-id';
  } catch {
    return 'test-user-id';
  }
};

function extractHeaders(headersInit?: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headersInit) return result;

  if (typeof Headers !== 'undefined' && headersInit instanceof Headers) {
    headersInit.forEach((value, key) => {
      result[key] = value;
    });
  } else if (Array.isArray(headersInit)) {
    for (const [key, value] of headersInit) {
      result[key] = value;
    }
  } else if (typeof headersInit === 'object') {
    Object.assign(result, headersInit);
  }

  return result;
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getBaseUrl();
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url =
    endpoint.startsWith('http://') || endpoint.startsWith('https://')
      ? endpoint
      : `${baseUrl}${path}`;

  const incomingHeaders = extractHeaders(options.headers);
  const headers: Record<string, string> = {
    'X-User-Id': getUserId(),
  };

  for (const [key, value] of Object.entries(incomingHeaders)) {
    if (key.toLowerCase() === 'x-user-id') {
      delete headers['X-User-Id'];
      headers[key] = value;
    } else {
      headers[key] = value;
    }
  }

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (isFormData) {
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'content-type') {
        delete headers[key];
      }
    }
  } else {
    const hasContentType = Object.keys(headers).some(
      (k) => k.toLowerCase() === 'content-type'
    );
    if (!hasContentType) {
      headers['Content-Type'] = 'application/json';
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText || 'Error'}`;
    let errorBody: unknown = undefined;

    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorBody = await response.json();
        if (typeof errorBody === 'object' && errorBody !== null) {
          const bodyObj = errorBody as Record<string, unknown>;
          const details: string[] = [];

          if (Array.isArray(bodyObj.errors)) {
            for (const err of bodyObj.errors) {
              if (typeof err === 'string' && err.trim() !== '') {
                details.push(err.trim());
              } else if (typeof err === 'object' && err !== null) {
                const errObj = err as Record<string, unknown>;
                if (typeof errObj.message === 'string') {
                  const loc =
                    typeof errObj.line === 'number'
                      ? ` (line ${errObj.line}, col ${errObj.column ?? 0})`
                      : '';
                  details.push(`${errObj.message}${loc}`);
                } else {
                  details.push(JSON.stringify(err));
                }
              }
            }
          }

          const primaryMsg =
            (typeof bodyObj.message === 'string' && bodyObj.message.trim()) ||
            (typeof bodyObj.error === 'string' && bodyObj.error.trim()) ||
            (typeof bodyObj.detail === 'string' && bodyObj.detail.trim()) ||
            '';

          if (primaryMsg && details.length > 0) {
            errorMessage = `${primaryMsg}: ${details.join('; ')}`;
          } else if (primaryMsg) {
            errorMessage = primaryMsg;
          } else if (details.length > 0) {
            errorMessage = details.join('; ');
          } else {
            errorMessage = JSON.stringify(errorBody);
          }
        }
      } else {
        const text = await response.text();
        if (text && text.trim() !== '') {
          errorMessage = text.trim();
          errorBody = text;
        }
      }
    } catch {
      // ignore parsing failure and use statusText
    }

    throw new HttpError(response.status, errorMessage, errorBody);
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as unknown as T;
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength === '0') {
    return undefined as unknown as T;
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const text = await response.text();
    if (!text || text.trim() === '') {
      return undefined as unknown as T;
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  const rawText = await response.text();
  return (rawText && rawText.trim() !== '' ? rawText : undefined) as unknown as T;
}

export const apiClient = {
  fetch: apiFetch,
  get: <T = unknown>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: 'GET' }),
  post: <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'POST',
      body:
        body !== undefined && !(typeof FormData !== 'undefined' && body instanceof FormData)
          ? JSON.stringify(body)
          : (body as BodyInit),
    }),
  patch: <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body:
        body !== undefined && !(typeof FormData !== 'undefined' && body instanceof FormData)
          ? JSON.stringify(body)
          : (body as BodyInit),
    }),
  put: <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
    apiFetch<T>(endpoint, {
      ...options,
      method: 'PUT',
      body:
        body !== undefined && !(typeof FormData !== 'undefined' && body instanceof FormData)
          ? JSON.stringify(body)
          : (body as BodyInit),
    }),
  delete: <T = unknown>(endpoint: string, options?: RequestInit) =>
    apiFetch<T>(endpoint, { ...options, method: 'DELETE' }),
};

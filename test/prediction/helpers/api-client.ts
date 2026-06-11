import type { ApiEnvironment } from "./api-env.ts";

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ApiErrorEnvelope {
  success: false;
  error: { code: number; message: string };
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export class ApiHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`HTTP ${status}`);
    this.name = "ApiHttpError";
  }
}

/** Thrown when the backend is not reachable (connection refused, DNS, etc.). */
export class ApiUnreachableError extends Error {
  constructor(
    readonly baseUrl: string,
    readonly cause: unknown,
  ) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`API unreachable at ${baseUrl}: ${msg}`);
    this.name = "ApiUnreachableError";
  }
}

export function isApiUnreachableError(err: unknown): err is ApiUnreachableError {
  return err instanceof ApiUnreachableError;
}

function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ETIMEDOUT") return true;
  return /fetch failed|ECONNREFUSED|network/i.test(err.message);
}

function authHeaders(jwt?: string): HeadersInit | undefined {
  if (!jwt) return undefined;
  return { Authorization: `Bearer ${jwt}` };
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function apiFetch(
  env: ApiEnvironment,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const url = `${env.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        ...authHeaders(env.jwt),
        ...(init?.headers ?? {}),
      },
    });
    return { status: res.status, body: await parseJson(res) };
  } catch (err) {
    if (isConnectionError(err)) {
      throw new ApiUnreachableError(env.baseUrl, err);
    }
    throw err;
  }
}

export async function apiGet<T>(
  env: ApiEnvironment,
  path: string,
): Promise<{ status: number; envelope: ApiEnvelope<T> }> {
  const { status, body } = await apiFetch(env, path, { method: "GET" });
  return { status, envelope: body as ApiEnvelope<T> };
}

export async function apiPost<T>(
  env: ApiEnvironment,
  path: string,
  json: unknown,
): Promise<{ status: number; envelope: ApiEnvelope<T> }> {
  const { status, body } = await apiFetch(env, path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });
  return { status, envelope: body as ApiEnvelope<T> };
}

export function assertSuccessEnvelope<T>(
  envelope: ApiEnvelope<T>,
): asserts envelope is ApiSuccessEnvelope<T> {
  if (!envelope || typeof envelope !== "object" || !("success" in envelope)) {
    throw new Error(`Invalid API envelope: ${JSON.stringify(envelope)}`);
  }
  if (!envelope.success) {
    const err = envelope as ApiErrorEnvelope;
    throw new Error(`API error ${err.error?.code}: ${err.error?.message}`);
  }
}

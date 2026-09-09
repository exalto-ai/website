import createClient from 'openapi-fetch';
import type { components, paths } from './generated/api.generated';

export const apiOrigin = typeof __API_ORIGIN__ === 'string' ? __API_ORIGIN__ : 'https://api.exalto.ai';
export const apiHref = (path: string) => new URL(path, apiOrigin || window.location.origin).href;
const client = createClient<paths>({ baseUrl: apiOrigin, credentials: 'include' });

export class PlatformApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'PlatformApiError';
  }
}

function errorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'error' in error && typeof error.error === 'string') {
    return error.error;
  }
  return undefined;
}

function errorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'error' in error && typeof error.error === 'string') {
    return error.error;
  }
  return fallback;
}

type PageOptions = { limit?: number; cursor?: string };

export async function getListedTraces(
  options: PageOptions & { search?: string; provider?: string; shared_after?: number } = {},
) {
  const { data, error, response } = await client.GET('/api/public/traces', {
    params: { query: options },
  });
  if (!response.ok || !data) {
    throw new PlatformApiError(
      errorMessage(error, 'Could not load public Traces.'),
      response.status,
    );
  }
  return data;
}

export async function getRegistry() {
  const { data, error, response } = await client.GET('/api/registry');
  if (!response.ok || !data) {
    throw new PlatformApiError(
      errorMessage(error, 'Could not load the notary Registry.'),
      response.status,
    );
  }
  return data;
}

export async function accessPublicTrace(traceId: string, password: string) {
  const { error, response } = await client.POST('/api/public/traces/{trace_id}/access', {
    params: { path: { trace_id: traceId } },
    body: { password },
  });
  if (!response.ok) {
    throw new PlatformApiError(
      errorMessage(error, 'Could not open this public Trace.'),
      response.status,
      errorCode(error),
    );
  }
}

export async function getPublicTrace(traceId: string) {
  const { data, error, response } = await client.GET('/api/public/traces/{trace_id}', {
    params: { path: { trace_id: traceId } },
  });
  if (!response.ok || !data) {
    throw new PlatformApiError(
      errorMessage(error, 'Could not load this shared session.'),
      response.status,
      errorCode(error),
    );
  }
  return data;
}

export async function getPublicTraceOtlp(traceId: string) {
  const { data, error, response } = await client.GET(
    '/api/public/traces/{trace_id}/trace.otlp.json',
    {
      params: { path: { trace_id: traceId } },
    },
  );
  if (!response.ok || data === undefined) {
    throw new PlatformApiError(
      errorMessage(error, 'Could not load this shared transcript.'),
      response.status,
      errorCode(error),
    );
  }
  return data;
}

export async function downloadPublicTracePackage(traceId: string) {
  const response = await fetch(
    apiHref(`/api/public/traces/${encodeURIComponent(traceId)}/package.llmtrace`),
    { credentials: 'include' },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new PlatformApiError(
      errorMessage(error, 'Could not download this trace package.'),
      response.status,
      errorCode(error),
    );
  }
  return response.blob();
}

export async function reportPublicTrace(
  traceId: string,
  body: {
    reason: 'sensitive_information' | 'harassment' | 'illegal_content' | 'spam' | 'other';
    message?: string;
  },
) {
  const { data, error, response } = await client.POST('/api/public/traces/{trace_id}/reports', {
    params: { path: { trace_id: traceId } },
    body,
  });
  if (!response.ok || !data) {
    throw new PlatformApiError(
      errorMessage(error, 'Could not send this report.'),
      response.status,
      errorCode(error),
    );
  }
  return data;
}

export type HostedVerificationResult = components['schemas']['VerificationResponse'];

export async function verifyTracePackage(file: File): Promise<HostedVerificationResult> {
  const response = await fetch(apiHref('/api/verify'), {
    method: 'POST',
    credentials: 'omit',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/vnd.exalto.notary.trace-package+zip' },
    body: file,
  });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PlatformApiError('verification_unavailable', response.status);
  }
  if (!response.ok) {
    throw new PlatformApiError(
      errorMessage(payload, 'verification_unavailable'),
      response.status,
      errorCode(payload),
    );
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('verified' in payload) ||
    payload.verified !== true
  ) {
    throw new PlatformApiError('verification_unavailable', response.status);
  }
  return payload as HostedVerificationResult;
}

import "server-only";

export interface FetchPolicyOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  minIntervalMs?: number;
  retryStatuses?: number[];
  maxResponseBytes?: number;
}

export interface PolicyFetchResult {
  response: Response;
  body: ArrayBuffer;
  text: () => string;
  json: <T = unknown>() => T;
  etag: string | null;
  lastModified: string | null;
  contentType: string;
  contentLength: number;
}

const DEFAULT_RETRY_STATUSES = [408, 425, 429, 500, 502, 503, 504];
const domainQueues = new Map<string, Promise<void>>();
const lastRequestAt = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response: Response): number | null {
  const value = response.headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

function backoff(attempt: number, base: number, max: number): number {
  const exponential = Math.min(max, base * 2 ** attempt);
  const jitter = Math.floor(Math.random() * Math.max(250, exponential * 0.25));
  return exponential + jitter;
}

async function waitForDomain(url: string, minIntervalMs: number): Promise<void> {
  const domain = new URL(url).hostname;
  const previous = domainQueues.get(domain) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  domainQueues.set(domain, previous.then(() => current));

  await previous;
  try {
    const elapsed = Date.now() - (lastRequestAt.get(domain) ?? 0);
    if (elapsed < minIntervalMs) await sleep(minIntervalMs - elapsed);
    lastRequestAt.set(domain, Date.now());
  } finally {
    release();
    if (domainQueues.get(domain) === current) domainQueues.delete(domain);
  }
}

async function readLimitedBody(response: Response, maxBytes: number): Promise<ArrayBuffer> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error(`Response too large: ${declared} bytes exceeds ${maxBytes}`);
  const body = await response.arrayBuffer();
  if (body.byteLength > maxBytes) throw new Error(`Response too large: ${body.byteLength} bytes exceeds ${maxBytes}`);
  return body;
}

export async function fetchWithPolicy(url: string, options: FetchPolicyOptions = {}): Promise<PolicyFetchResult> {
  const {
    timeoutMs = 20_000,
    retries = 3,
    baseDelayMs = 750,
    maxDelayMs = 20_000,
    minIntervalMs = 350,
    retryStatuses = DEFAULT_RETRY_STATUSES,
    maxResponseBytes = 20 * 1024 * 1024,
    headers,
    ...requestInit
  } = options;

  const mergedHeaders = new Headers(headers);
  if (!mergedHeaders.has("User-Agent")) mergedHeaders.set("User-Agent", "SaudiProjectsRadar/2.0 (+public-data-indexer)");
  if (!mergedHeaders.has("Accept-Language")) mergedHeaders.set("Accept-Language", "ar,en;q=0.8");

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await waitForDomain(url, minIntervalMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...requestInit,
        headers: mergedHeaders,
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);

      if (!response.ok && retryStatuses.includes(response.status) && attempt < retries) {
        await sleep(retryAfterMs(response) ?? backoff(attempt, baseDelayMs, maxDelayMs));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);

      const body = await readLimitedBody(response, maxResponseBytes);
      const decoder = new TextDecoder("utf-8");
      return {
        response,
        body,
        text: () => decoder.decode(body),
        json: <T = unknown>() => JSON.parse(decoder.decode(body)) as T,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        contentType: response.headers.get("content-type") ?? "",
        contentLength: body.byteLength,
      };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt >= retries) break;
      await sleep(backoff(attempt, baseDelayMs, maxDelayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Request failed for ${url}`);
}

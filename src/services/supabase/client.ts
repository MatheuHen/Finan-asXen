import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

const SUPABASE_FETCH_TIMEOUT_MS = 20000;
const SUPABASE_RETRY_COUNT_IDEMPOTENT = 1;
const SUPABASE_RETRY_COUNT_REFRESH_TOKEN = 1;
const SUPABASE_RETRY_BASE_DELAY_MS = 300;
const SUPABASE_RETRY_JITTER_MS = 200;

function isSupabaseRequest(input: RequestInfo | URL) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : "";
  return url.includes(".supabase.co/");
}

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return "";
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit) {
  const fromInit = typeof init?.method === "string" ? init.method : null;
  if (fromInit) return fromInit.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function isAuthRefreshTokenRequest(url: string, method: string) {
  return method === "POST" && url.includes("/auth/v1/token") && url.includes("grant_type=refresh_token");
}

function isIdempotentMethod(method: string) {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function randomJitterMs(max: number) {
  return Math.floor(Math.random() * Math.max(0, max));
}

function isRetryableConnectivityError(err: unknown) {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name?: unknown }).name) : "";
  const message =
    err && typeof err === "object" && "message" in err ? String((err as { message?: unknown }).message) : "";
  const lower = message.toLowerCase();

  if (name === "AbortError") return true;
  if (lower.includes("failed to fetch")) return true;
  if (lower.includes("networkerror")) return true;
  if (lower.includes("load failed")) return true;
  if (lower.includes("the network connection was lost")) return true;
  return false;
}

function wrapConnectivityError(original: unknown, context: { url: string; method: string; attempts: number }) {
  const err = new Error("Não foi possível conectar agora. Tente novamente.");
  (err as { cause?: unknown }).cause = original;
  (err as { context?: unknown }).context = context;
  return err;
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const url = getRequestUrl(input);
  const method = getRequestMethod(input, init);
  const isSupabase = isSupabaseRequest(url);
  const retryCount = isIdempotentMethod(method)
    ? SUPABASE_RETRY_COUNT_IDEMPOTENT
    : isAuthRefreshTokenRequest(url, method)
      ? SUPABASE_RETRY_COUNT_REFRESH_TOKEN
      : 0;

  for (let attempt = 0; attempt <= retryCount; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);
    const abortListener = () => controller.abort();

    try {
      if (init?.signal) {
        if (init.signal.aborted) controller.abort();
        else init.signal.addEventListener("abort", abortListener, { once: true });
      }

      return await fetch(input, { ...init, signal: controller.signal });
    } catch (e) {
      if (isRetryableConnectivityError(e) && attempt < retryCount) {
        const delay =
          SUPABASE_RETRY_BASE_DELAY_MS * (attempt + 1) +
          randomJitterMs(SUPABASE_RETRY_JITTER_MS);
        await sleep(delay);
        continue;
      }

      if (isRetryableConnectivityError(e)) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[Supabase] falha de conexão", { url, method, attempts: attempt + 1, isSupabase }, e);
        }
        throw wrapConnectivityError(e, { url, method, attempts: attempt + 1 });
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
      if (init?.signal) init.signal.removeEventListener("abort", abortListener);
    }
  }

  throw new Error("Não foi possível conectar agora. Tente novamente.");
}

function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error("ERRO CRÍTICO: Variáveis de ambiente do Supabase não encontradas.");
    console.error("Por favor, crie o arquivo .env.local na raiz do projeto com as seguintes chaves:");
    console.error("NEXT_PUBLIC_SUPABASE_URL=");
    console.error("NEXT_PUBLIC_SUPABASE_ANON_KEY=");
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment variables."
    );
  }

  return { url, anonKey };
}

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const { url, anonKey } = getSupabaseConfig();
  // Usar o createBrowserClient do @supabase/ssr que gerencia os cookies automaticamente
  browserClient = createBrowserClient(url, anonKey, {
    global: { fetch: fetchWithTimeout },
    auth: { autoRefreshToken: false },
  });
  return browserClient;
}

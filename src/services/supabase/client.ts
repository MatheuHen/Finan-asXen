import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type SupabaseConfig = {
  url: string;
  anonKey: string;
};

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
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}

import { getSupabaseBrowserClient } from "../supabase/client";

type SignUpData = { email: string; password: string; name: string };
type SignInData = { email: string; password: string };

function translateAuthError(error: unknown): Error {
  const err =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown; status?: unknown; message?: unknown })
      : {};
  const code = err.code ?? err.status;
  const message = typeof err.message === "string" ? err.message.toLowerCase() : "";

  if (message.includes("não foi possível conectar agora") || message.includes("não conseguiu se conectar agora")) {
    return new Error("Não foi possível conectar agora. Tente novamente.");
  }
  if (message.includes("failed to fetch") || message.includes("networkerror")) {
    return new Error("Não foi possível conectar agora. Tente novamente.");
  }
  if (message.includes("invalid login credentials")) {
    return new Error("E-mail ou senha incorretos.");
  }
  if (message.includes("user already registered") || code === "user_already_exists") {
    return new Error("Este e-mail já está cadastrado.");
  }
  if (message.includes("password should be at least")) {
    return new Error("A senha deve ter pelo menos 6 caracteres.");
  }
  if (message.includes("rate limit")) {
    return new Error("Muitas tentativas. Tente novamente mais tarde.");
  }
  if (message.includes("email link")) {
    return new Error("Por favor, verifique seu e-mail para confirmar o cadastro.");
  }

  return new Error("Ocorreu um erro inesperado. Tente novamente.");
}

export const authService = {
  async signUp({ email, password, name }: SignUpData) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });
    if (error) throw translateAuthError(error);
    return data;
  },

  async signIn({ email, password }: SignInData) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw translateAuthError(error);
    return data;
  },

  async signOut() {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw translateAuthError(error);
  },

  async getSession() {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.getSession();
      if (error) throw translateAuthError(error);
      return data.session;
    } catch (e) {
      const err = translateAuthError(e);
      const lower = err.message.toLowerCase();
      if (lower.includes("não conseguiu se conectar") || lower.includes("não foi possível conectar")) return null;
      throw err;
    }
  },
};

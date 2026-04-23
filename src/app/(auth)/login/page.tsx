"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/hooks/auth/useLogin";

const loginSchema = z.object({
  email: z.string().email("Você precisa digitar um e-mail válido"),
  password: z.string().min(6, "Você precisa digitar uma senha com pelo menos 6 caracteres"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { mutate: login, isPending, error } = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginForm) => {
    login(data, {
      onSuccess: () => {
        // Redireciona de forma absoluta forçando o navegador a carregar o layout completo
        window.location.href = "/";
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Você entra</h1>
        <p className="text-sm text-muted-foreground">
          Você digita seus dados para entrar
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder="seu@email.com"
            {...register("email")}
            disabled={isPending}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            {...register("password")}
            disabled={isPending}
          />
          {errors.password && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">
            {error.message?.trim().startsWith("Você") ? error.message : "Você não conseguiu entrar. Tente novamente."}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Você está entrando..." : "Você entra"}
        </Button>
      </form>

      <div className="text-center text-sm">
        Você ainda não tem uma conta?{" "}
        <Link href="/register" className="underline underline-offset-4 hover:text-primary">
          Você cria sua conta
        </Link>
      </div>
    </div>
  );
}

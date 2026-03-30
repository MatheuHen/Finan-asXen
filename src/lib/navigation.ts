export type RouteMeta = {
  title: string
  description: string
}

export const ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "Dashboard",
    description:
      "Visão geral do app: resumo do momento e atalhos para as áreas principais.",
  },
  "/finances": {
    title: "Finanças",
    description:
      "Registro e gestão de receitas e despesas (transações), com tipo, valor, data e status.",
  },
  "/goals": {
    title: "Metas",
    description:
      "Criação e acompanhamento de objetivos financeiros/pessoais até concluir, pausar ou ajustar.",
  },
  "/savings": {
    title: "Economias",
    description:
      "Histórico do dinheiro guardado (aportes livres) para acompanhar evolução ao longo do tempo.",
  },
  "/emergency": {
    title: "Reserva",
    description:
      "Gestão da reserva de emergência: aportes/retiradas e acompanhamento do objetivo de segurança.",
  },
  "/investments": {
    title: "Investimentos",
    description:
      "Cadastro de investimentos/carteiras e registro de aportes, retiradas e rendimentos.",
  },
  "/life-cost": {
    title: "Horas de Vida",
    description:
      "Tradução de gastos em horas/dias de trabalho para entender o impacto real das despesas.",
  },
  "/analytics": {
    title: "Gráficos",
    description:
      "Visualização de dados (períodos, categorias, receita vs despesa) para identificar padrões.",
  },
  "/shared": {
    title: "Compartilhamento",
    description:
      "Área para compartilhar informações com outras pessoas quando o recurso estiver ativo.",
  },
  "/settings": {
    title: "Configurações",
    description:
      "Preferências do app: moeda, limites, metas, conta e opções gerais.",
  },
}


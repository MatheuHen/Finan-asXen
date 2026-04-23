export type RouteMeta = {
  title: string
  description: string
}

export const ROUTE_META: Record<string, RouteMeta> = {
  "/": {
    title: "Seu período",
    description:
      "Veja como você está neste período.",
  },
  "/global": {
    title: "Visão geral",
    description:
      "Veja tudo o que você já construiu.",
  },
  "/finances": {
    title: "Finanças",
    description:
      "Você registra o que ganhou e o que gastou, e acompanha seu dinheiro.",
  },
  "/categories": {
    title: "Categorias",
    description:
      "Você organiza suas movimentações por categoria para entender melhor para onde seu dinheiro vai.",
  },
  "/goals": {
    title: "Metas",
    description:
      "Você define metas e acompanha seu progresso, passo a passo.",
  },
  "/savings": {
    title: "Economias",
    description:
      "Você vê quanto sobrou do que ganhou e como isso evoluiu.",
  },
  "/emergency": {
    title: "Reserva",
    description:
      "Você acompanha sua reserva de segurança: quanto já guardou e quanto falta.",
  },
  "/investments": {
    title: "Investimentos",
    description:
      "Você acompanha quanto colocou, quanto vale hoje e o que rendeu.",
  },
  "/life-cost": {
    title: "Horas de Vida",
    description:
      "Você entende seus gastos em horas da sua vida, para decidir com mais clareza.",
  },
  "/analytics": {
    title: "Gráficos",
    description:
      "Você enxerga tendências e comparações para tomar decisões melhores.",
  },
  "/shared": {
    title: "Compartilhamento",
    description:
      "Você compartilha informações com outras pessoas quando quiser.",
  },
  "/settings": {
    title: "Configurações",
    description:
      "Você ajusta suas preferências e define quanto vale uma hora da sua vida.",
  },
}

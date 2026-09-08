# POSTFY — Memória do Projeto

Este arquivo registra as decisões importantes, mudanças de curso e o estado atual do projeto.

## Decisões Confirmadas

1. **Identidade Visual e Layout**: Estilo SaaS contemporâneo baseado no padrão shadcn/ui. Uso de Tailwind CSS, tipografia legível e contrastes nítidos.
2. **Calendário Editorial**: Total aderência à referência shadcn UI kit calendar (`https://shadcnuikit.com/dashboard/apps/calendar`), com múltiplos modos de visualização (Mês, Semana, Dia, Lista/Agenda), mini calendário lateral de navegação e filtros dinâmicos por clientes, plataformas e status de produção.
3. **Portal do Cliente**: Acesso desacoplado com simulação de visualização pública/link seguro, permitindo ao cliente aprovar diretamente no celular ou desktop, enviar feedback detalhado de ajustes e acompanhar publicações.
4. **Ciclo Completo**: Implementação das fases essenciais: CRM/Comercial -> Clientes -> Produção (Kanban + Calendário) -> Aprovações -> Agendamento -> Indicadores de Saúde da Agência e Automações.

## [2026-09-08] - Atualização de Design e Arquitetura de Regras
* **Ação:** Criação da estrutura base de documentação (`SAAS.md`, `specs/site.md`, `specs/design.md`).
* **Decisão Visual (Nova Referência):** Aprovado o uso de design "Clean", focado no branco com 10% de toques de cor Roxa (Purple) para CTAs e interações. Adicionada a exigência de suporte a Dark Mode.
* **Regra Estabelecida:** Nenhuma diretriz listada nos arquivos de specs ou memória pode ser alterada sem permissão e notificação explícita.
* **Status Atual:** A interface base do sistema (`App.tsx` e `PostfyContext.tsx`) e a maioria dos componentes estruturais já foram refatorados para o novo design system (branco clean, accent roxo, e suporte completo para Dark Mode via Tailwind `dark:` classes). O Toggle de tema foi adicionado ao Topbar. As views internas estão recebendo classes compatíveis.

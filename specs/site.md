# Especificações do Site (Postfy - OS para Agências)

## 1. Visão Geral
* **Objetivo do site:** Fornecer um Sistema Operacional completo (SaaS) para agências de marketing e publicidade gerenciarem produção de conteúdo, aprovações, publicações e relacionamento com clientes.
* **Público-alvo:** Agências de marketing, gestores de tráfego, social medias, diretores de arte e clientes de agências.
* **Produto e proposta de valor:** Centralizar toda a operação da agência em um único lugar, eliminando a dispersão entre WhatsApp, Trello e planilhas, com foco em aprovações rápidas e agendamento de postagens.
* **Idiomas:** Português (PT-BR).

## 2. Escopo e Estrutura
* **Quantidade de páginas:** Arquitetura Single Page Application (SPA) baseada em views/abas (Sidebar de navegação).
* **Seções necessárias:**
    * Dashboard (Visão Geral)
    * Calendário (Visões: Mês, Semana, Dia, Lista)
    * Produção (Quadro Kanban)
    * Aprovações (Fluxo de validação com clientes e ajustes)
    * Clientes (Gestão de perfis)
    * Comercial (CRM e Funil de Vendas)
    * Publicações (Fila de automação e redes)
    * Configurações
* **Funcionalidades:** Controle de status de jobs, multi-visualização de calendários, portal do cliente white-label, indicadores de saúde operacional e métricas.
* **Chamadas para ação (CTAs):** "Novo Conteúdo", "Aprovar em Lote", "Novo Cliente".

## 3. Requisitos Técnicos
* **Stack técnica:** React 18+, Vite, TypeScript, Tailwind CSS, Lucide React (Ícones). (Não alterar sem autorização).
* **Regras de responsividade:** Desktop-first com adaptação fluida. Em telas menores, a sidebar deve ser tratada e os grids devem se adaptar para single-column quando necessário.
* **Requisitos de acessibilidade:** Contraste adequado (WCAG AA), navegação semântica, suporte total a Dark Mode.
* **Requisitos de desempenho:** Renderização otimizada no lado do cliente, evitar re-renders desnecessários em views complexas como calendários e kanban.

## 4. Limites do Projeto
* **Dentro do escopo:** Layouts de interface web da aplicação SaaS, mockups e componentes funcionais no frontend utilizando estados locais para demonstração de uso.
* **Fora do escopo:** Backend real, integrações reais via API (ex: Graph API do Meta) e bancos de dados hospedados na nuvem neste momento (a menos que explicitamente solicitado).

## 5. A Definir
* Integrações OAuth para login de rede social;
* Estruturação de dados para banco de dados cloud quando migrar do estado local.

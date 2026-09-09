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

## [2026-09-08] - Saída do protótipo: autenticação, isolamento e honestidade da interface

Revisão completa do sistema com foco no que impedia colocá-lo em produção.

**Decisões estruturais tomadas:**

1. **Firebase removido.** Era um segundo banco, sem autenticação, com regras
   `allow read, write: if true` — clientes, contratos e o cofre de senhas
   ficavam legíveis e apagáveis por qualquer portador da chave pública. As
   regras foram trancadas em `deny all` e a persistência compartilhada passou a
   ser a API autenticada em `/api/data`.

2. **Autenticação passou para o servidor.** Hash scrypt, sessão assinada em
   cookie `httpOnly`, rate limit. A anterior ignorava a senha e guardava
   `isAuthenticated` no localStorage.

3. **Um backend só.** O Supabase segue documentado como caminho de migração
   (`supabase/schema.sql`, agora com RLS real por workspace), mas não é a fonte
   de verdade. Store em arquivo JSON no servidor enquanto isso.

4. **Interface deixou de anunciar o que não existe.** Publicação nas redes,
   webhooks e integrações passaram a mostrar o estado real. As funções de IA
   propagam erro em vez de devolver texto de exemplo.

5. **Convite de equipe por link**, sem depender de provedor de e-mail.

6. **`@types/react` instalado.** Sem ele o TypeScript não checava nada na árvore
   React: `usePostfy()` era `any`. A instalação revelou seis bugs reais que
   estavam silenciosos em produção.

**Pendências conhecidas, registradas no README:** cobrança, publicação
automática nas redes, envio de e-mail, upload em nuvem, criptografia do cofre de
senhas e assinatura eletrônica de contrato.

## [2026-09-09] - Migração de stack: Supabase, Vercel serverless, R2, Resend e PostHog

Reversão da decisão anterior de manter servidor próprio, a pedido do usuário.

**Stack definida:**
- **Supabase** (Postgres + Auth) como banco e autenticação. Sem servidor de
  aplicação: o navegador fala direto com o banco e a RLS é quem isola.
- **Vercel serverless** (`api/`) só para o que exige segredo: Gemini, R2,
  Resend e o disparo de webhook.
- **Cloudflare R2** para arquivos, por URL pré-assinada — o binário vai do
  navegador direto para o bucket.
- **Resend** para e-mail (domínio `orquesia.com.br` verificado).
- **PostHog** para analytics.
- **Firebase removido de vez.**

**Decisões que valem registro:**

1. **Chave publicável do Supabase embutida no código.** Ela é pública por
   definição (vai para o bundle). Embutir evita que todo deploy novo suba
   inoperante esperando variável de ambiente. A `service_role` nunca entra no
   cliente, e o CI falha se qualquer segredo aparecer no bundle.

2. **RLS com política por papel, não só por posse.** Um designer não cria
   contrato — recusado pelo banco com `42501`. Isso fecha a lacuna que a
   revisão do Codex apontou: até então as permissões por ação só existiam na
   interface.

3. **Persistência por diff.** O contexto tem ~40 mutações; em vez de reescrever
   cada uma, o estado anterior é comparado com o novo e a diferença vira
   insert/update/delete por linha. Resolve também a perda de atualização
   concorrente da arquitetura anterior, que substituía a coleção inteira.

4. **Analytics conservador por padrão.** Session replay e autocapture
   desligados, todo input mascarado, identificação só por id e papel. O sistema
   exibe contratos, faturamento e cofre de senhas de clientes.

**Pendências registradas no README:** cobrança, publicação automática nas redes,
link externo do portal do cliente, criptografia do cofre e assinatura
eletrônica.

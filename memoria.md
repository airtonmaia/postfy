# Orquesia — Memória do Projeto

Histórico vivo: **onde o projeto está, como chegou aqui e o que já foi
descartado**. Serve para quem chega frio — pessoa ou IA — não repetir
discussão encerrada nem refazer caminho que já se mostrou errado.

## Como usar este arquivo

**Leia antes de propor ou construir qualquer coisa.** Depois leia o
`CLAUDE.md`, que é o outro lado da moeda:

| Arquivo | Responde |
|---|---|
| `memoria.md` (este) | **Onde estamos e por quê.** Estado atual, decisões com data, caminhos descartados, bugs conhecidos. |
| `CLAUDE.md` | **Como fazer.** Arquitetura, 10 armadilhas que já custaram produção, convenções de código e de interface. |
| `specs/site.md`, `specs/design.md` | Especificação de produto e de design. |
| `src/data/changelog.ts` | O que o usuário final vê como novidade, versão a versão. |

Não duplique conteúdo entre eles: quando duas fontes dizem a mesma coisa, uma
delas envelhece calada. Se precisar de detalhe de arquitetura ou de armadilha,
**aponte para o `CLAUDE.md` em vez de copiar**.

Regras de manutenção, herdadas do `SAAS.md`:

- Se um pedido contradisser decisão registrada aqui, **pare e avise** antes de
  alterar. Explique qual decisão seria afetada.
- Depois de uma decisão importante aprovada, **atualize este arquivo** — nova
  entrada datada no final, e ajuste a seção "Onde o projeto está agora".

---

## Onde o projeto está agora

*Atualizado em 2026-09-10.*

**Versão 2.11.0.** Para conferir o que está no ar de verdade:
`curl https://app.orquesia.com.br/version.json` — devolve versão, commit e
horário da build. O rodapé do app mostra o mesmo.

**Stack:** React 19 + TypeScript + Vite · Supabase (Postgres + Auth) ·
funções serverless na Vercel (`api/`) · Cloudflare R2 para arquivos · Resend
para e-mail · PostHog para analytics. O navegador fala **direto** com o
Supabase; não há servidor de aplicação. Quem isola uma agência da outra é a
RLS. Detalhe em `CLAUDE.md`.

**Infra:** projeto Supabase `ietpfqqeattymgbqmonq` · projeto Vercel `orquesia`
(deploy automático no push para `main`) · domínio `app.orquesia.com.br`.

### O que funciona de ponta a ponta

Autenticação e multi-agência · convite de equipe · Kanban, Calendário,
Aprovações, Clientes, Comercial · automações · upload para o R2 · IA ·
e-mails transacionais · **Portal do Cliente** (entrada por e-mail com código) ·
Super Admin (Planos, Financeiro, Agências, Usuários, E-mails, Integrações) ·
área `/admin` do produto (Design, SEO, Relatórios) · conexão com Instagram.

### O que ainda não existe

Cobrança e assinatura da agência com o SaaS · publicação automática em conta de
cliente (depende de revisão de app na Meta) · criptografia do cofre de senhas ·
assinatura eletrônica de contrato.

---

## Caminhos já descartados

Não voltar a estes sem uma razão nova e explícita:

1. **Firebase.** Removido em 2026-09-08. Era um segundo banco, sem
   autenticação, com regra `allow read, write: if true`.
2. **Servidor de aplicação próprio** (store em JSON, sessão em cookie).
   Existiu por um dia e foi revertido na migração para Supabase.
3. **Login do portal por telefone.** O número identificava, não autenticava —
   e telefone de empresa costuma estar no rodapé do próprio site. Trocado por
   e-mail com código. A função `portal_entrar(telefone)` foi **removida**, não
   mantida por compatibilidade: deixá-la de pé conservaria o atalho que a
   migração existia para fechar.
4. **Convite para quem já tem conta.** O convite resolve criar conta — problema
   que essa pessoa não tem — e cobrava três pontos de falha em troca: e-mail
   que não chega, link que expira, aceite feito no navegador de outra conta.
   Hoje quem já tem conta é adicionado na hora (`adicionar_membro_existente`).
5. **`supabase db push`.** O histórico de migrações está dessincronizado: ~12
   migrações foram aplicadas no remoto com timestamps diferentes dos arquivos
   locais, então o push tentaria reaplicar tudo. Aplicar uma a uma.

---

## Bugs conhecidos em aberto

Conferidos em 2026-09-10, com arquivo e linha.

| Prioridade | O quê | Onde |
|---|---|---|
| ✅ Resolvido em 2026-09-11 | **Não era falha de segurança — o diagnóstico anterior estava errado.** O token do portal sempre veio do banco: `clients.portal_token` tem default `encode(gen_random_bytes(24), 'hex')`, e os clientes em produção têm 48 caracteres. O `Math.random()` que existia em `addClient` nunca chegava ao Postgres, porque `clientParaLinha` não inclui `portal_token` na escrita — ele só enfeitava o estado do React até o F5. Removido, junto do `buildClientPortalUrl`, que estava morto (desestruturado em `App.tsx` e nunca chamado). |  |
| 🟠 Armadilha 9 | **Relatórios & BI**: `'5min'`, `'1d 14h'` e `'0 min'` são texto fixo; a tabela repete os mesmos valores em toda linha; os filtros de Período e Granularidade não filtram. | `src/components/reports/ReportsView.tsx:138` |
| 🟠 Armadilha 9 | **Card "Insights" do Dashboard** cita "EcoModa Brasil" e "Café Aroma Gourmet", clientes que não existem em agência nenhuma. | `src/components/dashboard/DashboardView.tsx:194` |
| 🟡 | Custo de job usa **R$ 85,00/hora fixo** para toda agência, e o rótulo "Rentabilidade" não compara com contrato nenhum. | `src/components/modals/JobDetailModal.tsx:802` |

**Buraco na guarda:** `tests/telas-honestas.test.ts` protege a armadilha 9, mas
só verifica agência fictícia, percentual fixo e o Financeiro do SaaS. As duas
telas acima passam batido — os clientes do Dashboard não são "agências", e as
métricas do Relatórios não são "percentuais". Ao corrigi-las, **estender o
teste junto**, senão o próximo a mexer reintroduz.

Pendências de infraestrutura estão em `CLAUDE.md` → *Pendências conhecidas*
(senha no histórico do git, revisão de app na Meta, e-mail disparado do
navegador, variáveis de ambiente).

---

## Trabalho em voo

- **Branch `v3.6`** — "lixeira de agências": a metade do servidor está pronta,
  falta o lado da tela. Não mesclada em `main`.

---

# Histórico de decisões

## [2026-09-08] Decisões fundadoras

1. **Identidade visual**: SaaS contemporâneo no padrão shadcn/ui, Tailwind,
   tipografia legível e contraste nítido.
2. **Calendário editorial**: aderente à referência do shadcn UI kit, com Mês,
   Semana, Dia e Lista, mini calendário de navegação e filtros por cliente,
   plataforma e status.
3. **Portal do Cliente**: acesso desacoplado, para o cliente aprovar do celular
   ou do desktop, mandar feedback e acompanhar publicações.
4. **Ciclo completo**: Comercial → Clientes → Produção (Kanban + Calendário) →
   Aprovações → Agendamento → Indicadores e Automações.

## [2026-09-08] Design e arquitetura de regras

* Criada a documentação base (`SAAS.md`, `specs/site.md`, `specs/design.md`).
* **Decisão visual:** design "clean", branco com ~10% de roxo em CTAs e
  interações. Dark mode obrigatório.
* **Regra:** nenhuma diretriz de specs ou memória muda sem permissão explícita.

## [2026-09-08] Saída do protótipo: autenticação, isolamento e honestidade

1. **Firebase removido.** Regras `allow read, write: if true` deixavam
   clientes, contratos e cofre de senhas legíveis e apagáveis por qualquer
   portador da chave pública.
2. **Autenticação no servidor.** Hash scrypt, sessão assinada em cookie
   `httpOnly`, rate limit. A anterior ignorava a senha e guardava
   `isAuthenticated` no `localStorage`.
3. **Um backend só.** Supabase documentado como caminho, store em JSON
   enquanto isso.
4. **Interface deixou de anunciar o que não existe.** Publicação, webhooks e
   integrações passaram a mostrar estado real; a IA propaga erro em vez de
   devolver texto de exemplo.
5. **Convite de equipe por link**, sem depender de provedor de e-mail.
6. **`@types/react` instalado.** Sem ele o TypeScript não checava a árvore
   React — `usePostfy()` era `any`. A instalação revelou seis bugs reais.

## [2026-09-09] Migração de stack: Supabase, Vercel, R2, Resend, PostHog

Reversão da decisão de manter servidor próprio, a pedido do usuário.

1. **Chave publicável do Supabase embutida no código.** É pública por definição
   (vai para o bundle). Embutir evita que todo deploy novo suba inoperante
   esperando variável de ambiente. A `service_role` nunca entra no cliente.
2. **RLS por papel, não só por posse.** Um designer não cria contrato — o banco
   recusa com `42501`. Antes as permissões por ação só existiam na interface.
3. **Persistência por diff.** O contexto tem ~40 mutações; em vez de reescrever
   cada uma, o estado anterior é comparado com o novo e a diferença vira
   insert/update/delete por linha.
4. **Analytics conservador.** Session replay e autocapture desligados, input
   mascarado, identificação só por id e papel — o sistema exibe contratos,
   faturamento e o cofre de senhas dos clientes.

## [2026-09-09] Rotas `/api` em produção, URL por tela e convites (v2.0 → v2.3)

* **Nenhuma rota `/api` jamais funcionou em produção.** Duas causas, ambas
  invisíveis no CI: import relativo em ESM sem a extensão `.js`, e o formato do
  export que o builder da Vercel inspeciona para decidir a assinatura do
  handler. Viraram as armadilhas **0** e **1** do `CLAUDE.md`, com
  `tests/rotas-api.test.ts` de guarda.
* **Cada tela ganhou endereço próprio** (`/kanban`, `/calendario`, …). Depende
  do rewrite no `vercel.json`, que o CI **não valida** — armadilha 6.
* **Convite deixou de criar agência fantasma** para quem chega convidado —
  armadilha 8.

## [2026-09-09] Portal do Cliente, segurança de membros e gestão (v2.4)

Entrega grande, a partir de uma lista de 8 ajustes do usuário.

**Descoberta central:** o Portal do Cliente **nunca funcionou para um cliente
de verdade**. Ele resolvia os dados a partir da lista carregada pela sessão da
agência, então só abria se alguém da equipe estivesse logado no mesmo
navegador. Era prévia interna, não canal com o cliente.

1. **Entrada por e-mail com código.** O cliente informa o e-mail, recebe 6
   dígitos e só entra depois de provar que abriu a caixa. Código guardado como
   hash, 10 minutos de validade, 5 tentativas. As funções de emitir e conferir
   têm `EXECUTE` só para `service_role` e passam pela rota `/api/portal-login`,
   que é quem tem a chave de serviço e o limite de taxa.
2. **Dados do portal por RPC** (`portal_dados`, `portal_aprovar`,
   `portal_pedir_ajuste`), recortados pelo token. É o segundo — e último — uso
   da chave de serviço no projeto, junto de `social_tokens`.
3. **Auto-promoção a `owner` fechada.** A única política de UPDATE em
   `workspace_members` era `user_id = auth.uid()`, sem restrição de coluna:
   qualquer membro virava dono da agência em uma linha de SQL. Agora há trigger
   contra auto-promoção, contra rebaixar o dono sem ser dono, e contra deixar a
   agência sem nenhum dono ativo.
4. **Convite ia para a agência do login**, não para a aberta: quem trocava de
   agência e convidava criava o vínculo no lugar errado. O seletor também
   escondia as demais agências de quem participa de mais de uma.
5. **Membro inativo perde acesso** (`ativo` em `workspace_members`, respeitado
   por `e_membro` e `papel_na_agencia` — vale para toda a RLS de uma vez).
6. **E-mail de aprovação não saía do Kanban.** O disparo só existia ao enviar
   versão nova; arrastar o card para "Para Aprovação" não avisava ninguém.
7. **Troca de agência recarrega a página**, esperando a fila de gravação
   drenar. Só trocar o estado deixava rastro da agência anterior em cor, dados
   e telas com estado próprio.
8. **Aviso de versão nova.** O build publica `version.json`; a aba compara de 2
   em 2 minutos e ao voltar ao foco. Não recarrega sozinho — quem decide a hora
   é quem está usando.

## [2026-09-10] Marca da agência, honestidade e área do produto (v2.5 → v2.11)

* **2.5** — o portal abre com a marca da agência; o link do cliente volta a
  funcionar.
* **2.6** — **Financeiro do SaaS para de inventar receita.** No dia em que foi
  encontrado eram três agências, todas em teste, R$ 0,00 de receita — e a tela
  dizia R$ 591,00, com transações de agências que nunca existiram. Virou a
  **armadilha 9** ("tela não afirma o que não mediu"), com
  `tests/telas-honestas.test.ts` de guarda.
* **2.7.x** — copiar link na barra lateral; botão virou primitivo shadcn; duas
  correções do botão do portal sumindo.
* **2.8** — prévia do slug do portal enquanto se digita o nome da agência.
* **2.9** — área **`/admin`** do produto, com Design, SEO e Relatórios.
* **2.10** — perfil editável por dentro do sistema (nome, foto, senha), e
  nenhuma foto de desconhecido no lugar de gente.
* **2.11** — conexão com Instagram passou a usar **o login do Instagram**, e
  não o do Facebook.

**Decisão que veio junto — duas marcas, e elas não se misturam:**
`saas_settings` é a cara do produto (Orquesia); `workspaces` é a cara de cada
agência. **A agência sobrepõe o produto, nunca o contrário.** A paleta do SaaS
vale só onde não há agência aberta: entrada, cadastro, porta do portal e
`/admin`. Sobrepor na direção oposta apagaria a marca que o cliente da agência
espera ver — que é o motivo de o whitelabel existir.

---

## Nota sobre o nome

O produto é o **Orquesia**. "Postfy" foi o nome anterior e sobrevive em código
(`PostfyContext.tsx`, `usePostfy()`) — renomear tocaria quase todo arquivo do
`src`, e não foi feito. Ao ler o código, os dois nomes são a mesma coisa.

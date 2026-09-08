# Banco de dados (Supabase)

Projeto: **Postfy** — `ietpfqqeattymgbqmonq` (região `sa-east-1`).

As migrações em `migrations/` são a fonte de verdade do schema e já estão
aplicadas nesse projeto. Aplique-as em ordem de nome de arquivo ao provisionar
um ambiente novo (`supabase db push`, ou executando cada arquivo no SQL Editor).

## Modelo

Uma agência é um **workspace**. `workspace_members` liga `auth.users` a um
workspace com um papel, e é essa tabela que sustenta todo o isolamento.

```
auth.users ──< workspace_members >── workspaces
                                          │
        clients, jobs, leads, proposals, contracts,
        automations, notifications, activity_logs,
        client_materials, timesheet_logs, squads
```

Criar agência passa obrigatoriamente pela RPC `public.criar_agencia(nome, nome_do_usuario)`:
`workspaces` não tem política de INSERT, então não há caminho direto.

## Regras de segurança seguidas

Todas vêm da skill oficial do Supabase (`.agents/skills/supabase`) e do guia de
Postgres que a acompanha:

- **Helpers de RLS ficam no schema `private`**, não em `public`. Em `public`
  toda função recebe `EXECUTE` para `PUBLIC` por padrão, e uma
  `SECURITY DEFINER` ali vira endpoint chamável por qualquer um.
- **`SECURITY DEFINER` sempre com `set search_path = ''`** e com a checagem de
  `auth.uid()` dentro do corpo.
- **`TO authenticated` nunca sozinho.** Papel sem predicado de posse é
  autenticação sem autorização (BOLA/IDOR); toda política combina os dois.
- **`UPDATE` com `USING` *e* `WITH CHECK`.** Sem o `WITH CHECK`, dá para mover
  uma linha para outra agência durante a própria atualização.
- **Chamadas de função envoltas em `(select ...)`** nas políticas, para o
  Postgres avaliar uma vez por consulta em vez de uma vez por linha.
- **Índice em toda coluna usada em política** (`workspace_id`, `user_id`).

## Permissões por papel

Leitura é de qualquer membro da agência. Escrita depende do papel:

| Tabelas | Quem escreve |
| --- | --- |
| clients, jobs, automations, notifications, activity_logs, client_materials, timesheet_logs, squads | owner, admin, manager, social_media, designer, copywriter |
| leads, proposals, contracts | owner, admin, manager, financial |

Ou seja: um designer não cria contrato nem proposta, e isso é imposto pelo
banco — não pela interface, que qualquer um contorna chamando a API direto.

## Verificação

O isolamento foi testado impersonando dois usuários via
`request.jwt.claims`, com sete verificações, todas aprovadas:

| Verificação | Resultado |
| --- | --- |
| A enxerga os próprios clientes | 1 (ok) |
| B enxerga clientes da A | 0 (ok) |
| B enxerga agências alheias | só a dele (ok) |
| B grava na agência da A | bloqueado, 42501 (ok) |
| B enxerga a equipe da A | 0 (ok) |
| designer cria contrato | bloqueado, 42501 (ok) |
| designer cria cliente | permitido (ok) |

Depois de qualquer mudança de schema, rode o advisor de segurança
(`get_advisors` no MCP, ou `supabase db advisors`). O único aviso esperado hoje
é `criar_agencia` ser chamável por usuário autenticado — que é o comportamento
pretendido, já que ela é o cadastro e confere `auth.uid()` internamente.

## Observação conhecida

Uma agência sem nenhum membro fica inalcançável pelo RLS (ninguém passa no
predicado). Não é falha de segurança, mas acumula lixo se o último membro for
removido. Se isso virar rotina, vale um `on delete` que também limpe a agência,
ou uma transferência de propriedade obrigatória antes da remoção.

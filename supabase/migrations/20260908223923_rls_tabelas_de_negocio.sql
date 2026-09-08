-- =====================================================================
-- RLS de todas as tabelas de negócio.
--
-- Padrão seguido em cada política:
--  - TO authenticated nunca sozinho: papel só autoriza junto do predicado
--    de posse pelo workspace;
--  - chamadas de função envoltas em (select ...), para o Postgres avaliar
--    uma vez por consulta em vez de uma vez por linha;
--  - UPDATE com USING e WITH CHECK, senão dá para mover a linha para outra
--    agência durante a própria atualização.
--
-- Leitura é de qualquer membro; escrita depende do papel. Um designer não
-- cria contrato nem proposta, e isso é imposto aqui, no banco — não na
-- interface, que qualquer um pode contornar.
-- =====================================================================

do $$
declare
    t text;
    papeis text;
    operacionais text[] := array[
        'clients','jobs','automations','notifications',
        'activity_logs','client_materials','timesheet_logs','squads'
    ];
    comerciais text[] := array['leads','proposals','contracts'];
    papeis_operacao constant text :=
        '''owner'',''admin'',''manager'',''social_media'',''designer'',''copywriter''';
    papeis_comercial constant text :=
        '''owner'',''admin'',''manager'',''financial''';
begin
    foreach t in array (operacionais || comerciais)
    loop
        if t = any(comerciais) then
            papeis := papeis_comercial;
        else
            papeis := papeis_operacao;
        end if;

        execute format('alter table public.%I enable row level security', t);

        -- Leitura: qualquer membro da agência.
        execute format('drop policy if exists "membros leem" on public.%I', t);
        execute format(
            'create policy "membros leem" on public.%I '
            'for select to authenticated '
            'using ((select private.e_membro(workspace_id)))',
            t
        );

        -- Inserção: papel com permissão de escrita, e a linha nasce
        -- obrigatoriamente na agência de quem está escrevendo.
        execute format('drop policy if exists "equipe insere" on public.%I', t);
        execute format(
            'create policy "equipe insere" on public.%I '
            'for insert to authenticated '
            'with check ((select private.papel_na_agencia(workspace_id)) in (%s))',
            t, papeis
        );

        execute format('drop policy if exists "equipe atualiza" on public.%I', t);
        execute format(
            'create policy "equipe atualiza" on public.%I '
            'for update to authenticated '
            'using ((select private.papel_na_agencia(workspace_id)) in (%s)) '
            'with check ((select private.papel_na_agencia(workspace_id)) in (%s))',
            t, papeis, papeis
        );

        execute format('drop policy if exists "equipe remove" on public.%I', t);
        execute format(
            'create policy "equipe remove" on public.%I '
            'for delete to authenticated '
            'using ((select private.papel_na_agencia(workspace_id)) in (%s))',
            t, papeis
        );
    end loop;
end
$$;

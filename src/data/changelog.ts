/**
 * Histórico de versões.
 *
 * **Atualize este arquivo em toda entrega.** É a única fonte do que a tela de
 * novidades mostra, e a razão de ela existir separada do componente: mexer no
 * changelog não deveria exigir mexer em interface.
 *
 * Duas regras, aprendidas do que estava aqui antes:
 *
 * 1. Só entra o que existe. A lista anterior anunciava "Portal do Cliente com
 *    Login via WhatsApp", "Componentes Shadcn/UI em todo o sistema" e
 *    "Exportação de relatório em PDF" — nenhum deles construído. Um changelog
 *    que descreve o que se pretendia fazer é pior que não ter changelog: o
 *    cliente cobra o que leu.
 *
 * 2. Correção também é novidade. Boa parte do valor entregue aqui foi
 *    conserto, e esconder isso faria a lista parecer parada em dias que
 *    mudaram muito.
 */

export interface EntradaDoChangelog {
  versao: string;
  /** ISO. A tela formata. */
  data: string;
  /** Uma frase sobre o que a entrega significa. Aparece sem expandir. */
  resumo: string;
  novidades?: string[];
  melhorias?: string[];
  corrigido?: string[];
}

export const CHANGELOG: EntradaDoChangelog[] = [
  {
    versao: '2.10.0',
    data: '2026-09-10',
    resumo: 'A conexão com o Instagram passou a usar o fluxo certo — o mesmo que funcionou no teste manual.',
    novidades: [
      'Conectar o Instagram agora é pela conta do Instagram, sem precisar de uma página do Facebook no meio. A agência entra com a conta do cliente e pronto.',
      'Admin → Integrações ganhou um bloco do Instagram: mostra a URL de redirecionamento exata para colar na Meta, com botão de copiar, quais permissões o sistema pede e quais credenciais já estão no servidor.',
      'A conexão se mantém sozinha: o acesso que o Instagram concede vale 60 dias, e o sistema renova antes de vencer. Antes, uma conta que ficasse dois meses sem publicar simplesmente parava de funcionar.',
    ],
    corrigido: [
      'A conexão com o Instagram estava montada para o fluxo do login do Facebook, enquanto o aplicativo na Meta está configurado para o login do Instagram. Na prática a autorização abria, pedia a senha e falhava no fim, sem dizer o motivo.',
      'O sistema pedia duas permissões de página do Facebook que fazem a tela de autorização do Instagram recusar o acesso.',
      'A página de retorno da autorização estava declarada como se recebesse um envio de formulário, e não uma visita do navegador — o que podia deixar a conexão sem resposta.',
      'Conexão gravada sem a credencial agora é desfeita na hora, com aviso. Antes ela ficava na lista parecendo conectada e só falhava na hora de publicar.',
    ],
  },
  {
    versao: '2.9.0',
    data: '2026-09-10',
    resumo: 'A administração do Orquesia ganhou área própria em /admin, com Design, SEO e Relatórios.',
    novidades: [
      'Nova área /admin, com a mesma cara do sistema e os menus de quem administra o produto: Agências, Usuários, Planos, Financeiro, Relatórios, E-mails do Sistema, Integrações, SEO e Design. Quem administra a plataforma tem um botão no topo do app; o endereço /admin também abre direto.',
      'Tela de Design: a marca, a paleta e as artes das telas de entrada agora se trocam pelo painel. Antes a foto da tela de login e a cor roxa estavam escritas no código, e mudar qualquer uma exigia uma nova publicação do sistema.',
      'Tela de SEO: título, descrição e imagem que aparecem no Google e no cartão que o WhatsApp monta quando alguém manda o link. A prévia é montada na hora, do jeito que vai ficar.',
      'Tela de Relatórios do produto: quantas agências, contas, clientes e conteúdos existem somando toda a base, com os últimos doze meses mês a mês. Também avisa quando alguma conta ficou sem agência ou algum convite não foi aceito.',
    ],
    melhorias: [
      'Os endereços das telas de administração passaram de /super-admin/... para /admin/... Os links antigos continuam abrindo.',
      'O menu de administração saiu de dentro da barra lateral da agência: eram seis itens do dia a dia de ninguém competindo por espaço com o menu que a equipe usa toda hora.',
    ],
    corrigido: [
      'O link do Orquesia compartilhado no WhatsApp, no LinkedIn ou no Slack aparecia como um retângulo cinza, sem título nem imagem: esses aplicativos leem a página antes de o sistema carregar. Agora o servidor responde a eles com os dados certos.',
    ],
  },
  {
    versao: '2.8.0',
    data: '2026-09-10',
    resumo: 'O cadastro da agência mostra o endereço do portal enquanto você digita o nome.',
    novidades: [
      'Ao criar uma agência, o endereço do portal aparece embaixo do nome: "Ação & Cia" vira /portal-do-cliente?agencia=acao-cia. É por ele que o seu cliente entra, e agora dá para ver antes de gravar.',
    ],
    corrigido: [
      'A tela de cadastro mostrava uma foto qualquer no lugar da marca do Orquesia — era um link do Pinterest, endereço de terceiro que pode sumir ou trocar de conteúdo. Agora a marca é desenhada pelo próprio sistema.',
      'A imagem de fundo da tela de entrada também vinha de fora. Passou a ser servida junto com o sistema, e a tela deixa de depender de um servidor que não é nosso.',
    ],
  },
  {
    versao: '2.7.2',
    data: '2026-09-09',
    resumo: 'O botão do Portal do Cliente some da barra lateral: corrigido.',
    corrigido: [
      'Com o filtro em "todos os clientes" — que é o padrão — o botão do Portal do Cliente não aparecia na barra lateral, sobrando só o de copiar. Agora os dois estão sempre lá, e o botão diz de qual cliente é a prévia ao passar o mouse.',
    ],
  },
  {
    versao: '2.7.1',
    data: '2026-09-09',
    resumo: 'Na barra lateral, o botão do portal e o copiar link ficam lado a lado.',
    corrigido: [
      'A versão anterior trocou o botão do Portal do Cliente pelo par com o copiar, em vez de manter os dois. Agora o botão está de volta, com o copiar ao lado.',
    ],
  },
  {
    versao: '2.7.0',
    data: '2026-09-09',
    resumo: 'O copiar link chegou à barra lateral, e os botões passam a sair de uma peça só.',
    melhorias: [
      'Os botões do sistema passam a vir de um componente único, no formato shadcn/ui, com as cores que o Orquesia já usava. Muda como o código é escrito, não a aparência.',
    ],
    corrigido: [
      'A barra lateral era o único lugar do sistema com o botão do Portal do Cliente sem o copiar link ao lado.',
      'Com o filtro em "todos os clientes", esse botão abria a prévia de um cliente qualquer, sem dizer qual. Agora ele só abre com um cliente escolhido — e o copiar link continua ali, porque não depende de cliente nenhum.',
    ],
  },
  {
    versao: '2.6.0',
    data: '2026-09-09',
    resumo: 'O Financeiro do SaaS para de inventar receita, e o link da prévia fica legível.',
    melhorias: [
      'O link da prévia do portal traz o nome do cliente em vez do código interno: /portal-do-cliente?cliente=airton-maia. Os links antigos continuam abrindo.',
      'O botão de copiar o link do portal ganhou rótulo. Como só ícone, ninguém o encontrava.',
    ],
    corrigido: [
      'O painel Financeiro do SaaS estimava a receita multiplicando o número de agências por R$ 197 — contando as que estão em teste — e listava quatro pagamentos de agências que nunca existiram. No dia da correção eram três agências, todas em teste, e a tela mostrava R$ 591,00. Agora ela mostra só o que o banco sabe, e diz o que falta para haver faturamento de verdade.',
    ],
  },
  {
    versao: '2.5.0',
    data: '2026-09-09',
    resumo: 'O portal abre com a marca da sua agência, e o link para o cliente volta a funcionar.',
    novidades: [
      'O portal abre com o nome, a logo e as cores da sua agência, e não com as do Orquesia. O cliente reconhece de quem é a página antes de digitar qualquer coisa.',
      'Botão para copiar o link do portal, ao lado da prévia, nas telas de Clientes e de conteúdo.',
    ],
    melhorias: [
      'A foto da tela de entrada do portal ficou 11x mais leve.',
    ],
    corrigido: [
      'O link de aprovação levava o identificador interno do cliente no lugar da credencial do portal: quem recebia caía numa tela vazia. Agora o link leva a agência, e quem entra prova quem é pelo código do e-mail.',
      'O botão de compartilhar por WhatsApp montava um endereço num formato que o sistema não lê. Nunca abriu portal nenhum.',
      'Quando a credencial do servidor é recusada pelo banco, a tela passa a dizer isso e o que fazer, em vez de "tente novamente em instantes". A aba Integrações também deixa de mostrar o banco como saudável nesse caso.',
    ],
  },
  {
    versao: '2.4.0',
    data: '2026-09-09',
    resumo: 'O Portal do Cliente passa a funcionar de verdade, com entrada por código no e-mail.',
    novidades: [
      'O cliente entra no portal pelo próprio e-mail: recebe um código de 6 dígitos e só acessa depois de provar que abriu a caixa. Antes bastava saber o telefone — que costuma estar no rodapé do site da empresa.',
      'Cronograma do portal virou calendário mensal, com miniatura da arte, prévia grande ao passar o mouse e aprovação direto do card.',
      'Super Admin ganhou a tela de Usuários: todas as contas do produto e as agências de cada uma, com destaque para quem ficou sem nenhuma.',
      'Convidar quem já tem conta deixou de pedir link: a pessoa recebe um e-mail e aceita o cargo com a senha que já usa.',
      'Papel, suspensão de acesso e remoção de membros agora se resolvem na tela de Usuários da agência.',
      'Quando sai uma versão nova, quem está com o sistema aberto recebe o aviso em vez de continuar na versão antiga sem saber.',
    ],
    melhorias: [
      'O seletor de agência virou a própria logo, na barra lateral — eram dois lugares mostrando a mesma marca, e só um trocava de agência.',
      'Trocar de agência recarrega o sistema, esperando o que estava sendo gravado terminar. Cor e dados deixam de vir misturados da agência anterior.',
      'As artes do portal aparecem na proporção real da rede: 4:5 no feed, 9:16 em Reels e Stories.',
    ],
    corrigido: [
      'Quem participava de mais de uma agência enxergava só uma no seletor, sem caminho para as outras.',
      'O convite ia sempre para a agência do login, não para a que estava aberta: convidar alguém depois de trocar de agência criava o vínculo no lugar errado.',
      'Mover um conteúdo para "Para Aprovação" no Kanban não avisava o cliente por e-mail — o disparo só existia ao enviar uma versão nova.',
      'Qualquer membro podia se promover a proprietário editando o próprio vínculo.',
      'O portal só abria com alguém da agência logado no mesmo navegador: para o cliente de verdade, ele carregava vazio.',
      'A tela de Usuários misturava, numa lista só, as equipes de todas as agências da pessoa.',
    ],
  },
  {
    versao: '2.3.0',
    data: '2026-09-09',
    resumo: 'Cada tela ganha endereço próprio: recarregar não joga mais você no Dashboard.',
    novidades: [
      'Endereço próprio para cada menu — /calendario, /kanban, /clientes. Dá para mandar link de tela para alguém da equipe, e o favoritar do navegador passa a funcionar.',
      'As abas de Configurações também têm endereço: /configuracoes/usuarios abre direto em Usuários.',
    ],
    melhorias: [
      'Voltar e avançar do navegador navegam entre as telas.',
    ],
    corrigido: [
      'Recarregar a página devolvia você para o Dashboard, de qualquer tela onde estivesse.',
    ],
  },
  {
    versao: '2.2.0',
    data: '2026-09-09',
    resumo: 'Quem entra por convite passa a cair na agência certa.',
    melhorias: [
      'Esta tela de novidades virou uma linha do tempo: cada entrega recolhe, e o que mudou aparece separado entre novidades, melhorias e correções.',
    ],
    corrigido: [
      'Aceitar um convite criava uma agência vazia em nome do convidado, e era nela que a pessoa entrava — parecia que o convite não tinha funcionado. Quem chega por convite não ganha mais agência própria, e cai direto na agência que o convidou.',
      'A agência inicial de quem participa de mais de uma podia mudar de uma recarga para a outra.',
    ],
  },
  {
    versao: '2.1.0',
    data: '2026-09-09',
    resumo: 'Conteúdo novo deixa de nascer com uma foto de banco no lugar da arte.',
    melhorias: [
      'O menu Super Admin virou submenu recolhível, e abre sozinho quando você já está numa das telas dele.',
      'Conteúdo sem arte aparece como espaço identificado na prévia do feed, em vez de uma imagem que ninguém aprovou.',
    ],
    corrigido: [
      'Todo conteúdo novo nascia com a mesma foto do Unsplash gravada como arte real. Quem não reparasse publicava com ela.',
    ],
  },
  {
    versao: '2.0.0',
    data: '2026-09-09',
    resumo: 'Upload, IA e e-mail passam a funcionar: as rotas que recebem dados ficavam penduradas.',
    novidades: [
      'Versão e horário da build no canto inferior direito, para saber se já subiu sem precisar adivinhar.',
      'Integrações separadas: a infraestrutura do produto foi para o Super Admin, e a agência vê só as contas que ela conecta.',
    ],
    corrigido: [
      'Seis rotas que recebem dados nunca respondiam — upload, IA, convite, e-mail, webhook e conexão social. O corpo da requisição já vinha consumido pelo servidor, e a função esperava para sempre por algo que nunca chegaria.',
      'O carregamento do banco era interpretado como inserção. Era a causa da multiplicação de registros a cada recarga.',
      'O bucket de arquivos não tinha política de CORS, então o navegador bloqueava o envio antes de sair.',
    ],
  },
  {
    versao: '1.9.0',
    data: '2026-09-09',
    resumo: 'As rotas do servidor voltam a existir. Nenhuma tinha funcionado até aqui.',
    corrigido: [
      'Import sem extensão de arquivo derrubava toda função do servidor antes da primeira linha rodar. Nenhuma ferramenta local acusava.',
      'O projeto fixava uma versão experimental do construtor da Vercel por uma dependência que ninguém usava.',
    ],
    melhorias: [
      'Rota de diagnóstico que separa problema de plataforma de problema de código numa requisição.',
    ],
  },
  {
    versao: '1.6.0',
    data: '2026-09-09',
    resumo: 'Base da publicação automática nas redes e fim do arquivo guardado dentro do registro.',
    novidades: [
      'Conexão de conta do Instagram, fila de publicação e worker agendado. Publicar de verdade ainda depende de aprovação do app na Meta.',
    ],
    melhorias: [
      'O token da rede social fica numa tabela que nenhuma sessão alcança — nem a do dono da agência. Só o servidor lê.',
      'Logo e anexos vão para o armazenamento em nuvem, com barra de progresso.',
    ],
    corrigido: [
      'Imagem virava texto dentro do próprio registro. Um cliente com logo ocupou 4,8 MB e estourou o limite do navegador.',
    ],
  },
  {
    versao: '1.5.0',
    data: '2026-09-09',
    resumo: 'Automações passam a executar, e os e-mails do sistema passam a sair.',
    novidades: [
      'Regras com gatilho e ação de verdade: conteúdo enviado para aprovação, aprovado e pedido de ajustes, disparando e-mail ou webhook.',
      'Os quatro e-mails do fluxo de aprovação, editáveis pelo dono do SaaS com prévia.',
    ],
    corrigido: [
      'As automações eram texto livre que nada executava, com um contador de execuções que ninguém incrementava.',
    ],
  },
  {
    versao: '1.4.0',
    data: '2026-09-09',
    resumo: 'Administrar o produto deixa de ser um papel dentro da agência.',
    novidades: [
      'Menu Super Admin com planos, financeiro, lista de agências e e-mails do sistema.',
    ],
    corrigido: [
      'O menu de gestão do SaaS aparecia para todo cliente que se cadastrava, porque a permissão vinha do papel de dono de agência.',
    ],
  },
  {
    versao: '1.3.0',
    data: '2026-09-09',
    resumo: 'Nada de dado da agência fica guardado no navegador.',
    melhorias: [
      'Tema e última agência viraram preferência da conta, e seguem você entre computador e celular.',
      'A tela de integrações passa a consultar o servidor em vez de exibir uma lista escrita à mão.',
    ],
    corrigido: [
      'O cache do navegador estourava e parte do estado ficava só nele, fazendo a tela depender de qual máquina abriu.',
    ],
  },
  {
    versao: '1.2.0',
    data: '2026-09-09',
    resumo: 'O que você cria passa a ser salvo de verdade.',
    corrigido: [
      'Nada que era criado chegava ao banco: o identificador gerado não era aceito, e a tela seguia mostrando o item que nunca foi gravado.',
      'Registros ligados entre si eram gravados fora de ordem, e o filho era recusado por chegar antes do pai.',
    ],
  },
  {
    versao: '1.1.0',
    data: '2026-09-09',
    resumo: 'A geração de texto deixa de depender de um fornecedor só.',
    melhorias: [
      'Troca de fornecedor de IA por configuração, sem alterar código. Padrão no OpenRouter, com modelos gratuitos.',
      'A falha da IA aparece na tela em vez de sumir no console.',
    ],
  },
  {
    versao: '1.0.0',
    data: '2026-09-09',
    resumo: 'Banco de dados real, login de verdade e isolamento entre agências.',
    novidades: [
      'Postgres com isolamento por agência aplicado pelo próprio banco, e não pela interface.',
      'Login, cadastro, recuperação de senha e convite de equipe por e-mail.',
    ],
    melhorias: [
      'Arquivos passam a ir do navegador direto para o armazenamento em nuvem.',
      'Análise de uso com captura automática e gravação de sessão desligadas: o sistema exibe contrato, faturamento e senhas de clientes.',
    ],
  },
];

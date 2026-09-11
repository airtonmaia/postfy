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
    versao: '2.24.0',
    data: '2026-09-11',
    resumo:
      'O agendador da 2.23.0 estava escrito mas não ligado. Agora está de pé, conferido, e roda a cada 5 minutos.',
    corrigido: [
      'A troca do agendador do GitHub pelo do banco não tinha sido aplicada — e o antigo já havia sido desligado. Entre uma coisa e outra o sistema ficou sem agendador nenhum: um post marcado não sairia nunca, e a fila só encheria de "pendente".',
      'O disparo tinha um erro de endereço que só apareceria quando o agendador rodasse pela primeira vez. Corrigido e conferido de ponta a ponta: o agendador chamou o publicador e recebeu resposta.',
    ],
    melhorias: [
      'A verificação do agendador virou teste automático: quem mexer nele não consegue mais deixar dois agendadores ligados, nenhum ligado, ou o endereço errado sem o CI acusar.',
    ],
  },
  {
    versao: '2.23.0',
    data: '2026-09-11',
    resumo:
      'O agendador passou a ser pontual: o horário que você escolhe é o horário em que o post sai.',
    corrigido: [
      'O agendamento atrasava horas. Quem chamava o publicador era o agendador do GitHub, que em 52 horas rodou 15 vezes em vez de 631 — na prática, uma passada a cada 2 a 5 horas. Um post marcado para as 10:00 podia sair às 14:00, no perfil do cliente.',
      'Pelo mesmo motivo, o e-mail de aviso ao cliente também saía com horas de atraso: ele sai na mesma passada da publicação.',
    ],
    melhorias: [
      'Quem agenda agora é o próprio banco de dados, a cada 5 minutos de verdade. Não entrou nenhum serviço novo, e a chave do agendador não sai do nosso ambiente.',
      'O histórico de cada passada fica gravado e consultável, então dá para responder "o agendador rodou?" com data e hora em vez de suposição.',
    ],
  },
  {
    versao: '2.22.0',
    data: '2026-09-11',
    resumo:
      'A ficha do cliente ganhou endereço próprio, os nomes das abas agora batem com os do portal, e cada perfil mostra seus canais conectados.',
    novidades: [
      'Nova aba "Conexões do perfil" dentro do cliente: mostra os canais da Meta ligados àquele perfil e conecta o Instagram em um clique, sem passar pela lista de todos os clientes.',
      'A ficha do cliente tem URL própria — /clientes/nome-do-cliente. Dá para recarregar sem voltar à lista, usar o voltar do navegador para fechar a ficha, e mandar o link do cadastro para alguém da equipe.',
    ],
    melhorias: [
      'As abas do cliente passaram a ter os mesmos nomes do portal: "Arquivos & Drive" virou Arquivos, "Cofre de Senhas" virou Senhas e "Briefing da Marca" virou Briefing. A agência e o cliente olham para as mesmas coisas — agora chamam pelo mesmo nome ao telefone.',
      'Facebook, Threads e WhatsApp aparecem na lista de conexões dizendo exatamente o que falta em cada um, em vez de um botão que abriria e falharia depois do login.',
    ],
  },
  {
    versao: '2.21.0',
    data: '2026-09-11',
    resumo:
      'O agendamento saiu do papel: o conteúdo aprovado vai para a fila e o Instagram publica sozinho na data.',
    novidades: [
      'Botão "Publicar na data" no Agendamento: é ele que coloca o conteúdo na fila do servidor. Continua sendo um clique seu, de propósito — post publicado no perfil do cliente não volta.',
      'Cada conta do Instagram agora é conectada a um cliente. É assim que o agendador sabe em qual perfil postar.',
      'Dá para tirar da fila enquanto não foi ao ar, sem precisar mexer no banco.',
      'Cada card diz o que vai acontecer de verdade na data: o que publica sozinho, o que fica para você postar, e se a conta do cliente não está conectada.',
    ],
    corrigido: [
      'O agendamento não publicava nada. A fila do servidor existia e nenhuma tela colocava conteúdo nela — o card ficava "Agendado", a data passava, e a peça não ia ao ar. Sem erro em lugar nenhum.',
      'Toda conexão do Instagram nascia sem dono: a conta ficava ligada à agência e não ao cliente, então não havia como escolher o perfil na hora de publicar.',
      'A tela chamava de "fila de disparos" a lista de conteúdos com status Agendado, que é outra coisa. Agora ela mostra a fila de verdade, com pendente, publicado e falhou.',
      'O seletor de canais deixava marcar seis redes como se todas fossem publicar sozinhas. Só o Instagram publica; as outras agora dizem, na hora da escolha, que a postagem é manual.',
    ],
  },
  {
    versao: '2.20.0',
    data: '2026-09-11',
    resumo: 'Escrever a legenda deixou de ser um campo em branco: barra de ferramentas, contador por rede e geração por IA.',
    novidades: [
      'A legenda ganhou barra de ferramentas: negrito, itálico, hashtag, menção, link e emoji — tudo inserido onde o cursor está, não no fim do texto.',
      'Botão de IA na legenda. Ele usa o título do conteúdo e o briefing do cliente (tom de voz, público-alvo, dores e objetivo do mês) para escrever a primeira versão.',
      'Contador de caracteres com o limite da rede escolhida. Com mais de uma rede marcada, vale o limite da mais apertada — e a tela diz qual é: com Instagram e X juntos, o teto é 280.',
      'Localização e primeiro comentário saíram do meio do formulário e viraram ícones ao lado da legenda, cada um abrindo numa janela própria. O ícone acende quando o campo tem conteúdo.',
      'Novo campo Marcar pessoas, no mesmo lugar: os perfis a marcar ficam anotados no conteúdo em vez de combinados por fora.',
      'O primeiro comentário passou a contar as hashtags somando com as da legenda — que é como o Instagram conta. Mandar as hashtags para o comentário limpa a legenda, mas não aumenta o teto de 30.',
    ],
    melhorias: [
      'Todo botão que é só ícone ganhou explicação ao passar o mouse.',
      'A marca enviada em Admin → Design passou a aparecer também na barra lateral da administração — que era o que aquela tela já prometia em texto.',
    ],
    corrigido: [
      'O texto do conteúdo passava do limite da rede sem nenhum aviso. O erro só aparecia na hora de publicar, depois de o cliente já ter aprovado.',
      'Admin → Integrações não rolava: tudo abaixo do Estado da infraestrutura ficava inalcançável. A tela também estava sem o respiro das bordas — era a única das nove telas da administração sem a casca padrão.',
    ],
  },
  {
    versao: '2.19.0',
    data: '2026-09-11',
    resumo: 'O sistema passou a carregar só o que a tela precisa — e continua rápido com anos de histórico.',
    melhorias: [
      'Entrar ficou mais rápido, e continua rápido conforme a agência acumula conteúdo. Antes o app baixava tudo o que a agência já produziu a cada acesso.',
      'Todo conteúdo em aberto continua vindo na hora. O que já foi publicado vem dos últimos 90 dias — e o resto é buscado quando você navega o calendário para trás ou pede um relatório mais longo.',
      'A tela de novidades, o cadastro e a porta do portal pararam de consultar a marca do produto a cada abertura.',
      'O agendador de publicações passou a trabalhar por tempo, não por lote fixo: no horário de pico ele publica mais, e nunca é interrompido no meio de uma publicação.',
    ],
  },
  {
    versao: '2.18.0',
    data: '2026-09-11',
    resumo: 'Um conteúdo agora vai para mais de uma rede, e a prévia mostra como ele fica em cada uma.',
    novidades: [
      'Dá para marcar Instagram e Facebook no mesmo conteúdo, em vez de cadastrar duas vezes a mesma arte com duas aprovações.',
      'A prévia ganhou uma aba por rede escolhida — e só das escolhidas. Trocando a aba, você vê o mesmo post do jeito que cada rede vai mostrar.',
      'No carrossel dá para navegar pelas páginas (← 1/5 →), com as bolinhas embaixo da arte. Antes só a primeira aparecia, e é justamente a terceira que costuma estar na proporção errada.',
      'Botão Celular / Computador: a mesma legenda quebra em pontos diferentes nas duas larguras.',
    ],
    melhorias: [
      'O formato agora oferece só o que existe em todas as redes marcadas. Instagram e YouTube, por exemplo, só têm o vídeo curto em comum — antes dava para escolher Story para o YouTube, e a falha só aparecia na hora de publicar.',
      'A prévia mostra a localização digitada e a data do agendamento, além do "Ver mais" no ponto em que o Instagram corta a legenda.',
    ],
  },
  {
    versao: '2.17.0',
    data: '2026-09-11',
    resumo: 'O teste grátis passou a ter prazo de verdade — com data de fim e uma tela que avisa quando acaba.',
    novidades: [
      'Agência nova nasce com 14 dias de teste. A data existia no cadastro desde sempre e ninguém escrevia nela: nenhuma agência tinha prazo, e o teste não terminava nunca.',
      'Quando o teste acaba (ou a assinatura é cancelada, ou o cartão é recusado), o app mostra uma tela explicando o que houve e o caminho para resolver — em vez de simplesmente parar de funcionar.',
      'Quem pode assinar vê o botão ali mesmo; quem não pode vê de quem cobrar. Sair da conta continua disponível em qualquer caso.',
      'Voltando do pagamento, a tela espera a confirmação do Stripe e se atualiza sozinha, em vez de dizer "em teste" para quem acabou de pagar.',
    ],
    corrigido: [
      'A versão anterior anunciava que o teste grátis passava a terminar. Não passava: faltavam a data no cadastro e o bloqueio no app. Agora existem os dois.',
    ],
    melhorias: [
      'As agências que já existem continuam sem prazo, de propósito: ninguém é interrompido por uma regra que não existia quando começou a usar. Para encerrar o teste de uma delas, defina a data em Admin → Agências.',
    ],
  },
  {
    versao: '2.16.0',
    data: '2026-09-11',
    resumo: 'O Orquesia passou a saber cobrar, e o aviso por e-mail parou de depender da aba ficar aberta.',
    novidades: [
      'Assinatura com o Stripe: a agência assina em Configurações → Visão Geral, e o pagamento acontece na página do próprio Stripe — nenhum dado de cartão passa pelo Orquesia.',
      'Quem já assina gerencia tudo pelo portal de cobrança do Stripe: trocar cartão, ver as faturas, cancelar.',
      'Admin → Financeiro mostra receita de verdade: o MRR é a soma das assinaturas ativas, com inadimplentes e cancelamentos agendados contados à parte.',
      'Admin → Integrações ganhou o bloco do Stripe: quais chaves faltam e a URL exata do webhook, com botão de copiar.',
    ],
    melhorias: [
      'O e-mail de aviso não some mais se você fechar a aba logo depois de aprovar. Ele entra numa fila e sai pelo agendador, com três tentativas.',
      'A tela diz "e-mail na fila" em vez de "enviado", que é o que de fato aconteceu naquele instante.',
      'Configurações → Visão Geral mostra os dados reais da conta e leva ao editor de perfil que funciona.',
    ],
    corrigido: [
      'Configurações → Visão Geral era decorativa: nenhum campo salvava, o botão "Atualizar Perfil" não fazia nada, e o telefone e a data de registro eram valores fixos iguais para toda conta.',
      'O botão de baixar nota fiscal no portal do cliente não baixava nada — mostrava um aviso e pronto. Agora abre o arquivo, e quando não há arquivo o botão nem aparece.',
    ],
  },
  {
    versao: '2.15.0',
    data: '2026-09-11',
    resumo: 'Excluir agência passou a excluir de verdade — com sete dias de lixeira antes de não ter mais volta.',
    novidades: [
      'Admin → Agências ganhou a Lixeira. Excluir tira a agência do ar na hora, mas a apaga de vez só depois de 7 dias, e até lá o botão "Restaurar" traz tudo de volta.',
      'Cada agência na lixeira mostra desde quando está lá, quantos dias faltam e o que vai junto: clientes, conteúdos e arquivos.',
      'Quem estiver trabalhando numa agência que foi para a lixeira vê um aviso no topo, com o prazo. Antes a equipe seguia produzindo e perdia tudo numa madrugada, sem nunca ter visto nada.',
    ],
    corrigido: [
      'O botão "Excluir Agência" não excluía nada. Ele removia o vínculo de quem clicava — e como quem administra o produto normalmente não é membro da agência, o clique não fazia efeito nenhum e não mostrava erro.',
      'A lista de agências dizia "👑 Agência PRO" para toda agência sem marca de teste. Não existe assinatura nem cobrança no banco: o selo afirmava um plano que ninguém contratou, bem na tela de onde se decide excluir a agência.',
      'A mesma lista mostrava "3 usuários" quando não conseguia contar — um número literal no código. Agora a contagem de equipe e clientes vem do banco, e quando não vem a tela diz isso.',
      'O deploy desta versão estava falhando por passar do limite de funções do plano da Vercel, sem nenhum erro de código para mostrar. As duas rotas da lixeira viraram uma só.',
    ],
  },
  {
    versao: '2.14.0',
    data: '2026-09-11',
    resumo: 'O Portal do Cliente passou a ter gente, com dois papéis: quem só aprova e quem também edita.',
    novidades: [
      'Cada cliente ganhou a aba Usuários na ficha dele. É ali que a agência decide quem da empresa do cliente entra no portal, e com qual papel.',
      'Aprovador: vê o conteúdo, aprova e pede ajuste. Nada além disso.',
      'Editor: tudo do aprovador, mais anexar arquivos, cadastrar senhas, acessar as notas fiscais, ler e alterar o briefing da marca e convidar outros usuários — sem depender da agência.',
      'O editor gerencia os acessos de dentro do próprio portal, numa aba Usuários exclusiva dele.',
      'O briefing virou editável pelo portal. Antes era só leitura, e mudar uma linha exigia pedir para a agência.',
    ],
    melhorias: [
      'Quem já entrava no portal continua entrando, como editor: ninguém perdeu acesso na virada.',
      'Cada aprovação passou a ser registrada com o nome da pessoa que apertou o botão. Antes o histórico dizia só "Cliente".',
      'A sessão do portal dura 30 dias, em vez de morrer ao fechar a aba.',
    ],
    corrigido: [
      'Material enviado pelo cliente aparecia na galeria e sumia no reload: a gravação era recusada pelo banco e ninguém via o erro. Agora é gravado de verdade.',
      'O briefing mostrava textos de exemplo ("Acolhedor, especialista, dinâmico…") como se fossem do cliente. Campo vazio agora diz que está vazio.',
      'O cofre de senhas e as notas fiscais chegavam ao navegador de qualquer pessoa que entrasse no portal, mesmo com a aba fechada na tela. Para o aprovador esses dados não saem mais do servidor.',
    ],
  },
  {
    versao: '2.13.0',
    data: '2026-09-10',
    resumo: 'O cadastro pergunta o que cada rede realmente precisa, e a prévia deixa navegar pelo carrossel.',
    novidades: [
      'Os campos mudam com a rede. Instagram pede legenda, localização e primeiro comentário — e, no Reel, capa e "compartilhar no feed". YouTube pede descrição, thumbnail, categoria e visibilidade. LinkedIn pede o texto e o tipo de publicação.',
      'A prévia ficou maior e navega no carrossel: ← 1 / 5 →. Antes ela mostrava só a primeira arte, e é justamente a terceira que costuma estar na proporção errada.',
      'Botão Celular / Computador na prévia: a mesma legenda quebra em lugares diferentes nas duas larguras.',
      'A localização digitada aparece na prévia embaixo do nome do perfil, como aparece na rede.',
    ],
  },
  {
    versao: '2.11.0',
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
    versao: '2.10.0',
    data: '2026-09-10',
    resumo: 'Seu perfil agora se edita por dentro do sistema: nome, foto e senha.',
    novidades: [
      'Painel da conta refeito: dá para trocar seu nome, enviar uma foto de perfil e alterar a senha sem sair do sistema. Antes o único jeito de trocar a senha era pelo "esqueci minha senha" da tela de entrada, que exige sair da conta.',
      'A troca de senha pede a senha atual. É de propósito: sem isso, quem sentasse numa aba esquecida aberta trocaria a senha e ficaria com a conta.',
      'Também dá para pedir a troca do e-mail de entrada. Ele só muda depois que você abrir o link de confirmação, e a tela diz isso em vez de anunciar que já trocou.',
      'Seu nome e sua foto valem em todas as agências de que você participa. A tela avisa em quantas a mudança pegou.',
    ],
    corrigido: [
      'Quem não tinha foto aparecia com um ícone de imagem quebrada no calendário, no kanban, nas aprovações e no portal. Agora aparecem as iniciais, num círculo colorido que é sempre o mesmo para a mesma pessoa.',
      'Cliente novo nascia com a foto de um desconhecido, o e-mail "contato@cliente.com.br" e o telefone "(11) 99999-9999" — dados inventados que ficavam gravados como se fossem do cliente. Agora os campos ficam em branco.',
      'No portal, cadastrar um material sem anexar o arquivo gravava uma foto de banco de imagens e "4,2 MB" de tamanho. A agência recebia um material que o cliente nunca enviou. Agora o envio exige o arquivo.',
      'As últimas fotos que o sistema buscava em servidores de terceiros saíram. Nenhuma tela depende mais de um site externo para desenhar.',
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

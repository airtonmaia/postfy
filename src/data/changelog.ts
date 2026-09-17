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
    versao: '2.53.0',
    data: '2026-09-17',
    resumo:
      'Feed + Story agora vale para o Facebook, o seletor de canais virou uma lista, e os arquivos do cliente viraram uma lista só.',
    novidades: [
      'O Orquesia passou a publicar Story em Página do Facebook — e por isso "Feed + Story" agora aparece também quando o Facebook está escolhido. Antes o formato existia só no Instagram.',
      'O campo Canais virou um seletor com lista, como o da Meta: você marca as redes, vê quantas escolheu e lê ali mesmo quais publicam sozinhas e quais são postagem manual.',
      'A aba Arquivos do cliente virou uma lista só, com filtro por tipo: Anexos, Links e Bloco de notas.',
      'As anotações do cliente viraram "Bloco de notas" e entraram nessa mesma lista, com a contagem à vista. Elas continuam sendo só da equipe — não aparecem no Portal do Cliente.',
      'Arquivos e links agora podem ser editados. Antes, corrigir um nome ou trocar a categoria exigia excluir e cadastrar de novo — e num link isso perdia o endereço.',
    ],
    melhorias: [
      'No link, o endereço é editável (é ele que quebra quando a pasta é movida). No arquivo enviado, não: ali o endereço aponta para o arquivo, e digitar outro não moveria nada.',
    ],
    corrigido: [
      'Uma correção que peguei antes de subir: com o bloco de notas passando a morar junto dos arquivos, o primeiro arquivo que o cliente enviasse pelo portal apagaria todas as anotações da agência — em silêncio. O servidor agora preserva os blocos que o cliente nem chega a receber.',
    ],
  },
  {
    versao: '2.52.0',
    data: '2026-09-17',
    resumo:
      'A tela de edição do conteúdo passou a ter tudo o que a de cadastro tem — e o cliente ganhou um chat na aprovação.',
    novidades: [
      'Editar um conteúdo agora abre o mesmo formulário do cadastro: cliente, canais, formato, prioridade, arte do feed, arte do story, os campos da rede (localização, primeiro comentário, capa do Reel) e o contador de caracteres. Antes metade disso só existia na criação.',
      'A prévia da publicação, que só existia ao cadastrar, agora fica ao lado enquanto você edita — com a arte, a legenda e o perfil do cliente.',
      'As abas viraram três, na ordem do trabalho: Conteúdo, Revisões e Compartilhamento.',
      'Revisões reúne o pedido de ajuste do cliente, a conversa com ele e o histórico de versões, que antes eram duas abas separadas e um aviso que sumia.',
      'No portal, o cliente pode conversar sobre o conteúdo na própria tela de aprovação — um terceiro caminho entre aprovar e pedir ajuste, para o "gostei, só troque o horário no texto" que antes ia parar no WhatsApp.',
      '"Agendar publicação" agora existe também na edição: antes, remarcar a data de uma peça já criada não a devolvia para a fila, e ela não saía.',
      'Compartilhamento deixou de ser uma janela sobre a outra e virou aba, com o link do portal separado da mensagem de WhatsApp.',
    ],
    melhorias: [
      'Nada é gravado enquanto você digita: a barra "Salvar alterações" aparece quando há mudança, e fechar com algo pendente pergunta antes.',
      'Checklist e horas viraram seções recolhíveis dentro de Conteúdo, com a contagem à vista.',
      'O conteúdo agora registra quando foi alterado pela última vez.',
    ],
    corrigido: [
      'O portal do cliente recebia, junto com cada conteúdo, dados internos da agência que nunca deveriam sair daqui: o rascunho da legenda, os minutos gastos na peça, quem da equipe a produziu, o checklist de produção e a estratégia de campanha, público e funil. Eles não apareciam em tela, mas estavam no navegador do cliente.',
      'No celular a modal de conteúdo abria na prévia, com o formulário empurrado para fora da tela e sem barra de rolagem para chegar nele.',
      'A tela de horas afirmava um custo de "R$ 85,00/hora" e uma "Excelente Margem" que nenhum dado sustenta. Saíram: o tempo, que é medido, ficou.',
    ],
  },
  {
    versao: '2.51.0',
    data: '2026-09-17',
    resumo: 'Todas as janelas do sistema fecham com Esc, prendem o foco e travam a rolagem do fundo.',
    novidades: [
      'As últimas seis entraram no padrão: sua conta, a busca (Cmd+K), as políticas e os termos na porta do portal, e a prévia e o pedido de ajuste dentro do portal.',
      'A busca continua abrindo perto do topo no computador, como toda busca por atalho, e passa a ocupar a tela inteira no celular.',
    ],
    melhorias: [
      'O botão de fechar, a tela cheia no celular e o nome para leitores de tela agora vêm da mesma peça — janela nova já nasce com os três.',
    ],
  },
  {
    versao: '2.50.0',
    data: '2026-09-17',
    resumo: 'Mais seis janelas no padrão novo, e a correção de um erro que derrubaria duas telas.',
    novidades: [
      'Editar agência e criar plano no Admin, criar squad e convidar usuário nas Configurações, e as duas de visualizar proposta e contrato no Comercial: todas fecham com Esc, prendem o foco e travam a rolagem do fundo.',
      'No celular as seis usam a tela inteira.',
    ],
    corrigido: [
      'Uma correção que peguei antes de subir: na conversão, três janelas passariam a ler o registro escolhido mesmo estando fechadas — e fechada é o estado normal delas. As telas Comercial e Admin Agências quebrariam ao abrir.',
    ],
  },
  {
    versao: '2.49.0',
    data: '2026-09-17',
    resumo: 'As janelas do Comercial — lead, proposta e contrato — entraram no mesmo padrão das outras.',
    novidades: [
      'Cadastrar lead, gerar proposta e criar contrato agora fecham com Esc, prendem o foco e travam a rolagem da página atrás.',
      'No celular as três usam a tela inteira, em vez de uma caixa centrada que perdia largura.',
    ],
    melhorias: [
      'As três ganharam nome próprio para leitores de tela.',
    ],
  },
  {
    versao: '2.48.0',
    data: '2026-09-17',
    resumo: 'Mais cinco janelas passaram a fechar com Esc e travar a rolagem do fundo.',
    novidades: [
      'Novidades, Grade do Instagram, a leitura de anotação do cliente, os atalhos de conteúdo e o recorte de imagem agora fecham com Esc, prendem o foco e travam a rolagem da página de trás.',
      'Quando uma janela abre em cima de outra — os atalhos por cima do cadastro, o recorte por cima do envio —, o Esc fecha só a de cima e o teclado fica presa nela.',
    ],
    melhorias: [
      'Toda janela migrada tem nome próprio para leitores de tela, mesmo quando o título é desenhado junto de um ícone ou de um seletor.',
      'No celular essas cinco passaram a usar a tela inteira, como as de conteúdo já faziam.',
    ],
  },
  {
    versao: '2.47.0',
    data: '2026-09-17',
    resumo: 'As janelas do sistema passaram a fechar com Esc, travar a rolagem do fundo e prender o foco.',
    novidades: [
      'Toda janela migrada agora fecha com a tecla Esc. Antes, das 25 do sistema, só duas faziam isso.',
      'A rolagem da página de trás fica travada enquanto uma janela está aberta. Antes, rolar até o fim de uma janela passava a rolar a tela atrás dela e você perdia o lugar onde estava — o efeito era pior no celular.',
      'O teclado não escapa mais da janela aberta: o Tab circula só dentro dela, e o foco volta para onde estava quando ela fecha.',
    ],
    melhorias: [
      'A tela cheia no celular deixou de ser ajuste de cada janela e virou regra da peça que todas usam — janela nova já nasce certa.',
      'O botão de fechar ficou igual em todas: mesma posição, mesmo tamanho e mesmo foco visível. Eram três posições e dois tamanhos diferentes.',
    ],
  },
  {
    versao: '2.46.0',
    data: '2026-09-17',
    resumo: 'As telas de conteúdo passaram a funcionar no celular — e a Biblioteca voltou a rolar.',
    corrigido: [
      'A Biblioteca não rolava. Quem tinha acervo maior que a tela simplesmente não chegava ao resto dos arquivos — sem barra de rolagem, sem erro e sem pista de que havia mais coisa embaixo.',
      'A tela de detalhe do conteúdo era ilegível no celular: o nome do cliente quebrava em três linhas, o título virava "D..." e a barra de abas ficava com um quinto do espaço que precisava, escondida atrás do botão vizinho.',
      'Na tela de novo conteúdo, o rótulo "Mídia e criativos" quebrava em cinco linhas ao lado do botão, e os cinco botões do rodapé caíam em três linhas desencontradas sem deixar claro qual era a ação principal.',
    ],
    melhorias: [
      'No celular as duas telas de conteúdo usam a tela inteira, em vez de uma caixa centrada que perdia largura onde ela já é escassa.',
      'A prévia da publicação começa recolhida no celular, atrás de um botão: empilhada embaixo do formulário, ela era uma tela e meia de quadros vazios entre a pessoa e o botão de salvar. No computador nada muda — ela continua sempre à vista, ao lado.',
      'No rodapé do novo conteúdo cada ação ocupa a linha inteira no celular, na ordem da decisão, com "Enviar para aprovação" em destaque no fim.',
    ],
  },
  {
    versao: '2.45.0',
    data: '2026-09-17',
    resumo: 'A tela de detalhe do conteúdo virou editor: dá para alterar ali tudo o que o cadastro insere.',
    novidades: [
      'Clique no texto e ele vira campo. Título, legenda, rascunho, CTA, hashtags e primeiro comentário se editam onde são lidos — antes era preciso abrir outra tela para corrigir uma vírgula.',
      'Formato e prioridade trocam pelo próprio selo do cabeçalho, num menu com as opções desenhadas como vão ficar. O formato só oferece o que a rede da peça aceita.',
      'As duas datas — agendamento e prazo de aprovação — têm "Editar" ao lado, e o campo abre no fuso da agência, não no do aparelho.',
      'CTA, hashtags e primeiro comentário aparecem mesmo vazios. Antes sumiam da tela quando não tinham valor, e o que some não pode ser preenchido.',
      '"Publicar agora" e "Enviar para aprovação" ficaram como as duas ações principais do conteúdo, com a resposta da rede aparecendo ali mesmo.',
    ],
    melhorias: [
      'Nada é salvo por engano: sair do campo mantém o texto em edição, e quem grava é o ✓ ou o Enter. O Esc devolve o valor original.',
      'As duas datas passaram a ficar uma embaixo da outra. Lado a lado, o próprio dia era cortado ("20/09...") para caber o rótulo.',
    ],
    corrigido: [
      'Quando o feed sai e o story não, a tela agora diz isso. O aviso já vinha do servidor e ninguém mostrava: aparecia "Publicado" para uma peça que foi ao ar pela metade.',
      'O menu de formato mostra o nome que cada rede usa — "Reels" no Instagram, "Short" no YouTube —, o mesmo da tela de cadastro. Antes dizia "Reel" nos dois.',
      'No modo escuro, "Registrar ajuste" ficava com o fundo claro do modo claro.',
    ],
  },
  {
    versao: '2.44.0',
    data: '2026-09-16',
    resumo: 'Os selos de rede, formato, status e prioridade passaram a ter o mesmo tamanho e formato.',
    melhorias: [
      'Lado a lado no cabeçalho de um conteúdo, os selos tinham quatro alturas, três tamanhos de letra e dois formatos — uma pílula, um retângulo arredondado, um retângulo e um rótulo sem borda, na mesma linha. Agora todos têm a mesma altura, o mesmo canto e a mesma letra, com as cores de sempre.',
      'O "v1" que marcava a versão era escrito à mão dentro da tela de detalhe, com desenho próprio. Virou selo como os outros.',
    ],
  },
  {
    versao: '2.43.1',
    data: '2026-09-16',
    resumo: 'Correção: "Feed + Story" estava sendo oferecido no Facebook, onde só o feed saía.',
    corrigido: [
      'O formato "Feed + Story" aparecia também para o Facebook, mas ali só o feed era publicado — a arte do story era descartada sem aviso, e a fila dizia "publicado". Story de Página é outro fluxo da Meta, que ainda não existe aqui; enquanto isso, o formato fica só no Instagram, e o publicador recusa em voz alta se receber essa combinação.',
    ],
  },
  {
    versao: '2.43.0',
    data: '2026-09-16',
    resumo: 'Formato "Feed + Story": uma peça, duas artes, e o story saindo como story de verdade.',
    novidades: [
      'Novo formato "Feed + Story" no cadastro de conteúdo. Ao escolhê-lo, aparecem dois campos de mídia: um para a arte do feed (4:5) e um só para o story (9:16). Na data marcada, a peça sai nos dois.',
      'O cliente vê as duas artes lado a lado na hora de aprovar, cada uma com o nome do lugar onde vai sair. Aprovar vendo só uma delas era aprovar metade da peça.',
    ],
    corrigido: [
      'Conteúdo com formato "Story" era publicado no feed, com legenda e tudo. O aviso de publicação nunca disse isso: a Meta aceita o envio, então a fila marcava "publicado" e ninguém percebia. Agora o story sai como story.',
      'Story não leva mais legenda no envio — o Instagram a ignora, e mandá-la fazia a tela prometer um texto que nunca apareceu.',
    ],
    melhorias: [
      'Se o feed sair e o story falhar, o conteúdo fica como publicado e o motivo da falha do story aparece na fila. Marcá-lo como falho faria a próxima passada republicar o feed, e post repetido no perfil do cliente não volta.',
    ],
  },
  {
    versao: '2.42.0',
    data: '2026-09-16',
    resumo: 'A foto do cliente agora é enquadrada por você, não cortada pelo meio.',
    novidades: [
      'Ao enviar o avatar de um cliente — no cadastro ou na ficha — abre uma tela para arrastar e dar zoom até a foto ficar como você quer. O que fica dentro do quadrado é o que é salvo, e a mesma tela vale para a sua própria foto de perfil.',
      'Foto em pé abre já enquadrada no terço de cima, que é onde o rosto costuma estar. Antes o navegador cortava o centro, e o rosto ficava pela metade.',
    ],
    melhorias: [
      'O arquivo que sobe é o recortado, não o original: as telas ficam mais leves e a foto aparece igual em todo lugar, inclusive no e-mail — que não tem como recortar nada.',
      'Logo em SVG continua entrando inteiro, sem passar pelo recorte: recortá-lo tiraria dele justamente o que faz um vetor valer a pena. O logo da agência também fica de fora, porque ele é desenhado por inteiro nas telas, não dentro de um quadrado.',
    ],
    corrigido: [
      'Uma falha na própria bateria de testes do sistema: a limpeza de comentários apagava até 44% de três arquivos antes de conferi-los, e as verificações passavam sem enxergar quase metade do código. Corrigido, com um teste que impede isso de voltar.',
    ],
  },
  {
    versao: '2.41.0',
    data: '2026-09-16',
    resumo: 'Campo de rascunho ao lado da legenda, e todas as abas do sistema na mesma peça.',
    novidades: [
      'Nova aba "Rascunho" ao lado de "Legenda" no editor de conteúdo. É para o texto de trabalho: versão descartada da legenda, ideia de gancho, o que o cliente pediu na reunião. Ele fica guardado com o conteúdo e nunca é publicado — quem vai para a rede é a legenda.',
      'A aba de Rascunho mostra um selo quando há texto nela, para ele não sumir de vista ao trocar de aba.',
    ],
    melhorias: [
      'Todas as abas do sistema passaram a usar a mesma peça: ficha do cliente, Configurações, Aprovações, detalhe do conteúdo, Portal do Cliente e a Prévia. Eram sete barras escritas à mão, com quatro espaçamentos, três tamanhos de fonte e dois pesos diferentes — cada uma nascida certa no lugar dela.',
      'As abas ganharam navegação por teclado (setas, Home e End) e a semântica que leitores de tela esperam, que o botão solto não tinha.',
    ],
    corrigido: [
      'A tela de Aprovações chegou a mostrar um pedaço de código escrito em letras pretas no meio da lista, durante esta mesma entrega. Foi encontrado antes de subir, e agora há um teste que reprova esse tipo de erro.',
    ],
  },
  {
    versao: '2.40.0',
    data: '2026-09-16',
    resumo: 'Anotações na ficha do cliente, e a lista de arquivos passou a dizer o que cada linha é.',
    novidades: [
      'Nova seção "Anotações" na aba Arquivos do cliente: blocos de texto com título, cada um com visualizar, editar e excluir. São internas da agência — o Portal do Cliente não recebe o texto, e quem corta é o banco, não a tela.',
      'Botão de baixar nos arquivos anexados, e de abrir em nova aba nos links. Antes era o mesmo ícone de "abrir" para os dois, e não havia como guardar um arquivo sem passar por uma aba.',
    ],
    melhorias: [
      'Cada arquivo ganhou o ícone do que ele é — PDF, imagem, vídeo, planilha, documento ou link. Era uma pasta roxa para tudo, inclusive para contrato em PDF.',
      'Os ícones soltos da lista agora têm dica ao passar o mouse, dizendo o que cada um faz.',
      'A linha de um link mostra "Link externo" no lugar do tamanho, que nesse caso era sempre inventado.',
    ],
    corrigido: [
      'A nota interna do cliente (a que aparece no card da lista) era enviada ao navegador de quem entrava no Portal do Cliente. Ela não era desenhada em tela, mas estava lá para quem abrisse o inspetor. Agora o banco a remove antes de responder.',
    ],
  },
  {
    versao: '2.39.0',
    data: '2026-09-16',
    resumo: 'Dá para cadastrar cliente de dentro do próprio seletor de clientes.',
    novidades: [
      'Botão "Novo cliente" no menu do seletor de clientes, no topo do sistema. É ali que se descobre que o cliente ainda não está cadastrado — até agora o caminho era fechar o menu, achar "Clientes" no menu lateral e procurar o botão lá dentro.',
    ],
    melhorias: [
      'O menu do seletor ficou um pouco mais largo, e os nomes de cliente que vinham cortados agora cabem.',
    ],
    corrigido: [
      'O botão "Limpar Filtro" do menu saiu: ele fazia exatamente o mesmo que a linha "Todos os Clientes" logo abaixo dele, que continua ali. Duas formas da mesma ação espremiam o título da seção a ponto de ele virar reticências.',
    ],
  },
  {
    versao: '2.38.0',
    data: '2026-09-16',
    resumo: 'A área de anexar mídia virou um quadrado de verdade, e o botão ficou com cara de botão.',
    melhorias: [
      'O campo de adicionar mídia era uma tarja achatada com o rótulo saindo por baixo dela. Agora é um quadrado de 160px, do mesmo tamanho das miniaturas ao lado, com o texto inteiro visível e um alvo de clique que se acerta sem mirar.',
      'O aviso de que dá para arrastar o arquivo mudou de lugar: ficava embaixo da fileira e só aparecia depois da primeira mídia — ou seja, nunca na hora em que adiantaria. Agora está dentro do próprio quadrado onde o arquivo é solto.',
      'O botão "Adicionar mídia" passou a ser da cor principal, e a caixa que o envolvia saiu. Ele era roxo pálido dentro de mais uma moldura roxa: três linhas em volta de uma ação só, que fazia o par parecer um campo de formulário em vez de um botão.',
    ],
    corrigido: [
      'Com a fileira de mídias cheia, a opção "Por link da web" ainda adicionava, passando do limite de arquivos — o botão principal desligava e o menu ao lado não.',
    ],
  },
  {
    versao: '2.37.0',
    data: '2026-09-16',
    resumo: 'O Facebook entrou na fila: Página conectada publica sozinha na data.',
    novidades: [
      'Conectar uma Página do Facebook na ficha do cliente, e o conteúdo agendado sai sozinho na data — como já acontecia com o Instagram. Foto e vídeo.',
      'A aba Integrações mostra se as credenciais do Facebook estão configuradas, separadas das do Instagram: são dois apps diferentes no mesmo painel da Meta, e trocar um pelo outro falha só depois de a senha já ter sido digitada.',
    ],
    melhorias: [
      'Publicar numa Página exige a revisão de pages_manage_posts na Meta, e a tela diz isso em vez de prometer. Com o app em desenvolvimento, funciona nas Páginas que você administra.',
    ],
  },
  {
    versao: '2.36.0',
    data: '2026-09-16',
    resumo: 'O menu lateral das duas áreas passou a usar a mesma peça, sem mudar um pixel.',
    melhorias: [
      'Os itens do menu — da agência e da administração — eram escritos à mão em cada casca, com a mesma configuração copiada nas duas. Agora são a mesma peça do shadcn. Duas cópias da mesma decisão divergem na primeira vez que alguém mexe numa só, e foi assim que o sistema acabou com doze alturas de botão diferentes.',
      'Nenhuma medida mudou: altura, largura, arredondamento, fonte e espaçamento foram conferidos no navegador antes e depois, e são idênticos. A troca é interna.',
      'O menu ganhou navegação por teclado e a semântica de lista que leitores de tela esperam, que o botão solto não tinha.',
    ],
  },
  {
    versao: '2.35.0',
    data: '2026-09-16',
    resumo: 'Relatórios passou a mostrar o que o conteúdo deu, e não só o que foi produzido.',
    novidades: [
      'Nova seção "Desempenho real no Instagram" em Relatórios: alcance, curtidas, comentários, salvamentos e compartilhamentos de cada publicação, lidos da própria Meta. Até aqui o relatório media produção — quantas peças, prazos cumpridos —, que responde como a agência trabalha e não responde o que o cliente dela pergunta.',
      'Os números são atualizados pelo agendador, em segundo plano, e a tela mostra desde quando estão medidos. Cada publicação tem link direto para o post no Instagram.',
    ],
    melhorias: [
      'A tela distingue "não medido" de "zero", e isso é decisão: alcance zero num post de ontem é um problema de conteúdo, alcance não medido é a Meta ainda não ter respondido. O traço (—) quer dizer o segundo, e cada total diz de quantas publicações ele saiu.',
      'A seção diz, sempre à vista, que cobre apenas o que foi publicado pela fila do Orquesia — post feito direto no Instagram não entra na conta.',
    ],
  },
  {
    versao: '2.34.0',
    data: '2026-09-16',
    resumo: 'As caixas cinzas do navegador saíram — as confirmações agora têm a cara do sistema.',
    melhorias: [
      'Remover um membro, tirar o acesso de alguém ao portal ou desconectar uma conta do Instagram passou a abrir uma janela do próprio sistema, com a cor da agência. A caixa cinza do navegador não tinha marca nenhuma, e no portal do cliente ela parecia de outro site.',
      'Cada confirmação agora diz o que acontece depois, e não só "tem certeza?". Desconectar uma conta avisa que as publicações agendadas serão canceladas; remover alguém avisa que o acesso cai na hora, inclusive nas abas já abertas.',
      'No celular, o botão que confirma fica acima do cancelar — a ação destrutiva embaixo do polegar era a que mais errava.',
      'Copiar a legenda de um conteúdo mostra "Copiado!" no próprio botão por dois segundos, em vez de abrir uma caixa que precisa ser fechada.',
    ],
    corrigido: [
      'As confirmações podiam simplesmente não aparecer no celular: alguns navegadores suprimem a caixa nativa, e quando isso acontecia a ação não era executada e nada avisava. Clicar em "remover" não fazia nada.',
    ],
  },
  {
    versao: '2.33.0',
    data: '2026-09-16',
    resumo: 'A Biblioteca: todo arquivo da agência num lugar só, com pasta por cliente.',
    novidades: [
      'Novo menu Biblioteca, abaixo do WorkFlow. Ele mostra tudo que a agência já enviou — arte anexada a conteúdo, material que o cliente mandou pelo portal, logo, PDF —, com miniatura, tamanho, data e busca por nome. Antes um arquivo só existia dentro do conteúdo em que foi usado: reaproveitar exigia lembrar em qual post ele estava.',
      'A pasta de cada cliente é montada pelo uso, não por onde o arquivo foi salvo. O mesmo arquivo pode servir a dois clientes e aparece nos dois — e o acervo que já estava guardado entra organizado, sem ninguém precisar mover nada.',
      'Cada arquivo mostra em quantos conteúdos está sendo usado, e a exclusão diz isso antes de confirmar. Excluir uma arte que está em três posts deixa a mídia quebrada nos três, e agora a tela avisa em vez de perguntar "tem certeza?".',
      'Dá para enviar direto pela Biblioteca, sem precisar criar um conteúdo antes — arte aprovada costuma chegar antes do post que vai usá-la.',
    ],
    corrigido: [
      'Dois testes internos do agendamento passaram a falhar sozinhos ao virar a data — eles comparavam com um dia fixo do calendário. O cálculo de quando o post sai sempre esteve certo; a verificação é que envelhecia.',
    ],
  },
  {
    versao: '2.32.0',
    data: '2026-09-12',
    resumo: 'O seletor de agência virou um menu de verdade, e o plano saiu de cima do nome da agência.',
    novidades: [
      'O seletor de agência passou a usar o menu suspenso do shadcn: fecha com Esc, anda com as setas do teclado, devolve o foco para onde estava e rola sozinho quando a lista é grande. Cada agência aparece com a marca, o nome e o endereço (@slug), que é o que diferencia agências de nomes parecidos.',
      'O rodapé da barra lateral mostra em que plano a agência está, com o que falta saber em cada caso — quantos dias restam do teste, se a cobrança está em dia, se há cancelamento agendado. O clique leva direto para Configurações. Ele só aparece quando o banco responde: em vez de mostrar um plano padrão enquanto carrega, não mostra nada.',
    ],
    melhorias: [
      'O selo "Teste Grátis (7 dias)" saiu de baixo do nome da agência. Ele competia com a marca em toda tela, e informação de cobrança agora mora num lugar só, no rodapé.',
      'O botão de recolher o menu saiu de dentro da barra lateral e foi para o cabeçalho, ao lado do filtro de clientes. Ele fica no mesmo canto com o menu aberto ou fechado, em vez de mudar de lugar.',
      'Com o menu recolhido, a marca da agência continua em tela. Antes ela sumia junto, e a faixa de ícones não dizia de qual agência era a tela — o que mais pesa para quem trabalha em mais de uma.',
    ],
    corrigido: [
      'As animações de abrir e fechar de menus e dicas de tela estavam escritas mas nunca funcionaram: faltava o pacote que as define. Agora abrem e fecham com transição.',
    ],
  },
  {
    versao: '2.31.1',
    data: '2026-09-12',
    resumo: 'Os botões de navegação voltaram a ser neutros.',
    corrigido: [
      'A padronização anterior pintou com a cor da agência dez botões que deveriam ser cinza — a navegação de mês do calendário e do mini calendário, e ícones de ação em Aprovações, Clientes, busca e no detalhe do conteúdo. Cor de marca em botão de navegar disputa atenção com a ação principal da tela.',
    ],
  },
  {
    versao: '2.31.0',
    data: '2026-09-12',
    resumo: 'Todos os botões do sistema passaram a ter o mesmo tamanho e o mesmo acabamento.',
    melhorias: [
      'Os botões estavam escritos um a um, e o sistema tinha doze alturas diferentes — "Novo Post" media 30px e "Novo Conteúdo" media 40px, sem que nenhum dos dois parecesse errado sozinho. Agora existe uma escala só, e todo botão sai em 32px, que é a mesma altura do item do menu lateral.',
      'O acabamento também ficou igual: mesmo arredondamento, mesmo peso de texto e mesmo espaçamento em todo botão, do quadro ao portal do cliente.',
      'Botões que se repetiam com a mesma cor — o verde de aprovar e o cinza de ação secundária — viraram opções do sistema em vez de serem pintados à mão em cada tela.',
    ],
  },
  {
    versao: '2.30.0',
    data: '2026-09-11',
    resumo: 'Os selos e etiquetas deixaram de ser pílula, e as modais fecham no mesmo canto dos cards.',
    melhorias: [
      'Os 53 selos e etiquetas espalhados pelo sistema — status no quadro, papel do usuário, rótulos do portal — passaram de formato pílula para canto arredondado discreto. Os badges de rede (Feed, Reels, Story) e as bolinhas de contagem seguem redondos, que é o papel deles.',
      'As modais usavam um arredondamento maior que o dos cards e destoavam ao abrir. Agora fecham no mesmo canto.',
    ],
  },
  {
    versao: '2.29.1',
    data: '2026-09-11',
    resumo: 'Os cantos arredondados voltaram ao tamanho certo.',
    corrigido: [
      'A versão anterior engrossou o arredondamento de botões, campos e itens de menu, deixando-os do mesmo tamanho do canto dos cards — a interface ficou com uma "casca" só, sem a diferença entre o que é caixa e o que é botão. Foram 649 elementos afetados. Revertido.',
    ],
  },
  {
    versao: '2.29.0',
    data: '2026-09-11',
    resumo:
      'A cor da sua agência passou a valer para as peças novas da interface — e ficou legível em marcas claras.',
    melhorias: [
      'A cor da agência agora chega às peças da biblioteca de interface, e não só aos botões escritos um a um. Na prática: as telas que forem sendo refeitas já nascem com a sua marca, em vez de precisarem ser pintadas à mão.',
    ],
    corrigido: [
      'Agência com marca clara — amarelo, lima, ciano — tinha texto branco sobre botão claro, praticamente ilegível. Agora o texto do botão escurece sozinho quando a cor pede.',
    ],
  },
  {
    versao: '2.28.0',
    data: '2026-09-11',
    resumo: 'A barra lateral recolhe, e a marca voltou a alinhar com o cabeçalho.',
    novidades: [
      'Botão para recolher o menu lateral, deixando só os ícones. A escolha fica salva na sua conta, então vale também no celular e no outro computador.',
    ],
    corrigido: [
      'A linha da marca era mais alta que o cabeçalho ao lado, e a borda de baixo das duas não fechava. Corrigido nas duas cascas — a da agência e a da administração.',
    ],
  },
  {
    versao: '2.27.1',
    data: '2026-09-11',
    resumo: 'A tela agora diz quando o post sai, e não só a data marcada.',
    melhorias: [
      'Ao agendar, a mensagem diz até que horas o conteúdo deve sair. O agendador passa de 5 em 5 minutos: quem marca 15:10 e clica às 15:10:07 perde a passada por sete segundos e o post sai 15:15 — sem isso escrito, a espera parecia falha.',
      'Na fila de Publicações, o item pendente mostra "sai até HH:MM" em vez de só "pendente".',
    ],
  },
  {
    versao: '2.27.0',
    data: '2026-09-11',
    resumo:
      'O cadastro de conteúdo ficou mais curto, o quadro mais enxuto, e o cliente pode ser avisado uma vez só em vez de a cada arte.',
    novidades: [
      'Quatro caminhos no fim do cadastro, em vez de um botão genérico: Criar ideia, Enviar para aprovação, Agendar e Publicar agora. O que você aperta é o que acontece.',
      '"Agendar" agora coloca o conteúdo na fila de publicação de verdade, quando o cliente tem conta conectada. Quando não tem, ele diz que a postagem na data é sua.',
      'Nova escolha em Configurações → Preferências: avisar o cliente a cada arte, ou juntar as artes e mandar um aviso só.',
      'Quem escolher agrupar ganha o botão "Aprovação em massa" na coluna Para Aprovação. Um clique, um e-mail, com tudo que aquele cliente tem para aprovar.',
    ],
    melhorias: [
      'O campo "Status Inicial" saiu do cadastro. Ele pedia uma decisão antes de o conteúdo existir, e desencontrava do botão apertado no fim — dava para escolher "Já Aprovado" e clicar em "Enviar para aprovação".',
      'Formato e Prioridade ficaram lado a lado, e a data de publicação desceu para perto da legenda.',
      '"Aprovado" e "Agendado" viraram uma coluna só no quadro. Eram duas etapas que a agência não vive separadas, e ocupavam metade da tela quase sempre com o mesmo conteúdo. Conteúdo aprovado sem data continua ali, marcado como "sem data".',
      '"Publicar agora" deixou de ser botão de teste e virou parte do produto. Fica longe do botão principal e com cor de aviso: é a única ação do cadastro que não tem volta.',
    ],
  },
  {
    versao: '2.26.0',
    data: '2026-09-11',
    resumo:
      'O horário agora é o da agência, e não o do aparelho de quem está com o app aberto.',
    novidades: [
      'A agência escolhe o seu fuso em Configurações → Preferências, e ele vale para tudo: agendamento, calendário, portal do cliente e avisos. Cuiabá entrou na lista — antes só havia Manaus, que é o mesmo horário com outro nome.',
      'Quando o fuso do seu aparelho é diferente do da agência, o campo de agendamento avisa de qual horário ele está falando.',
    ],
    corrigido: [
      'A tela de Preferências dizia "Preferências salvas com sucesso!" e não salvava nada — nem o fuso, nem o resto. Agora ela grava no banco e só confirma depois que ele responde.',
      'Quem abrisse o sistema de outro estado via horários diferentes dos do colega, para o mesmo conteúdo. O portal do cliente também mostrava no fuso do aparelho dele: "sai às 10:00" virava 11:00 para um cliente em outro fuso.',
      'No calendário, um post do fim da noite podia aparecer no dia seguinte dependendo de onde o app fosse aberto.',
      'Saíram da tela de Preferências quatro campos que não faziam nada: idioma, prazo de auto-aprovação, prazo padrão de entrega e os dois alertas. Campo que não faz nada é pior que campo ausente — ele é configurado, e a pessoa conta com o que ele promete.',
    ],
  },
  {
    versao: '2.25.2',
    data: '2026-09-11',
    resumo: 'A publicação no Instagram esperava a foto ficar pronta só quando era vídeo.',
    corrigido: [
      'Publicar uma foto no Instagram falhava com "a mídia não está pronta". O Instagram baixa e processa o arquivo antes de publicar, e o sistema só esperava por isso quando era vídeo. Agora espera sempre.',
      'O erro enganava: tentando de novo costumava funcionar, porque a imagem já estava no cache do Instagram. Falha que some quando se repete é a mais cara de achar.',
    ],
  },
  {
    versao: '2.25.1',
    data: '2026-09-11',
    resumo: 'Correção urgente: abrir o cadastro de conteúdo derrubava a tela.',
    corrigido: [
      'Abrir "adicionar post" caía na tela de erro, com o app inteiro parado. Foi o botão de teste da versão anterior, montado numa ordem que o React não aceita. Corrigido.',
      'Compartilhar um conteúdo no WhatsApp derrubava a tela do mesmo jeito — e isso era antigo, desde que a janela foi escrita. Apareceu junto, e foi corrigido junto.',
      'A mensagem do WhatsApp ficava presa no primeiro conteúdo: abrindo a janela para outro post, o texto continuava sendo o do anterior. Agora ela é refeita a cada conteúdo.',
    ],
  },
  {
    versao: '2.25.0',
    data: '2026-09-11',
    resumo:
      'Um botão temporário para provar que a publicação no Instagram funciona — com a resposta na hora, não em cinco minutos.',
    novidades: [
      'Botão "Publicar agora (teste)" no cadastro de conteúdo, quando o Instagram está marcado. Ele salva e publica na mesma hora, e mostra ali mesmo o que aconteceu: o id do post na Meta, ou o erro exato que ela devolveu. É temporário — existe para conferir a integração de ponta a ponta, e sai depois disso.',
    ],
    melhorias: [
      'Um conteúdo já publicado não é publicado de novo pelo botão de teste: a resposta diz que ele já saiu, e em qual conta.',
    ],
    corrigido: [
      'A correção do agendador da versão anterior não chegaria a quem já tinha aplicado a versão com defeito — o histórico marca aquele passo como concluído e não o repete. Agora ela vai numa etapa própria, que roda mesmo nesses casos.',
    ],
  },
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

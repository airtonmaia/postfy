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

/**
 * Fase 1 — Vestiário. Catálogo de EPI para eletricista de rede de distribuição.
 *
 * O `id` de cada peça é a ÚNICA ligação com o modelo 3D: o nó no .glb se chama
 * `epi_<id>`, e o Blender monta a peça a partir da mesma chave em
 * `arte/blender/epi.py` (dicionário MONTAGEM). Havia antes um campo `malha`
 * repetindo o nome do nó, e ele silenciosamente saiu de sincronia em seis das
 * dezoito peças — a peça simplesmente não aparecia no personagem.
 *
 * REVISÃO PENDENTE (Cristiano / segurança do trabalho): as classes de luva e
 * capacete, o ATPV da vestimenta e a lista de adornos foram escritos a partir de
 * NR-6, NR-10 e NR-35. Antes de ir para treinamento de verdade isso precisa bater
 * com o que a Energisa efetivamente distribui e exige em campo.
 *
 * Cada vaga do corpo tem UMA peça certa e distratores plausíveis. O distrator
 * nunca é absurdo: é sempre algo que alguém de fato já vestiu achando que dava.
 */

export type Vaga =
  | 'cabeca'
  | 'face'
  | 'corpo'
  | 'maos'
  | 'pes'
  | 'cintura'
  | 'adorno'

export type Peca = {
  id: string
  vaga: Vaga
  nome: string
  /** Texto curto na arara, do jeito que o almoxarifado chamaria. */
  descricao: string
  /** Certa, errada, ou certa-mas-incompleta (o item 5 do briefing). */
  veredito: 'correta' | 'incorreta' | 'incompleta'
  /** Peso na nota. Negativo desconta. */
  pontos: number
  /** Explicação que aparece no relatório. */
  porque: string
  norma: string
  /**
   * Cobre o corpo inteiro, então a roupa de baixo sai de cena. Sem isso a
   * camiseta atravessa o uniforme em manchas — as duas são recortadas da mesma
   * superfície e a decimação aproxima uma da outra.
   */
  substituiBase?: boolean
}

export const VAGAS: Record<Vaga, { nome: string; obrigatoria: boolean }> = {
  cabeca: { nome: 'Cabeça', obrigatoria: true },
  face: { nome: 'Olhos e face', obrigatoria: true },
  corpo: { nome: 'Corpo', obrigatoria: true },
  maos: { nome: 'Mãos', obrigatoria: true },
  pes: { nome: 'Pés', obrigatoria: true },
  cintura: { nome: 'Cintura', obrigatoria: true },
  // obrigatória de propósito: deixar passar em branco tira do jogador a
  // decisão sobre adorno, que é justamente o ponto que quase todo mundo erra
  adorno: { nome: 'Objetos pessoais', obrigatoria: true },
}

import { embaralhar } from './ordem.ts'

/**
 * As peças de uma vaga, NA ORDEM EM QUE A TELA MOSTRA.
 *
 * O catálogo abaixo é escrito com a peça certa em primeiro, que é como se lê
 * um catálogo — e era exatamente isso que deixava o vestiário se ganhar
 * clicando sempre o primeiro botão. Quem desenha a tela usa esta função;
 * quem corrige continua usando `PECAS`, porque pontuação não depende de
 * ordem de exibição.
 */
export function pecasDaVaga(vaga: Vaga): Peca[] {
  return embaralhar(PECAS.filter((p) => p.vaga === vaga), (p) => p.id, 'epi')
}

export const PECAS: Peca[] = [
  // ---------------------------------------------------------------- cabeça
  {
    id: 'capacete_b',
    vaga: 'cabeca',
    nome: 'Capacete classe B com jugular',
    descricao: 'Aba frontal, casco isolante, jugular de três pontos',
    veredito: 'correta',
    pontos: 10,
    porque:
      'Classe B é o capacete ensaiado para contato elétrico. A jugular é o que mantém ele na cabeça quando você se inclina no poste ou leva um esbarrão — capacete que cai na hora do impacto não protegeu ninguém.',
    norma: 'NR-6 e NR-10 — capacete classe B para trabalho com eletricidade',
  },
  {
    id: 'capacete_a',
    vaga: 'cabeca',
    nome: 'Capacete classe A',
    descricao: 'Capacete de obra, sem jugular',
    veredito: 'incorreta',
    pontos: -10,
    porque:
      'Classe A protege contra impacto, não contra tensão. Em rede energizada ele não tem ensaio dielétrico que garanta isolação, e sem jugular sai da cabeça no primeiro movimento brusco.',
    norma: 'NR-6 — classe do capacete conforme o risco da atividade',
  },
  {
    id: 'bone',
    vaga: 'cabeca',
    nome: 'Boné da empresa',
    descricao: 'Boné de brim com logo',
    veredito: 'incorreta',
    pontos: -10,
    porque:
      'Boné não é EPI. Ele existe no vestiário porque alguém vai tentar — e é exatamente por isso que está aqui.',
    norma: 'NR-6 — EPI é equipamento certificado com CA',
  },

  // ---------------------------------------------------------------- face
  {
    id: 'protetor_facial_arco',
    vaga: 'face',
    nome: 'Protetor facial para arco elétrico',
    descricao: 'Visor com proteção térmica, acoplado ao capacete',
    veredito: 'correta',
    pontos: 10,
    porque:
      'O arco elétrico queima antes de você ouvir. O protetor facial com classificação de arco é o que impede a queimadura de face e o dano à visão pelo clarão.',
    norma: 'NR-10 — proteção contra os efeitos do arco elétrico',
  },
  {
    id: 'oculos_incolor',
    vaga: 'face',
    nome: 'Óculos de segurança incolor',
    descricao: 'Lente de policarbonato com CA',
    veredito: 'incompleta',
    pontos: 3,
    porque:
      'Protege o olho contra partícula, e é melhor do que nada. Mas em atividade com risco de arco ele não substitui o protetor facial: deixa o resto do rosto exposto.',
    norma: 'NR-10 — o EPI tem de cobrir o risco da atividade, não parte dele',
  },
  {
    id: 'oculos_escuro',
    vaga: 'face',
    nome: 'Óculos escuro comum',
    descricao: 'Óculos de sol, sem certificação',
    veredito: 'incorreta',
    pontos: -8,
    porque:
      'Sem CA, sem resistência a impacto, e ainda escurece a visão de quem trabalha olhando para cima contra o céu. Atrapalha em vez de proteger.',
    norma: 'NR-6 — uso de EPI sem Certificado de Aprovação',
  },

  // ---------------------------------------------------------------- corpo
  {
    id: 'vestimenta_fr',
    vaga: 'corpo',
    nome: 'Vestimenta antichama',
    descricao: 'Camisa e calça com ATPV compatível com o risco calculado',
    veredito: 'correta',
    pontos: 10,
    porque:
      'Tecido antichama não pega fogo nem derrete na pele quando acontece o arco. O ATPV tem de ser igual ou maior que a energia incidente calculada para aquele ponto da rede.',
    norma: 'NR-10 — vestimenta adequada à energia incidente',
    substituiBase: true,
  },
  {
    id: 'camisa_algodao',
    vaga: 'corpo',
    nome: 'Camisa de algodão da empresa',
    descricao: 'Uniforme comum, manga longa',
    veredito: 'incorreta',
    pontos: -10,
    porque:
      'Manga longa não é o mesmo que antichama. Algodão comum queima e continua queimando depois do arco; sintético derrete e gruda na pele. A maior parte da lesão grave por arco vem da roupa, não do arco.',
    norma: 'NR-10 — é vedada vestimenta inflamável ou que possa fundir',
    substituiBase: true,
  },
  {
    id: 'colete_refletivo',
    vaga: 'corpo',
    nome: 'Colete refletivo',
    descricao: 'Colete de alta visibilidade',
    veredito: 'incompleta',
    pontos: 2,
    porque:
      'Faz falta na via pública, para o motorista enxergar a equipe. Mas é sinalização, não proteção contra arco — vai por cima da vestimenta antichama, nunca no lugar dela.',
    norma: 'NR-10 e NR-18 — alta visibilidade em trabalho na via',
  },

  // ---------------------------------------------------------------- mãos
  {
    id: 'luva_isolante_cobertura',
    vaga: 'maos',
    nome: 'Luva isolante com luva de cobertura',
    descricao: 'Borracha classe compatível, dentro da luva de raspa',
    veredito: 'correta',
    pontos: 12,
    porque:
      'A luva de borracha isola; a de raspa por cima protege a borracha do corte e da perfuração. Uma sem a outra dura pouco — e luva isolante furada não avisa que furou.',
    norma: 'NR-10 — luva isolante com cobertura de proteção mecânica',
  },
  {
    id: 'luva_isolante_so',
    vaga: 'maos',
    nome: 'Luva isolante sozinha',
    descricao: 'Borracha classe compatível, sem cobertura',
    veredito: 'incompleta',
    pontos: 4,
    porque:
      'A isolação está certa, a conservação não. Sem a luva de cobertura, qualquer farpa da cruzeta ou fio de aço da amarração perfura a borracha, e a falha só aparece no ensaio seguinte — ou no acidente.',
    norma: 'NR-10 — conservação do EPI isolante',
  },
  {
    id: 'luva_isolante_vencida',
    vaga: 'maos',
    nome: 'Luva isolante com ensaio vencido',
    descricao: 'Etiqueta de ensaio fora da validade',
    veredito: 'incorreta',
    pontos: -12,
    porque:
      'A borracha perde rigidez dielétrica com o tempo, o sol e o óleo, sem mudar de aparência. A validade do ensaio é a única coisa que separa uma luva boa de uma luva que parece boa.',
    norma: 'NR-10 — periodicidade do ensaio elétrico do EPI isolante',
  },
  {
    id: 'luva_vaqueta',
    vaga: 'maos',
    nome: 'Luva de vaqueta',
    descricao: 'Couro, para manuseio de material',
    veredito: 'incorreta',
    pontos: -12,
    porque:
      'Couro protege contra abrasão e não isola nada. É a luva de carregar poste, não a de encostar em condutor.',
    norma: 'NR-10 — EPI isolante obrigatório em trabalho energizado',
  },

  // ---------------------------------------------------------------- pés
  {
    id: 'botina_isolante',
    vaga: 'pes',
    nome: 'Botina de segurança isolante',
    descricao: 'Couro, solado isolante, sem biqueira metálica',
    veredito: 'correta',
    pontos: 10,
    porque:
      'Sem componente metálico e com solado ensaiado, a botina isolante evita que o corpo feche o circuito pelo chão.',
    norma: 'NR-6 e NR-10 — calçado isolante em trabalho com eletricidade',
  },
  {
    id: 'botina_biqueira',
    vaga: 'pes',
    nome: 'Botina com biqueira de aço',
    descricao: 'Couro, biqueira metálica',
    veredito: 'incorreta',
    pontos: -10,
    porque:
      'A biqueira de aço é peça condutora dentro do calçado, encostada no pé. Serve para almoxarifado e obra, não para quem trabalha em rede energizada.',
    norma: 'NR-10 — é vedado o uso de componentes condutores junto ao corpo',
  },
  {
    id: 'tenis',
    vaga: 'pes',
    nome: 'Tênis',
    descricao: 'Calçado pessoal',
    veredito: 'incorreta',
    pontos: -10,
    porque:
      'Não tem isolação, não tem proteção contra perfuração e não segura o pé na escada nem na esteira do poste.',
    norma: 'NR-6 — calçado de segurança obrigatório na área',
  },

  // ---------------------------------------------------------------- cintura
  {
    id: 'paraquedista_talabarte',
    vaga: 'cintura',
    nome: 'Cinturão paraquedista com talabarte duplo',
    descricao: 'Com absorvedor de energia e cinto de posicionamento',
    veredito: 'correta',
    pontos: 12,
    porque:
      'O paraquedista distribui o impacto da queda pelo corpo inteiro. O talabarte duplo é o que permite subir sem nunca ficar desconectado, e o absorvedor reduz a força que chega na coluna.',
    norma: 'NR-35 — sistema de proteção contra quedas',
  },
  {
    id: 'cinto_abdominal',
    vaga: 'cintura',
    nome: 'Cinto abdominal',
    descricao: 'Cinto de posicionamento, faixa única na cintura',
    veredito: 'incorreta',
    pontos: -12,
    porque:
      'Cinto só de cintura concentra toda a força da queda no abdome e permite o corpo virar de cabeça para baixo. É proibido como sistema de retenção de queda.',
    norma: 'NR-35 — é vedado o cinturão abdominal para retenção de queda',
  },

  // ---------------------------------------------------------------- adorno
  {
    id: 'aliança_relogio',
    vaga: 'adorno',
    nome: 'Aliança, relógio e corrente',
    descricao: 'Objetos pessoais de metal',
    veredito: 'incorreta',
    pontos: -8,
    porque:
      'Metal no corpo vira caminho para a corrente e vira ponto de aquecimento no arco. Aliança que esquenta não sai mais do dedo. Adorno pessoal fica no armário, não no serviço.',
    norma: 'NR-10 — é vedado o uso de adornos pessoais em trabalho elétrico',
  },
  {
    id: 'nada_no_corpo',
    vaga: 'adorno',
    nome: 'Guardar tudo no armário',
    descricao: 'Sem adorno, sem metal no corpo',
    veredito: 'correta',
    pontos: 8,
    porque:
      'Retirar aliança, relógio, corrente e piercing antes de sair é parte do procedimento, não zelo exagerado.',
    norma: 'NR-10 — é vedado o uso de adornos pessoais em trabalho elétrico',
  },
]

/** Nota máxima possível na fase, para normalizar a pontuação. */
export const MAXIMO_FASE_1 = (Object.keys(VAGAS) as Vaga[]).reduce((soma, vaga) => {
  const melhor = PECAS.filter((p) => p.vaga === vaga).reduce(
    (m, p) => Math.max(m, p.pontos),
    0,
  )
  return soma + melhor
}, 0)

/* ------------------------------------------------------------- etiquetas */
/**
 * A ETIQUETA de cada peça — e a razão de ela existir.
 *
 * O vestiário antigo pedia que o jogador já soubesse a resposta: os botões
 * diziam "Capacete classe A" e "Capacete classe B", e quem não sabe de cor
 * qual classe é a elétrica chuta entre dois nomes. Isso não ensina nada; é
 * prova de múltipla escolha com boneco ao lado.
 *
 * A etiqueta é o que o eletricista de verdade lê ANTES de vestir: número de
 * CA, classe de ensaio, data do último ensaio elétrico e o estado visual da
 * peça. Com ela, a fase deixa de cobrar memória e passa a cobrar leitura —
 * a luva vencida é identificável porque a data está ali, não porque o nome
 * da peça entrega.
 *
 * `ensaioMeses` é RELATIVO a hoje, não data fixa: um gabarito com "11/2025"
 * escrito à mão vira mentira sozinho em alguns meses, e esta é a única
 * informação da fase que o jogador tem de comparar com o calendário.
 */
export type Etiqueta = {
  /** Número do Certificado de Aprovação, ou `null` quando a peça não tem. */
  ca: string | null
  /** Classe/especificação que a plaqueta da peça declara. */
  classe: string
  /** Meses até o vencimento do ensaio elétrico. Negativo = vencido. */
  ensaioMeses?: number
  /** O que se vê virando a peça na mão. */
  estado: string
}

export const ETIQUETAS: Record<string, Etiqueta> = {
  capacete_b: {
    ca: 'CA 31.904', classe: 'Classe B — ensaiado a 20.000 V',
    estado: 'Casco sem trinca, jugular de três pontos completa',
  },
  capacete_a: {
    ca: 'CA 29.715', classe: 'Classe A — só impacto, sem ensaio dielétrico',
    estado: 'Casco íntegro, sem jugular',
  },
  bone: {
    ca: null, classe: 'Brim 100% algodão — vestuário',
    estado: 'Novo, da última campanha',
  },

  protetor_facial_arco: {
    ca: 'CA 36.210', classe: 'Arco elétrico ATPV 12 cal/cm² — visor + suporte',
    estado: 'Visor sem risco, engate de capacete firme',
  },
  oculos_incolor: {
    ca: 'CA 25.716', classe: 'Impacto e partícula — policarbonato incolor',
    estado: 'Lente limpa, haste inteira',
  },
  oculos_escuro: {
    ca: null, classe: 'Óculos solar — sem especificação de impacto',
    estado: 'Lente escura, comprado em posto de gasolina',
  },

  vestimenta_fr: {
    ca: 'CA 38.112', classe: 'Antichama ATPV 12,4 cal/cm² — risco calculado 8,6',
    estado: 'Costura íntegra, sem remendo de tecido comum',
  },
  camisa_algodao: {
    ca: null, classe: 'Uniforme — algodão, manga longa',
    estado: 'Lavada, sem furo',
  },
  colete_refletivo: {
    ca: 'CA 40.302', classe: 'Alta visibilidade classe 2 — sinalização',
    estado: 'Faixa refletiva viva',
  },

  luva_isolante_cobertura: {
    ca: 'CA 27.088', classe: 'Borracha classe 2 (17 kV) + cobertura de raspa',
    ensaioMeses: 4,
    estado: 'Teste de ar feito agora: sem vazamento',
  },
  luva_isolante_so: {
    ca: 'CA 27.088', classe: 'Borracha classe 2 (17 kV) — sem cobertura',
    ensaioMeses: 5,
    estado: 'Borracha boa, sem a luva de raspa do par',
  },
  luva_isolante_vencida: {
    ca: 'CA 27.088', classe: 'Borracha classe 2 (17 kV) + cobertura de raspa',
    ensaioMeses: -5,
    estado: 'Aparência perfeita, sem corte nem ressecamento visível',
  },
  luva_vaqueta: {
    ca: 'CA 19.440', classe: 'Couro vaqueta — proteção mecânica',
    estado: 'Palma inteira, costura firme',
  },

  botina_isolante: {
    ca: 'CA 33.561', classe: 'Eletricista — solado isolante, sem metal',
    estado: 'Solado com desenho, sem trinca',
  },
  botina_biqueira: {
    ca: 'CA 30.118', classe: 'Segurança — biqueira de aço',
    estado: 'Couro novo, biqueira sem amassado',
  },
  tenis: {
    ca: null, classe: 'Calçado esportivo — uso pessoal',
    estado: 'Solado liso de tanto uso',
  },

  paraquedista_talabarte: {
    ca: 'CA 35.877', classe: 'Paraquedista + talabarte duplo em Y com absorvedor',
    ensaioMeses: 7,
    estado: 'Fitas sem desfiado, costura de segurança intacta',
  },
  cinto_abdominal: {
    ca: 'CA 21.603', classe: 'Posicionamento — faixa abdominal única',
    ensaioMeses: 9,
    estado: 'Fivela boa, fita sem desgaste',
  },

  aliança_relogio: {
    ca: null, classe: 'Objetos pessoais — aço e ouro',
    estado: 'Aliança, relógio de pulso e corrente no pescoço',
  },
  nada_no_corpo: {
    ca: null, classe: 'Nada no corpo — tudo guardado no armário',
    estado: 'Bolsos vazios, mãos e pescoço livres',
  },
}

/**
 * A data do ensaio escrita como aparece na plaqueta (mês/ano), a partir do
 * deslocamento em meses. Quem lê compara com a data de hoje no cabeçalho da
 * fase — é essa comparação que é o conteúdo.
 */
export function dataDoEnsaio(meses: number, hoje = new Date()): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() + meses, 1)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

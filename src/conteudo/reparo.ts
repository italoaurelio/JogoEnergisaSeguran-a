/**
 * Fase 3c — o reparo, como AÇÃO e não como lista.
 *
 * O que estava aqui era uma lista de nove frases para clicar na ordem certa.
 * O retorno do cliente foi direto: "parece um formulário, não é jogável". Ele
 * tem razão, e o defeito é mais fundo do que a aparência — numa lista, o
 * jogador escolhe uma FRASE. No serviço de verdade ele escolhe uma
 * FERRAMENTA e encosta num LUGAR, e é nessa escolha que mora tudo o que a
 * NR-10 tenta ensinar: a vara certa no ponto certo, o detector antes do
 * aterramento, o cadeado antes de qualquer coisa.
 *
 * Então o reparo virou isto: pegar uma ferramenta do cesto e aplicar num
 * ponto do poste. Nove passos, cinco alvos, e o estado da rede mudando entre
 * um e outro.
 *
 * O jogador NÃO vê se a linha está energizada. É esse o ponto. O detector é
 * o único jeito de saber, e quem pula o detector descobre encostando.
 */

/** Os pontos do poste em que dá para encostar alguma coisa. */
export type Alvo =
  | 'radio'          // o rádio no peito: falar com o Centro de Operação
  | 'chave'          // a chave fusível: seccionar, bloquear, desbloquear
  | 'condutor'       // o ramal: constatar ausência, aterrar, desaterrar
  | 'vizinhos'       // o que ficou energizado por perto
  | 'porta_fusivel'  // onde o elo entra

export const ALVOS: Record<Alvo, {
  nome: string
  /** Em metros do jogo (x, y, z). O poste está na origem. */
  onde: [number, number, number]
  dica: string
}> = {
  radio: {
    nome: 'Rádio',
    onde: [2.05, 5.75, 0.55],
    dica: 'Falar com o Centro de Operação',
  },
  chave: {
    nome: 'Chave fusível',
    onde: [0.42, 7.78, 0.0],
    dica: 'Seccionar, bloquear, desbloquear',
  },
  condutor: {
    nome: 'Ramal',
    onde: [0.95, 9.22, 0.10],
    dica: 'O cabo que alimenta as três casas',
  },
  vizinhos: {
    nome: 'Rede vizinha',
    onde: [-0.95, 9.22, 0.10],
    dica: 'O que continua energizado ao lado',
  },
  porta_fusivel: {
    nome: 'Porta-fusível',
    onde: [0.42, 7.40, 0.0],
    dica: 'Onde o elo entra',
  },
}

/** O que já aconteceu no poste. É isto que decide o que cada ação faz. */
export type Estado = {
  desligamentoPedido: boolean
  chaveAberta: boolean
  bloqueada: boolean
  ausenciaConstatada: boolean
  aterrado: boolean
  vizinhosProtegidos: boolean
  eloTrocado: boolean
  comunicado: boolean
  /** O Centro religou o trecho porque ninguém bloqueou. */
  religado: boolean
}

export const ESTADO_INICIAL: Estado = {
  desligamentoPedido: false,
  chaveAberta: false,
  bloqueada: false,
  ausenciaConstatada: false,
  aterrado: false,
  vizinhosProtegidos: false,
  eloTrocado: false,
  comunicado: false,
  religado: false,
}

/**
 * A linha está viva?
 *
 * Com a chave fechada, sim. Com a chave aberta mas SEM bloqueio, ela está
 * morta agora e pode voltar a qualquer momento — e é exatamente por isso que
 * `religado` existe: o Centro não sabe que tem gente na linha.
 */
export function energizado(e: Estado) {
  return !e.chaveAberta || e.religado
}

/** Uma ação possível: esta ferramenta, neste alvo. */
export type Acao = {
  /** Passo da NR-10 que esta ação cumpre. Casa com `PASSOS` em ocorrencia.ts. */
  passo: string
  /**
   * O gesto que o eletricista faz. Sem isto, chamar o Centro de Operação e
   * trocar o elo fusível davam a MESMA pose — e a cena deixava de contar o
   * que estava acontecendo. `trabalhando` é o padrão; só o que é visivelmente
   * outro gesto a 120 px de altura ganha pose própria.
   */
  gesto?: 'trabalhando' | 'radio'
  ferramenta: string
  alvo: Alvo
  /** O que o jogador manda fazer, escrito como ordem. */
  rotulo: string
  /** Aparece na tela quando a ação acontece. */
  feito: string
  /** Só fica disponível quando isto vale. */
  quando: (e: Estado) => boolean
  /** O que muda no poste. */
  aplicar: (e: Estado) => Partial<Estado>
  /**
   * Se devolver texto, ISTO MATA — a ação é executada e vira acidente.
   * É o único lugar do jogo em que errar tem consequência imediata, e é de
   * propósito: na rede, a consequência também é imediata.
   */
  mata?: (e: Estado) => string | null
}

const NA_LINHA = 'Você encostou numa linha energizada.'

export const ACOES: Acao[] = [
  {
    passo: 'desligamento',
    ferramenta: 'radio',
    alvo: 'radio',
    gesto: 'radio',
    rotulo: 'Pedir desligamento do trecho',
    feito: 'Centro de Operação autorizou o desligamento do ramal.',
    quando: (e) => !e.desligamentoPedido,
    aplicar: () => ({ desligamentoPedido: true }),
  },
  {
    passo: 'seccionar',
    ferramenta: 'vara_manobra',
    alvo: 'chave',
    rotulo: 'Abrir a chave com a vara',
    feito: 'Chave aberta. O ramal ficou sem tensão — por enquanto.',
    quando: (e) => !e.chaveAberta,
    aplicar: () => ({ chaveAberta: true }),
  },
  {
    passo: 'bloquear',
    ferramenta: 'bloqueio',
    alvo: 'chave',
    rotulo: 'Bloquear e etiquetar a chave',
    feito: 'Cadeado e etiqueta na chave. Ninguém religa este trecho sem você.',
    quando: (e) => e.chaveAberta && !e.bloqueada,
    aplicar: () => ({ bloqueada: true, religado: false }),
  },
  {
    passo: 'constatar',
    ferramenta: 'detector_at',
    alvo: 'condutor',
    rotulo: 'Testar o detector no ramal',
    feito: 'Detector testado antes e depois: ausência de tensão constatada.',
    quando: () => true,
    aplicar: () => ({ ausenciaConstatada: true }),
    // o detector é FEITO para encostar em linha viva: ele acusa e ninguém
    // se machuca. É a única ferramenta da fase que não mata com a linha viva,
    // e é justamente a que o jogador tende a pular
    mata: () => null,
  },
  {
    passo: 'aterrar',
    ferramenta: 'aterramento',
    alvo: 'condutor',
    rotulo: 'Instalar o aterramento temporário',
    feito: 'Aterramento instalado. Se a linha voltar, ela volta para a terra.',
    quando: (e) => !e.aterrado,
    aplicar: () => ({ aterrado: true }),
    mata: (e) => (energizado(e)
      ? `${NA_LINHA} O aterramento é cobre nu: com a chave fechada, você acabou de fechar o circuito pelo próprio corpo.`
      : null),
  },
  {
    passo: 'delimitar',
    ferramenta: 'cobertura',
    alvo: 'vizinhos',
    rotulo: 'Cobrir o que ficou energizado',
    feito: 'Rede vizinha coberta e zona delimitada.',
    quando: (e) => !e.vizinhosProtegidos,
    aplicar: () => ({ vizinhosProtegidos: true }),
  },
  {
    passo: 'executar',
    ferramenta: 'elo_certo',
    alvo: 'porta_fusivel',
    rotulo: 'Trocar o elo fusível',
    feito: 'Elo novo no porta-fusível, do valor do projeto.',
    quando: (e) => !e.eloTrocado,
    aplicar: () => ({ eloTrocado: true }),
    mata: (e) => (energizado(e)
      ? `${NA_LINHA} Trocar elo com a chave fechada é pôr a mão no ponto de corte da corrente.`
      : null),
  },
  {
    passo: 'executar',
    ferramenta: 'elo_maior',
    alvo: 'porta_fusivel',
    rotulo: 'Trocar pelo elo de valor maior',
    feito: 'Elo de amperagem acima da do projeto instalado.',
    quando: (e) => !e.eloTrocado,
    aplicar: () => ({ eloTrocado: true }),
    mata: (e) => (energizado(e) ? NA_LINHA : null),
  },
  {
    passo: 'retirar_aterramento',
    ferramenta: 'aterramento',
    alvo: 'condutor',
    rotulo: 'Retirar o aterramento',
    feito: 'Aterramento retirado.',
    quando: (e) => e.aterrado && e.eloTrocado,
    aplicar: () => ({ aterrado: false }),
  },
  {
    passo: 'desbloquear',
    ferramenta: 'bloqueio',
    alvo: 'chave',
    gesto: 'radio',
    rotulo: 'Retirar bloqueio e comunicar o Centro',
    feito: 'Bloqueio retirado e Centro avisado. Serviço encerrado.',
    // NÃO exige `bloqueada`. Quem nunca bloqueou também precisa poder
    // encerrar: exigindo o cadeado aqui, quem pulou o passo 3 ficava sem
    // nenhuma ação disponível e a fase travava para sempre — punindo com
    // softlock quem a fase deveria punir com nota.
    quando: (e) => e.eloTrocado && !e.comunicado,
    aplicar: () => ({ bloqueada: false, comunicado: true }),
  },
]

/**
 * As ferramentas que aparecem no cesto.
 *
 * Três delas (`radio`, `bloqueio`, `cobertura`) NÃO estão na caixa da etapa
 * anterior: rádio é do uniforme, e cadeado-etiqueta e cobertura são do
 * conjunto que sobe sempre. As outras só aparecem se o jogador as tiver
 * separado — levar a vara trincada e deixar a boa é uma decisão que só cobra
 * o preço aqui em cima.
 */
export const SEMPRE_NO_CESTO = ['radio', 'bloqueio', 'cobertura']

export const NOME_FERRAMENTA: Record<string, string> = {
  radio: 'Rádio',
  bloqueio: 'Cadeado e etiqueta',
  cobertura: 'Cobertura isolante',
  vara_manobra: 'Vara de manobra',
  vara_trincada: 'Vara trincada',
  detector_at: 'Detector de tensão',
  multimetro: 'Multímetro',
  aterramento: 'Aterramento temporário',
  elo_certo: 'Elo fusível (projeto)',
  elo_maior: 'Elo de valor maior',
  alicate_isolado: 'Alicate isolado',
  alicate_comum: 'Alicate comum',
  corda_icamento: 'Corda de içamento',
  escada_fibra: 'Escada de fibra',
  escada_aluminio: 'Escada de alumínio',
}

/**
 * O QUE CADA FERRAMENTA FAZ, numa linha.
 *
 * O retorno foi "não consigo decifrar". Olhando a tela dá para ver por quê:
 * o cesto mostra oito nomes secos — "Cobertura isolante", "Aterramento
 * temporário" — e quem não é eletricista não tem como saber o que cada um
 * serve para fazer. Eram oito ferramentas por cinco alvos, quarenta
 * combinações, e nenhuma pista.
 *
 * Isto NÃO entrega a ordem, que é o que está sendo avaliado: diz o que a
 * peça faz, não quando usá-la. Saber que o aterramento "manda para a terra
 * a corrente que voltar" não diz se ele vem antes ou depois do detector.
 */
export const PARA_QUE: Record<string, string> = {
  radio: 'Falar com o Centro de Operação: pedir desligamento e avisar quando acabar.',
  bloqueio: 'Cadeado e etiqueta na chave aberta, para ninguém religar com você na linha.',
  cobertura: 'Manta isolante sobre o que continua energizado perto de você.',
  vara_manobra: 'Abre e fecha a chave fusível à distância, sem encostar na rede.',
  vara_trincada: 'A mesma vara, com uma trinca longitudinal perto da cabeça.',
  detector_at: 'Testa se o cabo ainda tem tensão. Testa-se o detector antes e depois.',
  multimetro: 'Multímetro de bancada, de baixa tensão.',
  aterramento: 'Liga o cabo à terra: se a linha voltar, a corrente vai para o solo.',
  elo_certo: 'O elo fusível novo, do valor que o projeto manda.',
  elo_maior: 'Elo de amperagem acima da do projeto.',
  alicate_isolado: 'Alicate com isolação ensaiada para 1000 V.',
  alicate_comum: 'Alicate de cabo emborrachado, sem ensaio.',
  corda_icamento: 'Sobe e desce ferramenta sem carregar na mão.',
  escada_fibra: 'Escada isolante, para quando não há cesto.',
  escada_aluminio: 'Escada de alumínio. Alumínio conduz.',
}

/**
 * EM QUE PÉ ESTÁ O SERVIÇO, para aparecer sempre na tela.
 *
 * Era o que mais faltava: o jogador não tinha como saber se o trecho estava
 * vivo, se a ausência de tensão já tinha sido comprovada, se havia cadeado
 * na chave. Tudo isso é coisa que um eletricista lê do poste num relance e
 * que a tela escondia por completo — e sem isso a ordem vira adivinhação.
 */
export function situacao(e: Estado): {
  tom: 'vivo' | 'meio' | 'seguro'
  titulo: string
  detalhe: string
} {
  if (energizado(e)) {
    return {
      tom: 'vivo',
      titulo: 'Trecho energizado',
      detalhe: e.desligamentoPedido
        ? 'O Centro autorizou, mas a chave ainda está fechada.'
        : 'Ninguém autorizou manobra nenhuma ainda.',
    }
  }
  if (!e.ausenciaConstatada) {
    return {
      tom: 'meio',
      titulo: 'Chave aberta — tensão não comprovada',
      detalhe: 'Chave aberta não é prova de que o cabo está morto.',
    }
  }
  if (!e.aterrado) {
    return {
      tom: 'meio',
      titulo: 'Ausência de tensão constatada',
      detalhe: 'Sem aterramento, uma religação por engano acha você.',
    }
  }
  return {
    tom: 'seguro',
    titulo: 'Desenergizado e aterrado',
    detalhe: e.vizinhosProtegidos
      ? 'Zona delimitada. Dá para trabalhar.'
      : 'Falta cobrir o que ficou energizado por perto.',
  }
}

/**
 * Ferramenta errada no alvo certo: não faz nada, mas DIZ POR QUÊ.
 *
 * Sem isto o jogador clica, não acontece nada e ele conclui que o jogo está
 * quebrado. A recusa é conteúdo: é onde se explica por que o multímetro de
 * bancada não serve para constatar ausência de tensão em 13,8 kV.
 */
export const RECUSAS: { ferramenta: string; alvo: Alvo; porque: string }[] = [
  {
    ferramenta: 'vara_trincada', alvo: 'chave',
    porque: 'A trinca corre no sentido do comprimento: é por ela que a corrente sobe pela vara até a sua mão. Vara com trinca vai para o descarte, não para o serviço.',
  },
  {
    ferramenta: 'multimetro', alvo: 'condutor',
    porque: 'Multímetro de bancada é categoria de baixa tensão. Encostar a ponta dele em 13,8 kV não mede nada — explode na sua mão.',
  },
  {
    ferramenta: 'alicate_comum', alvo: 'porta_fusivel',
    porque: 'Cabo emborrachado de fábrica não é isolação ensaiada. O alicate isolado tem o duplo triângulo marcado; este não tem.',
  },
  {
    ferramenta: 'escada_aluminio', alvo: 'condutor',
    porque: 'Alumínio conduz. Escada de alumínio não encosta em rede, e no cesto ela não tem função nenhuma.',
  },
]

/**
 * Fase 3 — a ocorrência, em três etapas na mesma cena.
 *
 * 3a  chegar e isolar a área (decisões, com a peça aparecendo na cena)
 * 3b  separar o equipamento para ESTA falha
 * 3c  executar o reparo na ordem certa
 *
 * A ordem do reparo vale mais do que o resto da fase somado, porque é a parte
 * que mata quando invertida: aterrar antes de constatar ausência de tensão é
 * encostar um cabo de cobre numa rede que pode estar viva.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { som } from '../som'
import { type Fisico } from '../cena/Personagem'
import { SeloVeredito, type Selo } from '../Veredito'
import { PalcoPronto } from '../cena/Carregando'
import { Canvas } from '@react-three/fiber'
import { Acabamento } from '../cena/Acabamento'
import { LEVE, DPR } from '../cena/desempenho'
import { Environment } from '@react-three/drei'
import {
  AlvosDoPoste, Aterramento, Bloqueio, CameraDaCena, CenaOcorrencia,
  CidadeAoRedor, Cobertura, Eletricista, LuzOcorrencia, MarcadorDoServico,
  PortaFusivel,
  miraDoCesto,
  type Colocada, type PoseEletricista, type Vista,
} from '../cena/Ocorrencia3D'
import {
  ACOES, ALVOS, ESTADO_INICIAL, NOME_FERRAMENTA, PARA_QUE, RECUSAS, SEMPRE_NO_CESTO, situacao,
  energizado, type Alvo, type Estado,
} from '../conteudo/reparo'
import {
  CHEGADA, FERRAMENTAL, MAXIMO_CHEGADA, MAXIMO_FERRAMENTAL, MAXIMO_REPARO,
  OCORRENCIA, PASSOS, opcoesNaTela, passosNaTela, type DecisaoChegada,
} from '../conteudo/ocorrencia'
import type { Registro } from '../conteudo/pontuacao'

const Q = Math.PI / 2

/** Onde cada escolha põe o caminhão. A rua corre no eixo X. */
const POSICOES_VEICULO: Record<string, Colocada> = {
  protegendo: { peca: 'oc_veiculo', pos: [-8.5, 0, 2.6] },
  depois: { peca: 'oc_veiculo', pos: [8.5, 0, 2.6] },
  calcada: { peca: 'oc_veiculo', pos: [-5.5, 0, -2.9] },
}

/**
 * Posição de espera: na pista, bem antes da área, no sentido do fluxo. É de
 * onde o caminhão "chega" — e é o que dá ao jogador a escala e o sentido do
 * trânsito para responder a primeira pergunta.
 */
const CHEGANDO: Colocada = { peca: 'oc_veiculo', pos: [-19.5, 0, 2.6] }

const SINALIZACAO: Record<string, Colocada[]> = {
  compativel: [
    { peca: 'oc_cavalete', pos: [-27, 0, 3.4], giro: Q },
    { peca: 'oc_cone', pos: [-22, 0, 3.5] },
    { peca: 'oc_cone', pos: [-18, 0, 3.1] },
    { peca: 'oc_cone', pos: [-14, 0, 2.7] },
  ],
  colado: [
    { peca: 'oc_cavalete', pos: [-11.8, 0, 3.0], giro: Q },
    { peca: 'oc_cone', pos: [-11.2, 0, 2.6] },
  ],
  nada: [],
}

/** A fita sai do Blender com 3 m ao longo de −Z; esticar é mais barato. */
const AREA: Record<string, Colocada[]> = {
  cercada: [
    { peca: 'oc_cone', pos: [2.6, 0, 3.0] },
    { peca: 'oc_cone', pos: [-2.6, 0, 3.0] },
    { peca: 'oc_cone', pos: [-2.6, 0, -1.8] },
    { peca: 'oc_cone', pos: [2.6, 0, -1.8] },
    { peca: 'oc_fita', pos: [2.6, 0.55, 3.0], escala: [1, 1, 1.6] },
    { peca: 'oc_fita', pos: [-2.6, 0.55, 3.0], escala: [1, 1, 1.6] },
    { peca: 'oc_fita', pos: [2.6, 0.55, 3.0], giro: Q, escala: [1, 1, 1.74] },
    { peca: 'oc_fita', pos: [2.6, 0.55, -1.8], giro: Q, escala: [1, 1, 1.74] },
  ],
  so_cones: [
    { peca: 'oc_cone', pos: [1.4, 0, 1.2] },
    { peca: 'oc_cone', pos: [-1.4, 0, 1.2] },
  ],
  nenhuma: [],
}

/** A caixa de ferramentas, que chega com a equipe. */
const APOIO: Colocada[] = [
  { peca: 'oc_caixa', pos: [-1.9, 0, -1.1], giro: 0.3 },
]

/**
 * A escada ENCOSTA no poste, e isso é conta, não palpite. Medido na cena com
 * o jogo rodando:
 *
 *   poste  — seção duplo T, x ±0,055 constante, z ±0,139 na altura do topo
 *            da escada (a face afina de 0,36 na base para 0,19 aos 9,30 m)
 *   escada — eixo longo em Y, 4,63 m de sapata a topo, a própria peça com
 *            0,040 de meia-espessura em X e 0,267 de meia-largura em Z
 *
 * Encostar na face de X estava descartado: os degraus de escalada do poste
 * saem justamente em ±X, até 0,311 — a escada atravessaria um deles na altura
 * de 4,36 m. Sobra a face de Z, que é lisa.
 *
 * A ordem de Euler do three.js é XYZ, então o `tombo` em Z é aplicado ANTES
 * do `giro` em Y: a escada tomba no próprio plano (que é como uma escada
 * tomba) e depois o giro aponta esse tombo para onde se quer. Com giro −90°
 * o topo vai para +Z e o pé para −Z.
 *
 * Resultado: pé em (0, 0, −1,10), topo encostado na face do poste em
 * (0, 4,47, +0,137), 15° fora da vertical — o encosto de ~75° da NR-18.
 */
const ESCADA: Colocada = {
  peca: 'oc_escada', pos: [0, 2.255, -0.496], giro: -Math.PI / 2,
  tombo: [0, -0.2618],
}

/**
 * As peças que cada opção põe na cena, por decisão.
 *
 * Existe para a PRÉVIA: antes de confirmar, o jogador vê a escolha desenhada
 * em transparente no lugar onde ela ficaria. Era a parte que faltava para a
 * fase ensinar alguma coisa — "parar o caminhão protegendo a área" e "parar
 * depois da área" são duas frases quase iguais no painel, e vinte metros de
 * diferença na rua. Com a prévia, a diferença é vista antes de valer nota.
 */
const PECAS_DA_OPCAO: Record<string, Record<string, Colocada[]>> = {
  posicao_veiculo: Object.fromEntries(
    Object.entries(POSICOES_VEICULO).map(([k, v]) => [k, [v]]),
  ),
  distancia_sinalizacao: SINALIZACAO,
  area_trabalho: AREA,
}

// A caixa de ferramentas E a escada inteira, que vai a 4,47 m: com o
// enquadramento anterior (alvo a 0,5 m de altura) a escada saía cortada pelo
// topo da tela justo na etapa em que o jogador decide se leva escada.
const VISTA_FERRAMENTAL: Vista = { de: [-5.0, 3.2, 5.4], para: [-0.7, 2.2, -0.5], lente: 32 }
// Enquadramento do reparo: tem de caber do rádio no peito (y 5,75) ao
// condutor (y 9,22), que são 3,5 m de poste. O alvo antigo mirava y 6,4 e
// deixava a chave fusível e o ramal fora de quadro — eram justamente os dois
// pontos em que o jogador precisa clicar.
// Perto o bastante para a chave fusível ler, aberto o bastante para a LANÇA
// aparecer. Com o alvo em cima do poste o cesto ficava na beira do quadro e
// o braço que o segura, fora — o eletricista parecia flutuar ao lado do
// poste. O alvo puxado para x −1,2 põe o homem, a chave e o braço na mesma
// imagem.
const VISTA_REPARO: Vista = { de: [5.2, 8.4, 5.6], para: [-1.2, 7.1, 0.3], lente: 34 }

/**
 * Os pontos marcados NO POSTE. O rádio fica de fora de propósito.
 *
 * Ele está no seu peito, não no poste: como marca no mundo ele aparecia
 * boiando no meio da rua, a 5,75 m de altura e sem nada embaixo. Quem lê a
 * cena vê um ponto no ar. O rádio continua na lista do painel, que é onde
 * uma coisa que está com você pertence.
 */
const ALVOS_NA_CENA = (Object.keys(ALVOS) as Alvo[])
  .filter((id) => id !== 'radio')
  .map((id) => ({ id, nome: ALVOS[id].nome, onde: ALVOS[id].onde }))

/**
 * Articulação do porta-fusível, de `public/modelos/ocorrencia.json`.
 *
 * Escrito pelo exportador a partir do contato inferior da chave do meio —
 * a mesma trigonometria que posiciona a peça, em vez de um número repetido
 * à mão aqui e lá.
 */
const CHAVE_PINO: [number, number, number] = [0.4563, 7.733, 0]

/** Quais alvos já receberam o que precisavam, para a marca virar visto. */
function feitosNoPoste(e: Estado) {
  const feitos = new Set<string>()
  if (e.desligamentoPedido) feitos.add('radio')
  if (e.chaveAberta && e.bloqueada) feitos.add('chave')
  if (e.ausenciaConstatada && e.aterrado) feitos.add('condutor')
  if (e.vizinhosProtegidos) feitos.add('vizinhos')
  if (e.eloTrocado) feitos.add('porta_fusivel')
  return feitos
}

type Etapa = 'briefing' | 'chegada' | 'ferramental' | 'reparo'

export default function Fase3Ocorrencia({
  aoConcluir, fisico,
}: {
  aoConcluir: (registros: Registro[], maximo: number) => void
  /** O físico do vestiário: é ele quem sobe no cesto. */
  fisico: Fisico
}) {
  useEffect(() => { som.ambiente(true); return () => som.ambiente(false) }, [])
  const [etapa, setEtapa] = useState<Etapa>('briefing')
  const [indice, setIndice] = useState(0)
  const [escolhas, setEscolhas] = useState<Record<string, string>>({})
  const [retorno, setRetorno] = useState<string | null>(null)
  /** Opção escolhida mas ainda NÃO confirmada: é o que vira fantasma na cena. */
  const [previa, setPrevia] = useState<string | null>(null)
  /* o selo de acerto/erro por cima da tela; ele mesmo se apaga */
  const [selo, setSelo] = useState<Selo>(null)
  const [kit, setKit] = useState<string[]>([])
  const [ordem, setOrdem] = useState<string[]>([])
  /** O que já aconteceu no poste. É o estado que decide o que cada ação faz. */
  const [estadoPoste, setEstadoPoste] = useState<Estado>(ESTADO_INICIAL)
  const [acidentes, setAcidentes] = useState<{ porque: string }[]>([])
  /*
    A PILHA DE DESFAZER, um quadro por passo cumprido.

    O acidente custa UM PASSO, não a fase. Perder tudo faria o jogador
    refazer nove ações por um erro, e a terceira vez que isso acontece ele
    para de ler e começa a clicar. Perder nada era o outro extremo: tomava o
    choque, lia o texto e seguia de onde estava, sem consequência nenhuma.

    Voltar um passo é um estado em que o jogador JÁ ESTEVE, então não existe
    combinação morta do outro lado — o que estava disponível lá continua
    disponível.
  */
  const [historico, setHistorico] = useState<{ estado: Estado; ordem: string[] }[]>([])
  /*
    A FERRAMENTA NA MÃO mora aqui, e não dentro do `Reparo`.

    Os dois caminhos de clique — a marca sobre o poste em 3D e a lista no
    painel — têm de chamar exatamente a mesma função. Com o estado dentro do
    painel, o 3D precisaria de uma ponte por ref para alcançá-lo, e ponte por
    ref entre irmãos é o tipo de coisa que funciona até alguém mexer.
  */
  /**
   * A pose do eletricista. Ela VOLTA SOZINHA para `parado`.
   *
   * Sem o retorno automático ele congelava na última coisa que fez — de
   * braços abertos pelo resto da fase depois de um choque, ou com as mãos
   * na cara até o fim depois de trocar o elo. O que lê como ação é o
   * movimento de ida E VOLTA.
   */
  const [pose, setPose] = useState<PoseEletricista>('parado')
  useEffect(() => {
    if (pose === 'parado') return
    // O CHOQUE DURA MAIS QUE O CLARÃO, e isso é a diferença entre mostrar
    // o acidente e só piscar a tela. O clarão come 1,5 s; com a pose em
    // 1,7 s sobravam 200 ms para ver o eletricista jogado para trás — que é
    // justamente o que a cena existe para mostrar. Com 2,8 s ele fica mais
    // de um segundo em quadro depois que o branco sai.
    const quanto = pose === 'choque' ? 2800
      : pose === 'subindo' ? 2200
      : pose === 'radio' ? 1900
      : 1300
    const t = window.setTimeout(() => setPose('parado'), quanto)
    return () => window.clearTimeout(t)
  }, [pose])

  const [ferramenta, setFerramenta] = useState<string | null>(null)
  const [recado, setRecado] = useState<
    { tom: 'ok' | 'nao' | 'morte'; texto: string } | null>(null)
  const [clarao, setClarao] = useState(false)

  const usar = useCallback((alvo: string) => {
    if (!ferramenta) return
    const acao = ACOES.find(
      (a) => a.ferramenta === ferramenta && a.alvo === alvo && a.quando(estadoPoste),
    )

    if (!acao) {
      const recusa = RECUSAS.find((r) => r.ferramenta === ferramenta && r.alvo === alvo)
      setRecado({
        tom: 'nao',
        texto: recusa?.porque
          ?? `${NOME_FERRAMENTA[ferramenta]} não tem o que fazer em `
             + `${ALVOS[alvo as Alvo].nome.toLowerCase()} agora.`,
      })
      setFerramenta(null)
      return
    }

    /*
      A RELIGAÇÃO. É o acidente que a NR-10 inteira existe para evitar, e o
      único do jogo que não vem de um gesto — vem de uma OMISSÃO.

      Quem abre a chave e não bloqueia deixa o Centro de Operação sem saber
      que tem gente na linha. O Centro vê um ramal aberto e religa. Aqui isso
      acontece no instante em que o jogador põe a mão no porta-fusível: o
      trecho volta a ficar vivo um quadro antes de a ação ser avaliada.
    */
    let agora = estadoPoste
    let porReligacao = false
    if (acao.passo === 'executar' && estadoPoste.chaveAberta && !estadoPoste.bloqueada) {
      agora = { ...estadoPoste, religado: true }
      porReligacao = true
      setEstadoPoste(agora)
    }

    // O texto do acidente tem de dizer o que ACONTECEU. Reaproveitar o
    // genérico aqui ("trocar elo com a chave fechada") mente para quem abriu
    // a chave direitinho e só esqueceu o cadeado — e é justamente essa
    // pessoa que precisa entender por que o cadeado existe.
    const morte = porReligacao
      ? 'Você abriu a chave, mas não bloqueou. O Centro de Operação viu um '
        + 'ramal aberto, não sabia que tinha gente na linha, e religou o '
        + 'trecho — com a sua mão no porta-fusível.'
      : acao.mata?.(agora)
    if (morte) {
      /*
        DEPOIS DO ACIDENTE, O SERVIÇO CONTINUA — UM PASSO ATRÁS.

        O arco abre a proteção a montante, então o trecho fica morto de novo.
        Sem este desfazer a fase travava: `religado` ficava ligado para
        sempre, todo aterrar e todo trocar-elo seguintes matavam de novo, e
        `eloTrocado` nunca virava verdadeiro — laço infinito de arco elétrico.

        O que o acidente cobra é o ÚLTIMO PASSO CUMPRIDO: ele volta a não
        estar feito e tem de ser refeito. O visto some do poste na mesma hora,
        que é como o jogador percebe que perdeu terreno sem precisar ler.
      */
      const anterior = historico[historico.length - 1]
      const perdido = anterior
        ? PASSOS.find((p) => p.id === ordem[ordem.length - 1])
        : undefined
      if (anterior) {
        setEstadoPoste({ ...anterior.estado, religado: false })
        setOrdem(anterior.ordem)
        setHistorico((h) => h.slice(0, -1))
      } else {
        setEstadoPoste((e) => ({ ...e, religado: false, chaveAberta: true }))
      }
      /*
        O ARCO É O SEGUNDO MAIS ENSINÁVEL DE OITO MINUTOS, e passava antes de
        o olho registrar: 1,5 s de clarão, meio segundo de som e um parágrafo
        aparecendo por cima de tudo ao mesmo tempo.

        Agora ele é segurado em três tempos. O clarão estoura. O MUNDO FICA
        MUDO por 1,4 s — silêncio custa nada e pesa mais que qualquer efeito;
        é o que um susto de verdade faz com a audição. E só depois do clarão
        o texto entra, para o jogador assistir à cena em vez de ler por cima
        dela.
      */
      setPose('choque')
      setAcidentes((a) => [...a, { porque: morte }])
      setClarao(true)
      som.veredito(false)
      som.ambiente(false)
      window.setTimeout(() => setClarao(false), 1500)
      window.setTimeout(() => som.ambiente(true), 1400)
      window.setTimeout(() => setRecado({
        tom: 'morte',
        texto: perdido
          ? `${morte}\n\nA proteção a montante abriu e o trecho morreu de `
            + `novo. Você se recompõe — mas perdeu o passo anterior: `
            + `${perdido.texto.toLowerCase()}. Refaça.`
          : morte,
      }), 1100)
      setRecado(null)
      setFerramenta(null)
      return
    }

    setHistorico((h) => [...h, { estado: estadoPoste, ordem }])
    setEstadoPoste((e) => ({ ...e, ...acao.aplicar(e) }))
    setPose(acao.gesto ?? 'trabalhando')
    setOrdem((a) => [...a, acao.passo])
    som.chave()
    setRecado({ tom: 'ok', texto: acao.feito })
    setFerramenta(null)
  }, [ferramenta, estadoPoste, historico, ordem])

  const colocadas = useMemo<Colocada[]>(() => {
    const saida: Colocada[] = []
    const v = escolhas.posicao_veiculo
    if (v && POSICOES_VEICULO[v]) {
      // O cesto sobe quando o reparo começa — é quando alguém de fato subiria.
      // Antes disso a lança fica deitada no berço, que é como o caminhão anda.
      saida.push({ ...POSICOES_VEICULO[v], elevacao: etapa === 'reparo' ? 1 : 0 })
    }
    // Antes de escolher, o caminhão aparece PARADO ATRÁS, recém-chegado. Sem
    // isto a pergunta "onde parar o caminhão?" vinha sem caminhão nenhum em
    // quadro: o jogador via rua e casas e tinha de imaginar o veículo, o
    // tamanho dele e de que lado o trânsito vem. Quem não vê, chuta.
    else if (etapa === 'chegada') saida.push(CHEGANDO)
    const s = escolhas.distancia_sinalizacao
    if (s) saida.push(...(SINALIZACAO[s] ?? []))
    const a = escolhas.area_trabalho
    if (a) saida.push(...(AREA[a] ?? []))
    if (etapa === 'ferramental' || etapa === 'reparo') {
      saida.push(...APOIO)
      // A escada só existe na cena se o jogador a tiver separado — antes ela
      // ficava encostada no poste mesmo para quem deixou escada nenhuma na
      // caixa, o que desmentia a própria pergunta. Enquanto ele está
      // separando o material, ela aparece em prévia; vira peça quando ele
      // sobe para o serviço.
      const alu = kit.includes('escada_aluminio')
      if (kit.includes('escada_fibra') || alu) {
        saida.push({
          ...ESCADA,
          metal: alu && !kit.includes('escada_fibra'),
          fantasma: etapa === 'ferramental',
        })
      }
    }
    // a prévia entra por último, para desenhar por cima do que já está posto
    if (etapa === 'chegada' && previa) {
      const mapa = PECAS_DA_OPCAO[CHEGADA[indice].id]
      for (const p of mapa?.[previa] ?? []) saida.push({ ...p, fantasma: true })
    }
    return saida
  }, [escolhas, etapa, previa, indice, kit])

  /**
   * Onde o eletricista fica de pé: no piso do cesto, olhando para o poste.
   *
   * Sai da MESMA conta que posiciona a lança (`miraDoCesto`), e não de um
   * ponto escrito à mão — se o jogador estacionar o caminhão em outro lugar,
   * o cesto vai parar em outro lugar e ele vai junto. Foi por ter um ponto
   * escrito à mão que ele apareceu dentro do transformador.
   */
  /*
    ELE SOBE COM O CESTO — não aparece lá em cima.

    Aqui só vai o que não muda: de qual caminhão sai a lança e para onde ele
    acaba olhando. A POSIÇÃO é refeita a cada quadro dentro do `Eletricista`,
    pela mesma conta do braço, porque o caminho do cesto é um arco e a lança
    leva uns três segundos para chegar. Antes este `useMemo` devolvia o ponto
    FINAL e ele ficava parado no ar enquanto o cesto vazio ia buscá-lo.
  */
  const noCesto = useMemo(() => {
    const v = escolhas.posicao_veiculo
    const caminhao = (v ? POSICOES_VEICULO[v]?.pos : null) ?? CHEGANDO.pos
    return {
      caminhao,
      // de costas para a lança, olhando para o poste
      giro: Math.PI / 2 - miraDoCesto(caminhao).giro,
    }
  }, [escolhas.posicao_veiculo])

  const vista: Vista = useMemo(() => {
    if (etapa === 'briefing') return { de: [-13, 6.5, 12], para: [0, 4.0, 0], lente: 30 }
    if (etapa === 'chegada') return CHEGADA[indice].camera
    if (etapa === 'ferramental') return VISTA_FERRAMENTAL
    return VISTA_REPARO
  }, [etapa, indice])

  const concluir = useCallback(() => {
    const registros: Registro[] = []

    for (const d of CHEGADA) {
      const op = d.opcoes.find((o) => o.id === escolhas[d.id])
      registros.push({
        fase: 'ocorrencia', id: d.id, titulo: d.nome,
        veredito: op?.certa ? 'correta' : 'incorreta',
        pontos: op?.certa ? d.pontos : 0,
        porque: op?.porque ?? 'Decisão não tomada.',
        norma: d.norma,
      })
    }

    for (const f of FERRAMENTAL) {
      const levou = kit.includes(f.id)
      if (f.necessaria) {
        registros.push({
          fase: 'ocorrencia', id: f.id, titulo: `Levou: ${f.nome}`,
          veredito: levou ? 'correta' : 'incorreta',
          pontos: levou ? f.pontos : 0,
          porque: levou ? f.porque : `Ficou para trás. ${f.porque}`,
          norma: f.norma,
        })
      } else if (levou) {
        registros.push({
          fase: 'ocorrencia', id: f.id, titulo: `Levou indevidamente: ${f.nome}`,
          veredito: 'incorreta', pontos: f.pontos, porque: f.porque,
          norma: f.norma,
        })
      }
    }

    for (let i = 0; i < PASSOS.length; i++) {
      const esperado = PASSOS[i]
      const acertou = ordem[i] === esperado.id
      registros.push({
        fase: 'ocorrencia', id: `passo_${esperado.id}`,
        titulo: `Passo ${i + 1}: ${esperado.texto}`,
        veredito: acertou ? 'correta' : 'incorreta',
        pontos: acertou ? 6 : 0,
        porque: acertou
          ? esperado.porque
          : `Este era o passo ${i + 1}. ${esperado.porque}`,
        norma: esperado.norma,
      })
    }

    // ACIDENTE NÃO É UM PASSO FORA DE ORDEM: é um evento, e desconta.
    // Sem isto, quem leva um arco elétrico e depois executa tudo na ordem
    // sai com a mesma nota de quem não levou — e a fase ensinaria que
    // encostar em linha viva é um detalhe de percurso.
    acidentes.forEach((a, i) => {
      registros.push({
        fase: 'ocorrencia', id: `acidente_${i}`,
        titulo: 'Acidente: contato com parte energizada',
        veredito: 'incorreta', pontos: -18, porque: a.porque,
        norma: 'NR-10 — desenergização antes de qualquer intervenção',
      })
    })

    aoConcluir(registros, MAXIMO_CHEGADA + MAXIMO_FERRAMENTAL + MAXIMO_REPARO)
  }, [escolhas, kit, ordem, acidentes, aoConcluir])

  return (
    <div className="vestiario">
      {/* O CLARÃO cobre a tela inteira, e por isso mora aqui e não dentro do
          painel: `.vestiario-painel` tem `overflow: hidden` e recortava o
          arco elétrico numa tira na lateral direita. */}
      {clarao && <div className="clarao" aria-hidden />}
      <SeloVeredito tipo={selo} aoFim={() => setSelo(null)} />
      <div className="vestiario-palco">
        <Canvas dpr={DPR} shadows camera={{ position: [-16, 8, 18], fov: 40 }}
                gl={{ antialias: !LEVE }}>
          {/*
            O CÉU ESTAVA FALTANDO, e o que aparecia no lugar dele era o
            `background` do CSS de `.vestiario-palco` — um gradiente radial
            que CLAREIA NO ALTO e escurece até o horizonte, ou seja, o
            contrário de um céu.

            O resultado era uma cena de sol a pino (hemisférica a 1,5,
            direcional a 3,2, sombra dura) contra um fundo de madrugada. Não
            lia como estilo, lia como render quebrado — e os cabos, que são a
            razão de ser da cena, eram fio escuro sobre fundo escuro, sem
            contraste para o SMAA resolver.

            A névoa é a mesma do trajeto, cuja cor já foi medida contra o
            horizonte desta HDRI. Sem ela a casa a 40 m tinha o mesmo
            contraste da casa a 4 m e a cena não tinha profundidade nenhuma.
          */}
          <fog attach="fog" args={['#b8c6d4', 55, 190]} />
          <Environment files="./hdri/ceu.hdr" environmentIntensity={0.42} background />
          <LuzOcorrencia />
          <CenaOcorrencia colocadas={colocadas} />
          <CidadeAoRedor />
          {/*
            O marcador de missão só existe ENQUANTO ele chega. Depois de
            parar o caminhão ele já sabe onde é, e um cilindro verde em
            volta do poste durante o reparo atrapalharia justamente a parte
            em que se olha para o poste.
          */}
          {(etapa === 'briefing' || etapa === 'chegada') && (
            <MarcadorDoServico em={[0, 1.3, 0]} />
          )}
          {etapa === 'reparo' && (
            <>
              <AlvosDoPoste
                alvos={ALVOS_NA_CENA}
                ativo={null}
                feitos={feitosNoPoste(estadoPoste)}
                escolher={usar}
              />
              <PortaFusivel aberta={estadoPoste.chaveAberta} pino={CHAVE_PINO} />
              <Eletricista
                pose={pose}
                caminhao={noCesto.caminhao}
                giro={noCesto.giro}
                subindo={1}
                fisico={fisico}
              />
              <Aterramento posto={estadoPoste.aterrado} />
              <Bloqueio posto={estadoPoste.bloqueada} />
              <Cobertura posta={estadoPoste.vizinhosProtegidos} />
            </>
          )}
          <CameraDaCena vista={vista} />
          <Acabamento raio={2.2} />
        <PalcoPronto />
        </Canvas>
      </div>

      <aside className="vestiario-painel">
        {etapa === 'briefing' && (
          <Briefing comecar={() => setEtapa('chegada')} />
        )}

        {etapa === 'chegada' && (
          <Chegada
            decisao={CHEGADA[indice]}
            previa={previa}
            retorno={retorno}
            marcar={(id) => { setPrevia(id); som.clique() }}
            confirmar={() => {
              if (!previa) return
              const op = CHEGADA[indice].opcoes.find((o) => o.id === previa)
              setEscolhas((a) => ({ ...a, [CHEGADA[indice].id]: previa }))
              setRetorno(previa)
              setPrevia(null)
              // o selo toca o som; `som.confirmar()` por baixo dele viraria
              // dois bipes em cima um do outro
              setSelo(op?.certa ? 'acerto' : 'erro')
            }}
            avancar={() => {
              setRetorno(null)
              setPrevia(null)
              if (indice + 1 < CHEGADA.length) setIndice(indice + 1)
              else setEtapa('ferramental')
            }}
            ultimo={indice + 1 === CHEGADA.length}
          />
        )}

        {etapa === 'ferramental' && (
          <Ferramental
            kit={kit}
            alternar={(id) =>
              setKit((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
            }
            avancar={() => setEtapa('reparo')}
          />
        )}

        {etapa === 'reparo' && (
          <Reparo
            kit={kit}
            estado={estadoPoste}
            ordem={ordem}
            acidentes={acidentes}
            concluir={concluir}
            ferramenta={ferramenta}
            setFerramenta={(f) => { setFerramenta(f); setRecado(null) }}
            recado={recado}
            setRecado={setRecado}
            clarao={clarao}
            usar={usar}
          />
        )}
      </aside>
    </div>
  )
}

function Briefing({ comecar }: { comecar: () => void }) {
  return (
    <>
      <header className="painel-topo">
        <p className="sobretitulo">Fase 3 · Ocorrência</p>
        <h2>{OCORRENCIA.titulo}</h2>
        <p className="painel-texto">{OCORRENCIA.endereco}</p>
      </header>
      <section className="grupo cresce">
        <h3>O chamado</h3>
        <p className="painel-texto">{OCORRENCIA.relato}</p>
        <h3 style={{ marginTop: 18 }}>O que você encontrou</h3>
        <p className="painel-texto">{OCORRENCIA.diagnostico}</p>
      </section>
      <div className="painel-rodape">
        <button className="btn btn-grande" onClick={comecar}>Chegar ao local</button>
      </div>
    </>
  )
}

function Chegada({
  decisao, previa, retorno, marcar, confirmar, avancar, ultimo,
}: {
  decisao: DecisaoChegada
  previa: string | null
  retorno: string | null
  marcar: (id: string) => void
  confirmar: () => void
  avancar: () => void
  ultimo: boolean
}) {
  const op = decisao.opcoes.find((o) => o.id === retorno)
  const marcada = decisao.opcoes.find((o) => o.id === previa)
  return (
    <>
      <header className="painel-topo">
        <p className="sobretitulo">Fase 3 · Chegada</p>
        <h2>{decisao.nome}</h2>
        <p className="painel-texto">{decisao.pergunta}</p>
      </header>

      {!op ? (
        <>
          <section className="grupo cresce">
            <div className="opcoes coluna">
              {opcoesNaTela(decisao).map((o) => (
                <button
                  key={o.id}
                  className={`opcao alta ${previa === o.id ? 'ativa' : ''}`}
                  onClick={() => marcar(o.id)}
                >
                  {o.texto}
                </button>
              ))}
            </div>
          </section>
          <div className="painel-rodape">
            {/*
              O botão só aparece com uma opção marcada, e o texto diz o que a
              transparência na cena significa. Sem essa linha o jogador clica
              numa opção, vê um caminhão meio apagado aparecer e não sabe se
              aquilo já valeu.
            */}
            <p className={marcada ? 'aviso-previa' : 'painel-aviso'}>
              {marcada
                ? 'Isto é uma prévia: o que está transparente na cena ainda não aconteceu.'
                : 'Escolha uma opção para ver na cena antes de valer.'}
            </p>
            <button className="btn btn-grande" onClick={confirmar} disabled={!marcada}>
              Executar a manobra
            </button>
          </div>
        </>
      ) : (
        <>
          <section className="grupo cresce">
            <h3 className={op.certa ? 'nota-ok' : 'nota-ruim'}>
              {op.certa ? 'Decisão correta' : 'Decisão errada'}
            </h3>
            <p className="painel-texto">{op.porque}</p>
            <p className="norma">{decisao.norma}</p>
          </section>
          <div className="painel-rodape">
            <button className="btn btn-grande" onClick={avancar}>
              {ultimo ? 'Separar o equipamento' : 'Próxima decisão'}
            </button>
          </div>
        </>
      )}
    </>
  )
}

function Ferramental({
  kit, alternar, avancar,
}: { kit: string[]; alternar: (id: string) => void; avancar: () => void }) {
  return (
    <>
      <header className="painel-topo">
        <p className="sobretitulo">Fase 3 · Equipamento</p>
        <h2>Separe o que vai subir</h2>
        <p className="painel-texto">
          A caixa tem mais coisa do que este serviço pede. Leve o que é do
          serviço — e só o que está em condição de uso.
        </p>
      </header>
      <ul className="arara">
        {FERRAMENTAL.map((f) => (
          <li key={f.id}>
            <button
              className={`item ${kit.includes(f.id) ? 'ativa' : ''}`}
              onClick={() => alternar(f.id)}
              aria-pressed={kit.includes(f.id)}
              aria-label={`${f.nome} — ${f.descricao}`}
            >
              <span className="item-nome">{f.nome}</span>
              <span className="item-desc">{f.descricao}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="painel-rodape">
        <p className="painel-aviso">{kit.length} peça(s) separada(s)</p>
        <button className="btn btn-grande" onClick={avancar} disabled={!kit.length}>
          Subir para o serviço
        </button>
      </div>
    </>
  )
}

/**
 * O REPARO. Ferramenta no alvo, não frase numa lista.
 *
 * O jogador pega uma ferramenta do cesto e encosta num ponto do poste. Cada
 * par (ferramenta, alvo) é uma ação da NR-10, e a ordem em que elas saem é a
 * ordem que a fase avalia — a mesma nota de antes, obtida jogando em vez de
 * ordenando frases.
 *
 * Três coisas fazem isto ser jogo e não formulário:
 *
 *  1. O jogador NÃO VÊ se a linha está energizada. O detector é o único jeito
 *     de saber, e quem pula o detector descobre encostando.
 *  2. Ferramenta errada no alvo certo é RECUSADA COM MOTIVO. A recusa é
 *     conteúdo: é onde se diz por que o multímetro de bancada não mede 13,8 kV.
 *  3. Erro grave tem consequência na hora, não no relatório. Aterrar com a
 *     chave fechada dá arco elétrico, na tela, com o eletricista levando o
 *     tranco. Caricato de propósito: isto é treinamento, não simulação de
 *     acidente.
 */
function Reparo({
  kit, estado, ordem, acidentes, concluir,
  ferramenta, setFerramenta, recado, setRecado, clarao, usar,
}: {
  kit: string[]
  estado: Estado
  ordem: string[]
  acidentes: { porque: string }[]
  concluir: () => void
  ferramenta: string | null
  setFerramenta: (f: string | null) => void
  recado: { tom: 'ok' | 'nao' | 'morte'; texto: string } | null
  setRecado: (r: null) => void
  clarao: boolean
  usar: (alvo: string) => void
}) {
  /** O que o cesto tem: o que sempre sobe mais o que o jogador separou. */
  const cesto = useMemo(
    () => [...SEMPRE_NO_CESTO, ...kit].filter((f) => NOME_FERRAMENTA[f]),
    [kit],
  )

  const alvos = useMemo(
    () => (Object.keys(ALVOS) as Alvo[]).map((id) => ({
      id, nome: ALVOS[id].nome, onde: ALVOS[id].onde,
    })),
    [],
  )

  const acabou = estado.eloTrocado && !estado.aterrado && estado.comunicado
  const agora = situacao(estado)

  return (
    <>
      <header className="painel-topo">
        <p className="sobretitulo">Fase 3 · O reparo</p>
        <h2>{ferramenta ? 'Onde você vai usar?' : 'O que você vai fazer?'}</h2>
        {/*
          O PARÁGRAFO SÓ EXISTE COM FERRAMENTA NA MÃO.

          Sem ela, a ordem de serviço logo abaixo já diz o que fazer, e a
          frase genérica custava 22 px num painel que estava cortando os três
          últimos passos da lista. Medido: a coluna soma 790 px numa caixa de
          720.
        */}
        {ferramenta && (
          <p className="painel-texto">
            {PARA_QUE[ferramenta] ?? `${NOME_FERRAMENTA[ferramenta]} na mão.`}
          </p>
        )}
      </header>

      {/*
        EM QUE PÉ ESTÁ O SERVIÇO, sempre na tela.

        O retorno foi "não consigo decifrar". Era isto: o jogador escolhia
        entre oito ferramentas e cinco alvos sem saber se o trecho estava
        vivo, se a ausência de tensão já tinha sido comprovada ou se havia
        cadeado na chave. Um eletricista lê tudo isso do poste num relance; a
        tela escondia por completo, e sem isso a ordem vira adivinhação.

        Não entrega o gabarito: diz o ESTADO, não o próximo passo. Saber que
        o cabo ainda não foi testado não diz com o quê se testa.
      */}
      <div className={`situacao situacao-${agora.tom}`}>
        <strong>{agora.titulo}</strong>
        <span>
          {agora.detalhe}{' '}
          <em>{estado.bloqueada ? '· chave bloqueada' : '· sem bloqueio'}</em>
        </span>
      </div>

      <section className="grupo cresce">
        <h3>No cesto</h3>
        <ul className="cesto">
          {cesto.map((f) => (
            <li key={f}>
              <button
                className={`ferramenta ${ferramenta === f ? 'na-mao' : ''}`}
                onClick={() => { setFerramenta(ferramenta === f ? null : f); setRecado(null) }}
              >
                {NOME_FERRAMENTA[f]}
              </button>
            </li>
          ))}
        </ul>

        {/*
          Os mesmos alvos que estão no poste, repetidos aqui em texto.
          Não é redundância: num totem de 1366 px a marca sobre o condutor
          fica a 14 px da marca sobre a rede vizinha, e dedo não acerta isso.
        */}
        {ferramenta && (
          <>
            <h3 style={{ marginTop: 18 }}>Em quê</h3>
            <div className="opcoes coluna">
              {alvos.map((a) => (
                <button key={a.id} className="opcao alta" onClick={() => usar(a.id)}>
                  {a.nome} <span className="alvo-dica">{ALVOS[a.id as Alvo].dica}</span>
                </button>
              ))}
              <button className="btn btn-fraco" onClick={() => setFerramenta(null)}>
                Guardar de volta
              </button>
            </div>
          </>
        )}

        {recado && !ferramenta && (
          <p className={`recado recado-${recado.tom}`}>{recado.texto}</p>
        )}

        {/*
          A ORDEM DE SERVIÇO, inteira e sempre à vista.

          Antes aqui só aparecia o que JÁ tinha sido feito, e o jogador tinha
          de deduzir o resto de cabeça. O retorno foi direto: "essa parte da
          manutenção eu não consigo decifrar, eu entendo, mas tá difícil
          demais" — e depois "deixa mais claro o que deve ser feito, tipo uma
          checklist".

          Entregar a sequência custa: a nota da fase é 6 pontos por passo na
          posição certa. O que sobra de exercício é o que já era a parte
          perigosa — descobrir COM O QUÊ e ONDE se cumpre cada item, que é de
          onde saem os acidentes (abrir a chave e esquecer o cadeado continua
          valendo -18). Um eletricista de verdade também não decora a NR-10
          no poste: ele tem a ordem de serviço na mão.
        */}
        {!ferramenta && (
          <>
            <h3 style={{ marginTop: 8 }}>Ordem de serviço</h3>
            <ol className="roteiro">
              {PASSOS.map((p) => {
                const feito = ordem.includes(p.id)
                const agoraEste = !feito
                  && !PASSOS.slice(0, PASSOS.indexOf(p)).some((x) => !ordem.includes(x.id))
                return (
                  <li
                    key={p.id}
                    className={feito ? 'feito' : agoraEste ? 'agora' : ''}
                  >
                    {p.curto}
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </section>

      <div className="painel-rodape">
        {acidentes.length > 0 && (
          <p className="painel-aviso">
            {acidentes.length} acidente(s) — aparecem no relatório.
          </p>
        )}
        <button className="btn btn-grande" onClick={concluir} disabled={!acabou}>
          {acabou ? 'Encerrar o serviço' : 'O serviço ainda não terminou'}
        </button>
      </div>
    </>
  )
}


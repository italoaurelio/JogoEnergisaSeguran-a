/**
 * Fase 2b — o trajeto até a ocorrência.
 *
 * O veículo segue o traçado sozinho; o jogador controla só acelerador e freio.
 * Foi a decisão travada com o cliente: dirigir de verdade, mas o mais
 * facilitado possível. O que se avalia é conduta, não habilidade com controle.
 *
 * A simulação roda no laço de quadro (refs, sem estado de React) porque
 * re-renderizar a árvore sessenta vezes por segundo derrubaria a taxa. Só o
 * painel sobe para o estado, e a 10 Hz.
 */
import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef,
  useState,
} from 'react'
import { PalcoPronto } from '../cena/Carregando'
import { Canvas, useFrame } from '@react-three/fiber'
import { som } from '../som'
import { IconeAviso, type TipoAviso } from '../icones'
import { SeloVeredito, type Selo } from '../Veredito'
import { Acabamento } from '../cena/Acabamento'
import { BORDA_DIR, ZONA_ESCOLA } from '../cena/paisagem'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import { Mundo, paisagem, type Marco } from '../cena/Via'
import { MarcadorDoServico } from '../cena/Ocorrencia3D'
import { perfilEm, type NoTracado } from '../cena/curva'
import { Cabine, LuzCabine } from '../cena/Cabine3D'
import {
  CONDUTA, DISTANCIA_TOTAL, FALTAS, MAXIMO_TRAJETO, TRAJETO, VEICULO,
  type Evento, type Trecho, TETO_DT,
} from '../conteudo/trajeto'
import type { Registro } from '../conteudo/pontuacao'

/**
 * Onde o caminhão para atrás do ônibus em embarque.
 *
 * 9 m: o ônibus tem 8,6 m e está centrado no próprio metro, então a traseira
 * dele fica a 4,3 m; mais 4,7 m de distância de segurança e o bico do
 * caminhão. Menos que isso e a câmera entra dentro da lataria.
 */
const PARAR_ATRAS_DO_ONIBUS = 9

/**
 * Últimos metros do trajeto, onde o veículo encosta sozinho.
 *
 * O jogador pode estar com o pé no acelerador quando chega — e terminar a
 * fase a 60 km/h, com corte seco para a ocorrência, lia como "a tela trocou",
 * não como "cheguei". Aqui a velocidade passa a ser limitada por
 * `restante / 4`, o que faz o caminhão desacelerar sozinho e parar no ponto,
 * ao lado do poste. Acelerar no fim não muda nada, que é o que acontece
 * quando se chega mesmo.
 *
 * 42 e não 70: com o trajeto cortado para 640 m, o ciclista ficou no metro
 * 580 e a rampa de 70 m começaria em 570 — o caminhão já estaria encostando
 * sozinho ANTES de passar pelo ciclista, e a última conduta da fase seria
 * julgada numa velocidade que o jogador não escolheu.
 */
const CHEGADA_M = 42
/** Velocidade no instante em que a frenagem de chegada começa (≈40 km/h). */
const V_CHEGADA = 11
/** Nos últimos tantos metros o caminhão vai encostando no meio-fio. */
const ENCOSTA_M = 30
/**
 * Onde ele para, no eixo lateral do jogo.
 *
 * NEGATIVO, e isso foi medido e não deduzido: `lateral` positivo é o desvio
 * do ciclista, que joga o caminhão para a CONTRAMÃO. A calçada do lado do
 * motorista é `BORDA_DIR`, que vale −1,75 — o sinal de "direita" no nome das
 * constantes da paisagem é o da pista, não o do eixo X.
 */
const LATERAL_CALCADA = -1.25

/** Fim de escala do velocímetro. O trecho mais rápido é 60 km/h. */
const ESCALA_VELOCIMETRO = 80

/**
 * Onde cada trecho começa, em % do trajeto — os traços da barra de progresso.
 *
 * Sem eles a barra só diz "falta muito": com eles o jogador vê que está
 * chegando no fim da avenida, que é a informação que ele usa para decidir se
 * acelera ou já começa a reduzir.
 */
const MARCAS_DE_TRECHO: number[] = (() => {
  const saida: number[] = []
  let soma = 0
  for (const t of TRAJETO.slice(0, -1)) {
    soma += t.metros
    saida.push((soma / DISTANCIA_TOTAL) * 100)
  }
  return saida
})()

/** A cabine fica 52 cm acima da pista. */
const ALTURA_CABINE = 0.52
/**
 * Olho do motorista, em coordenadas do jogo (vem de cabine.json).
 *
 * 1,17 e nao 1,21: com o olho mais alto NENHUM ponto do volante ficava a
 * menos de 40 graus abaixo da direcao do olhar, e a borda de baixo da tela
 * esta a 27,5 graus — dirigia-se sem ver volante nenhum. Baixar 4 cm aqui e
 * inclinar 4 graus no `lookAt` e a metade da correcao; a outra metade e o aro
 * de caminhao em `arte/blender/veiculo.py`, e uma sem a outra nao resolve.
 */
const OLHO: [number, number, number] = (() => {
  /*
    O OLHO ANDOU 28 cm PARA A FRENTE e 10 cm para cima.

    A via ocupava uma tira de 17% da altura: o céu levava 44% e o painel,
    que é massa escura sem informação nenhuma, levava 39%. E o jogo inteiro
    da fase — pedestre, ciclista, ônibus, lombada, faixa — acontece naquela
    tira. Era o motivo mais direto de "a estrada tá feia": jogava-se pelo
    buraco da fechadura.

    Como o painel está perto e a via está longe, andar para a frente empurra
    o painel para fora do quadro e quase não mexe na via — a paralaxe faz o
    trabalho, sem tocar em geometria.

    Varridas quatro posições e comparadas lado a lado. Em +0,40 a cabine
    some inteira e perde-se a sensação de estar num caminhão; em +0,16 ainda
    sobra painel demais. Em +0,28 ficam o pilar, o retrovisor e o friso do
    painel, que é o bastante para ancorar, e a via ganha a tela.

    A nota antiga dizia que baixar o olho de 1,21 para 1,17 era para o
    volante continuar visível. Ele continua, pela borda de baixo — e o
    volante nunca foi controle nesta fase, só âncora.
  */
  const base: [number, number, number] = [0.38, 1.27 + ALTURA_CABINE, 0.08]
  // `?olho=y,z` varre o enquadramento sem recompilar. Composição não se
  // resolve por número — se resolve olhando várias de uma vez.
  if (!import.meta.env.DEV) return base
  const v = new URLSearchParams(window.location.search).get('olho')
  if (!v) return base
  const [dy, dz] = v.split(',').map(Number)
  return [base[0], base[1] + (dy || 0), base[2] + (dz || 0)]
})()

/**
 * Quanto o caminhão se afasta para ultrapassar o ciclista, em metros.
 *
 * O ciclista anda em x -1,30, junto à borda. A lateral direita do caminhão
 * fica por volta de x -1,10 — ou seja, o jogo passava a 20 cm dele, que é
 * exatamente o "passou colado" que o relatório já cobrava mas que ninguém
 * via acontecer na tela.
 *
 * Com 1,50 m de desvio a lateral vai para +0,40 e sobra 1,45 m até o guidão
 * (o ciclista tem uns 25 cm de meia-largura) — a folga que o CTB art. 201
 * manda dar. O caminhão fica montado no eixo da via, que é como se ultrapassa
 * bicicleta de verdade.
 */
const DESVIO_CICLISTA = 1.5
/** Onde a manobra começa e onde termina, em metros ANTES e DEPOIS dele. */
const ANTES_CICLISTA = 26
const DEPOIS_CICLISTA = 9

type Pedal = 'acelera' | 'freia' | null

type Situacao = {
  distancia: number
  velocidade: number   // m/s
  trecho: Trecho
  limite: number
  /** Metros até o próximo ponto que exige parada, ou null. */
  ateParada: number | null
  /** 0 verde, 1 amarelo, 2 vermelho. */
  sinal: number
  /** Metros até o cruzamento com semáforo, ou null quando longe. */
  ateSinal: number | null
  /** Metros até a saída de garagem em manobra, ou null. */
  ateGaragem: number | null
  /** Seta ligada, ou null. A manobra acende sozinha — o jogador não dirige. */
  seta: 'esquerda' | 'direita' | null
}

/** Onde cada trecho começa, em metros de trajeto. */
const INICIOS = TRAJETO.reduce<number[]>((a, t) => {
  a.push((a[a.length - 1] ?? 0) + (a.length ? TRAJETO[a.length - 1].metros : 0))
  return a
}, [0])

function trechoEm(metro: number) {
  let i = 0
  while (i + 1 < TRAJETO.length && metro >= INICIOS[i + 1]) i++
  return { indice: i, trecho: TRAJETO[i], inicio: INICIOS[i] }
}

/** Eventos posicionados no trajeto inteiro, já em metros absolutos. */
const EVENTOS = TRAJETO.flatMap((t, i) =>
  (t.eventos ?? []).map((e) => ({ ...e, metro: INICIOS[i] + e.em, trecho: t })),
)

/** Acha o primeiro evento de um tipo. Os tipos daqui aparecem uma vez só. */
function evento<T extends Evento['tipo']>(tipo: T) {
  return EVENTOS.find((e) => e.tipo === tipo) as
    (Extract<Evento, { tipo: T }> & { metro: number }) | undefined
}

/**
 * O traçado da via, um nó por trecho.
 *
 * O valor fica no MEIO do trecho e a interpolação faz a transição — assim a
 * curva já está começando a aparecer no fim do trecho anterior, que é como
 * uma estrada de verdade se anuncia.
 */
/**
 * Eventos que exigem reduzir. Perto deles, andar devagar é o CERTO — então
 * a falta de "muito abaixo do fluxo" não pode valer ali.
 */
const REDUTORES = EVENTOS.filter((e) =>
  ['faixa', 'semaforo', 'garagem', 'onibus', 'ciclista', 'lombada']
    .includes(e.tipo),
)

const TRACADO: NoTracado[] = TRAJETO.map((t, i) => ({
  metro: INICIOS[i] + t.metros / 2,
  curva: t.curva ?? 0,
  colina: t.colina ?? 0,
}))

export default function Fase2Trajeto({
  aoConcluir,
}: {
  aoConcluir: (registros: Registro[], maximo: number) => void
}) {
  // Atalho de desenvolvimento: `?fase=trajeto&m=600` começa já naquele metro.
  // Sem ele, conferir um ajuste no semáforo custa dois minutos de espera.
  const distancia = useRef(
    import.meta.env.DEV
      ? Number(new URLSearchParams(window.location.search).get('m')) || 0
      : 0,
  )
  const velocidade = useRef(0)
  /** O quanto o carro da frente está freando (0 a 1). Acende a lanterna. */
  const freioCarro = useRef(0)
  // o motor vive no useFrame do Mundo; quem o desliga é a saída da fase
  useEffect(() => {
    som.ambiente(true)
    return () => {
      som.motor(null); som.ambiente(false); som.criancas(false)
    }
  }, [])
  const pedal = useRef<Pedal>(null)
  const carro = useRef<number | null>(null)
  const faltas = useRef<Record<string, number>>({})
  // Começando pelo atalho `?m=`, tudo que ficou para trás conta como já
  // resolvido. Sem isto o trajeto termina acusando "não parou na faixa" de
  // uma faixa que o jogador nunca viu, e a próxima pessoa a conferir a fase
  // perde meia hora atrás de um defeito que não existe.
  const pedestreLiberado = useRef(distancia.current > (evento('faixa')?.metro ?? 0))
  // 0 = verde, 1 = amarelo, 2 = vermelho. Mundo lê para acender a lâmpada.
  const sinal = useRef(0)
  // 'dormindo' → 'tocando' → o jogador decide. A resposta volta pelo painel.
  // o carro da garagem já saiu quando o jogador cedeu — ou quando o atalho
  // `?m=` largou a fase depois dela
  // o ônibus já arrancou? também vale para o atalho `?m=`, que resolve o que
  // ficou para trás
  const onibusLiberado = useRef(
    distancia.current > (evento('onibus')?.metro ?? Infinity),
  )
  // Onde o ônibus escolar está AGORA. Quem escreve é `<OnibusEscolar>`, que é
  // quem integra a arrancada; quem lê é o Motor, para não atravessá-lo.
  const onibusOnde = useRef<number | null>(null)
  const garagemLiberada = useRef(
    distancia.current > (evento('garagem')?.metro ?? Infinity),
  )
  const celular = useRef<'dormindo' | 'tocando' | 'atendeu' | 'ignorou'>(
    distancia.current > (evento('celular')?.metro ?? 0) ? 'ignorou' : 'dormindo',
  )
  // O painel NÃO passa pelo estado do React. Subir a velocidade para o estado
  // a 10 Hz re-renderizava a árvore inteira dez vezes por segundo, o que
  // remontava nós da cena 3D e derrubava o jogo para 1 quadro por segundo.
  // Aqui o laço de quadro escreve direto no DOM do painel.
  const painel = useRef<PainelAPI>(null)
  /** Deslocamento lateral do caminhão (ultrapassagem). O `Motor` escreve. */
  const lateral = useRef(0)
  /*
    QUANTO SE ESTÁ ACIMA DO LIMITE, de 0 a 1, para a cabine tremer.

    Das dez condutas que a fase avalia, cinco não produziam NADA na tela —
    somavam num `ref` e o mundo seguia impassível. Dava para rodar vinte
    segundos a 55 num trecho de 30 e a única coisa que mudava era a cor de um
    número no canto.

    Isto não é veredito e não diz que o jogador errou: é o caminhão passando
    do ponto. Quem desce a velocidade sente parar sozinho. A conta continua
    aparecendo só no relatório, que é a regra que o cliente comprou.
  */
  const excesso = useRef(0)
  /**
   * O SOLAVANCO da lombada: 1 no impacto, cai sozinho.
   *
   * Passar rápido na lombada era a terceira conduta que somava num `ref` e
   * não produzia nada na tela. O texto do relatório já dizia que passar
   * rápido "arremessa a carga da caçamba, castiga a suspensão e tira o
   * controle" — e nada disso acontecia.
   */
  const solavanco = useRef(0)
  const seta = useRef<'esquerda' | 'direita' | null>(null)
  const [acabou, setAcabou] = useState(false)
  /** Legenda da fala do personagem. Estado, porque é texto na tela. */
  const [legenda, setLegenda] = useState<string | null>(null)
  /* selo de erro quando o jogador ATENDE o telefone dirigindo */
  const [selo, setSelo] = useState<Selo>(null)
  /** O celular está à vista no painel (toca) ou guardado. */
  const [foneAVista, setFoneAVista] = useState(false)
  /** Chegou ao local: a tela esmaece antes de entregar a fase. */
  const [chegando, setChegando] = useState(false)
  useEffect(() => {
    if (!chegando) return
    const id = window.setTimeout(terminar, 1500)
    return () => window.clearTimeout(id)
  }, [chegando])

  const marcos = useMemo<Marco[]>(() => {
    const base = paisagem(DISTANCIA_TOTAL)
    for (const e of EVENTOS) {
      if (e.tipo === 'placa') base.push({ peca: 'placa', metro: e.metro, x: -2.9 })
      if (e.tipo === 'lombada') base.push({ peca: 'lombada', metro: e.metro, x: 0 })
      if (e.tipo === 'faixa') base.push({ peca: 'faixa_pedestre', metro: e.metro, x: 0 })
      // o semáforo fica na borda do lado do motorista, recuado do cruzamento
      if (e.tipo === 'semaforo') {
        base.push({ peca: 'semaforo', metro: e.metro, x: -3.1 })
        // a VIA QUE CRUZA: sem ela o semáforo é um poste numa reta. Vai no
        // eixo da pista, que é onde o cruzamento de verdade fica.
        base.push({ peca: 'cruzamento', metro: e.metro, x: 1.75 })
      }
      // O ÔNIBUS ESCOLAR NÃO ENTRA AQUI.
      //
      // Entrava, e virava um segundo ônibus exatamente em cima do primeiro:
      // `<OnibusEscolar>` já desenha um, no mesmo metro e no mesmo x -1,0. Os
      // dois coincidiam, então não dava para ver que eram dois — até o
      // verdadeiro arrancar com as crianças e a cópia PARADA ficar na faixa
      // para sempre, para o jogador atravessar.
      // O CICLISTA NÃO ENTRA AQUI.
      //
      // Mesma razão do ônibus escolar: ele tem componente próprio em
      // `Via.tsx` porque REAGE a quem passa colado, e cópia de fileira é
      // estática. Deixá-lo nos dois lugares desenharia dois ciclistas no
      // mesmo metro — um reagindo e outro impassível ao lado.
    }
    // O poste do DESTINO, na direita e bem na beira: é nele que o caminhão
    // encosta, e é ele que diz "é aqui" sem precisar de texto.
    base.push({ peca: 'poste', metro: DISTANCIA_TOTAL + 4, x: BORDA_DIR - 0.9 })
    base.push({ peca: 'cabos', metro: DISTANCIA_TOTAL + 4, x: BORDA_DIR - 0.9 })
    /*
      NADA DE CENÁRIO DENTRO DO CRUZAMENTO.

      A paisagem põe um poste a cada 40 m, em `m + 6`, sem saber que existe
      cruzamento. Quando a conta bate, o poste nasce NO MEIO DA PISTA
      transversal — foi o "tem um poste no meio do cruzamento". Casa, muro e
      arbusto caíam lá pelo mesmo motivo: ninguém constrói na esquina
      porque a esquina é via.

      ±11 m do eixo do cruzamento, que é a meia-largura da transversal mais
      o recuo do meio-fio.
    */
    const cruzamentos = EVENTOS
      .filter((e) => e.tipo === 'semaforo')
      .map((e) => e.metro)
    const naEsquina = (m: number) =>
      cruzamentos.some((c) => Math.abs(m - c) < 11)
    const filtrado = base.filter(
      (mk) => mk.peca === 'cruzamento' || mk.peca === 'semaforo'
        || !naEsquina(mk.metro),
    )
    return filtrado
  }, [])

  // teclado além dos botões: quem está num computador espera a seta
  useEffect(() => {
    const desce = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w') pedal.current = 'acelera'
      if (e.key === 'ArrowDown' || e.key === 's') pedal.current = 'freia'
    }
    const sobe = (e: KeyboardEvent) => {
      if (['ArrowUp', 'w', 'ArrowDown', 's'].includes(e.key)) pedal.current = null
    }
    window.addEventListener('keydown', desce)
    window.addEventListener('keyup', sobe)
    return () => {
      window.removeEventListener('keydown', desce)
      window.removeEventListener('keyup', sobe)
    }
  }, [])

  const terminar = useCallback(() => {
    if (acabou) return
    setAcabou(true)
    aoConcluir(montarRegistros(faltas.current), MAXIMO_TRAJETO)
  }, [acabou, aoConcluir])

  return (
    <div className="trajeto">
      <div className="trajeto-palco">
        {/*
          `dpr={1}` travado, e não `[1, 1.5]`. Medido: 88% do quadro desta
          fase é custo POR PIXEL, então numa tela HiDPI o 1,5 multiplica os
          pixels por 2,25 e triplica o custo. Nesta máquina o valor resolvia
          para 1 e não aparecia em medida nenhuma — no mini-PC do totem é a
          diferença entre rodar e não rodar.
        */}
        <Canvas dpr={1} shadows camera={{ position: OLHO, fov: 52 }}>
          {/*
            O CÉU É A HDRI, NÃO O `<Sky>`.

            O `<Sky>` (Preetham, via drei) estava aqui e saía um branco chapado
            de horizonte a horizonte. Não é escolha de parâmetro: medindo a
            saída do shader num alvo float, o horizonte dele vem em 1,9 a 2,4
            de luminância LINEAR, contra 0,55 da névoa — dois pontos acima, e
            nada abaixo de uns 40° de elevação sobrevive ao AgX do
            `Acabamento`. O azul existe só no zênite, que a câmera da cabine
            (fov 52, 4° para baixo) nunca mostra. E o shader do three termina
            com um `pow(cor, 1/2.4)` sem nenhuma exposição para compensar —
            não há botão para abaixar.

            A HDRI já estava carregada aqui para iluminar. Usá-la também de
            fundo tem céu de verdade com nuvem, custa um `background` a mais e
            TIRA um desenho da tela (a caixa de 1000 unidades do `<Sky>`).

            E a emenda some de graça: medido, o horizonte da HDRI é linear
            (0,52, 0,56, 0,66) e a névoa abaixo é (0,48, 0,56, 0,66). A cor da
            névoa já tinha saído daqui.
          */}
          {/* névoa: sem ela a via some num corte seco no fim do alcance e a
              profundidade da paisagem não lê */}
          <fog attach="fog" args={['#b8c6d4', 90, 290]} />
          <Environment files="./hdri/ceu.hdr" environmentIntensity={0.35} background />
          <LuzCabine />
          <directionalLight
            position={[-24, 30, 40]}
            intensity={2.2}
            castShadow
            shadow-mapSize={[4096, 4096]}
            /* Tem de cobrir até onde a névoa ainda deixa ver (≈290 m). Com o
               alcance antigo de 120 m aparecia uma linha reta atravessando a
               pista: dali para a frente nada recebia sombra, e a emenda lia
               como um risco no asfalto. */
            shadow-camera-near={1}
            shadow-camera-far={320}
            shadow-camera-left={-70}
            shadow-camera-right={70}
            shadow-camera-top={70}
            shadow-camera-bottom={-24}
            shadow-bias={-0.0006}
            shadow-normalBias={0.03}
          />
          <group position={[0, ALTURA_CABINE, 0]}>
            <Cabine ligados={['cinto_afivelado', 'retro_ok', 'apoio_alto',
                              foneAVista ? 'celular' : 'celular_guardado',
                              'checklist_feito']} />
          </group>
          <Mundo
            distancia={distancia}
            marcos={marcos}
            carro={carro}
            freioCarro={freioCarro}
            tracado={TRACADO}
            sinal={sinal}
            faixa={evento('faixa')?.metro ?? null}
            pedestreLiberado={pedestreLiberado}
            onibus={evento('onibus')?.metro ?? null}
            onibusLiberado={onibusLiberado}
            onibusOnde={onibusOnde}
            garagem={{
              metro: evento('garagem')?.metro ?? null,
              liberada: garagemLiberada,
            }}
            lateral={lateral}
            ciclista={evento('ciclista')?.metro ?? null}
            cruzamento={evento('semaforo')?.metro ?? null}
          />
          <Motor
            distancia={distancia}
            velocidade={velocidade}
            pedal={pedal}
            carro={carro}
            freioCarro={freioCarro}
            faltas={faltas}
            pedestreLiberado={pedestreLiberado}
            onibusLiberado={onibusLiberado}
            onibusOnde={onibusOnde}
            garagemLiberada={garagemLiberada}
            sinal={sinal}
            celular={celular}
            painel={painel}
            lateral={lateral}
            seta={seta}
            excesso={excesso}
            solavanco={solavanco}
            aoChegar={() => setChegando(true)}
            mostrarFone={setFoneAVista}
            dizer={setLegenda}
            marcarErro={() => setSelo('erro')}
          />
          <MarcaDoServico distancia={distancia} />
          <CameraFixa distancia={distancia} celular={celular} excesso={excesso}
                      solavanco={solavanco} />
          {/*
            `leve` desliga o MSAA 4x (redundante: o SMAA já está na cadeia e
            faz o antisserrilhado) e roda a oclusão em meia resolução. O modo
            existia desde sempre no `Acabamento` e o trajeto — a única fase
            que precisava dele — nunca o usou: seis passes de oclusão em
            resolução cheia custavam 6,5 dos 31 ms do quadro.
          */}
          <Acabamento raio={2.0} qualidade="leve" />
        <PalcoPronto />
        </Canvas>
      </div>

      <Painel ref={painel} pedal={pedal} celular={celular} />
      {chegando && <div className="trajeto-chegada" aria-hidden />}
      <SeloVeredito tipo={selo} aoFim={() => setSelo(null)} />
      {legenda && (
        <p className="trajeto-legenda" role="status">{legenda}</p>
      )}
    </div>
  )
}

/**
 * Mantém a câmera no olho do motorista, com uma balançada leve.
 *
 * A inclinação na curva é pequena de propósito (no máximo 1,7°): a dobra
 * acontece no cenário, e exagerar aqui briga com o que os olhos veem e enjoa.
 */
/**
 * Onde o celular fica no painel, em coordenada de jogo.
 *
 * Sai da caixa envolvente do nó `celular` do `cabine.glb` — Blender
 * (−0,10, −0,455, 0,910) vira jogo (x, z, −y) e sobe `ALTURA_CABINE`.
 */
const ONDE_CELULAR: [number, number, number] = [-0.10, 0.91 + ALTURA_CABINE, 0.455]

/**
 * O marcador do serviço, na pista, aparecendo na aproximação.
 *
 * O cliente pediu "um ícone, como se fosse uma missão do GTA" para a chegada
 * ao local do reparo. Ele existia — mas só dentro da fase 3, onde o jogador
 * JÁ CHEGOU. Chegar ao lugar sem nada marcando o lugar é o que fazia a
 * chegada parecer que o jogo tinha simplesmente acabado a estrada.
 *
 * Aparece a 110 m, que é onde um motorista enxergaria o poste da ordem.
 *
 * Em `BORDA_DIR − 1,9`, e não `+ 0,9`: medido na cena, com `+0,9` o cilindro
 * nascia em x −0,85, que é DENTRO do asfalto (ele vai de −1,75 a 5,25) — um
 * marcador plantado na pista. Agora fica no canteiro, e os 1,9 m também
 * garantem que a câmera não entre dentro do cilindro quando o caminhão
 * encosta: no fim da manobra sobram 2,40 m entre os dois, contra 1,9 de raio.
 */
function MarcaDoServico({ distancia }: { distancia: React.RefObject<number> }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    const no = g.current
    if (!no) return
    const z = DISTANCIA_TOTAL - (distancia.current ?? 0)
    no.position.z = z
    no.visible = z < 110 && z > -14
  })
  return (
    <group ref={g} position={[BORDA_DIR - 1.9, 0, 0]} visible={false}>
      <MarcadorDoServico em={[0, 1.5, 0]} raio={1.7} />
    </group>
  )
}

function CameraFixa({
  distancia, celular, excesso, solavanco,
}: {
  distancia: React.RefObject<number>
  celular: CelularRef
  /** 0 dentro do limite, 1 a 25 km/h acima. Faz a cabine tremer. */
  excesso: React.RefObject<number>
  /** 1 no impacto da lombada. A câmera salta e volta. */
  solavanco: React.RefObject<number>
}) {
  const { current: base } = useRef(new THREE.Vector3(...OLHO))
  const inclinacao = useRef(0)
  /** 0 olhando a via, 1 olhando o celular. */
  const desvio = useRef(0)
  const mira = useRef(new THREE.Vector3())
  const naVia = useRef(new THREE.Vector3())
  const noFone = useRef(new THREE.Vector3(...ONDE_CELULAR))

  useFrame(({ camera, clock }, dt) => {
    const t = clock.elapsedTime
    /*
      O TREMOR DE QUEM ESTÁ RÁPIDO DEMAIS.

      Três senos de frequência não múltipla (18, 14,5 e 11,3 Hz), para não
      virar uma vibração periódica que o olho decora em dois segundos.

      E ABAIXO DE NYQUIST, de propósito: o jogo desenha a 57 fps, então um
      seno de 31 Hz — que foi o primeiro valor que escrevi — não cabe no
      quadro e volta como bamboleio lento por aliasing, que é o oposto de
      vibração. A 18 Hz sobram três amostras por ciclo e o tremor lê como
      tremor. Medido: desvio da câmera de 1,9 mm dentro do limite (a
      respiração que já existia) contra 6,7 mm bem acima.

      A amplitude
      é QUADRÁTICA no excesso: nos primeiros km/h acima da tolerância quase
      não se nota, e a partir de uns 15 km/h fica desconfortável — que é a
      curva certa, porque 5 acima do limite não é a mesma coisa que 25.

      Máximo de 9 mm. Mais do que isso embaralha a leitura da via, e a via é
      onde o jogo acontece.
    */
    const e = excesso.current ?? 0
    const treme = e * e * 0.009
    /*
      O SALTO DA LOMBADA. Decai em 0,55 s, que é o tempo de a suspensão de
      um caminhão carregado parar de oscilar — rápido demais e lê como
      falha de quadro, devagar demais e lê como barco.

      O seno de 9 Hz dá o repique: sobe, desce abaixo do ponto de partida e
      volta. Uma batida só, sem oscilação, parece a câmera tendo um soluço.
    */
    if ((solavanco.current ?? 0) > 0) {
      solavanco.current = Math.max(0, solavanco.current - dt / 0.55)
    }
    const b = solavanco.current ?? 0
    const salto = Math.sin(b * Math.PI * 3) * b * 0.13
    if (import.meta.env.DEV) {
      // a câmera, para medir o tremor sem o mundo rolando por cima
      ;(window as unknown as Record<string, unknown>).__olho = camera
    }
    camera.position.set(
      base.x + Math.sin(t * 2.1) * 0.004 + Math.sin(t * 18.0) * treme,
      base.y + Math.sin(t * 3.3) * 0.005 + Math.sin(t * 14.5) * treme + salto,
      base.z + Math.sin(t * 11.3) * treme * 0.6,
    )
    // A cabeça vira para o celular quando ele toca, e volta sozinha. Ela vira
    // DEVAGAR (1,6 s de ida) de propósito: é o tempo que o olhar fica fora da
    // via, e é isso que a fase está ensinando a não fazer. Instantâneo não
    // custa nada, e o que não custa nada não ensina.
    // 0,55 e não 1: virar a cabeça INTEIRA para o painel tira a via do
    // quadro e vira cena de cinema. O motorista que atende dá uma OLHADA —
    // e é a olhada, com a via ainda meio à vista, que mostra o risco. Virar
    // tudo esconde justamente o que está em jogo.
    const alvoDesvio = celular.current === 'tocando' ? 0.55 : 0
    desvio.current += (alvoDesvio - desvio.current) * Math.min(1, dt * 1.6)
    naVia.current.set(base.x + 0.02, base.y - 0.42, base.z + 6)
    mira.current.copy(naVia.current).lerp(noFone.current, desvio.current)
    camera.lookAt(mira.current)
    const alvo = -perfilEm(TRACADO, distancia.current ?? 0).curva * 0.03
    inclinacao.current += (alvo - inclinacao.current) * Math.min(1, dt * 2.5)
    camera.rotateZ(inclinacao.current)
  })
  return null
}

function Motor({
  distancia, velocidade, pedal, carro, faltas, pedestreLiberado, onibusLiberado,
  onibusOnde, garagemLiberada, sinal, celular, painel, lateral, seta, excesso,
  solavanco, aoChegar, mostrarFone, dizer, marcarErro, freioCarro,
}: {
  distancia: React.RefObject<number>
  velocidade: React.RefObject<number>
  pedal: React.RefObject<Pedal>
  carro: React.RefObject<number | null>
  faltas: React.RefObject<Record<string, number>>
  pedestreLiberado: React.RefObject<boolean>
  onibusLiberado: React.RefObject<boolean>
  onibusOnde: React.RefObject<number | null>
  garagemLiberada: React.RefObject<boolean>
  sinal: React.RefObject<number>
  celular: React.RefObject<'dormindo' | 'tocando' | 'atendeu' | 'ignorou'>
  painel: React.RefObject<PainelAPI | null>
  lateral: React.RefObject<number>
  seta: React.RefObject<'esquerda' | 'direita' | null>
  excesso: React.RefObject<number>
  solavanco: React.RefObject<number>
  aoChegar: () => void
  mostrarFone: (v: boolean) => void
  dizer: (texto: string | null) => void
  /** Acende o selo vermelho por cima da tela. */
  marcarErro: () => void
  /** Saída: o quanto o carro da frente alivia agora. */
  freioCarro: React.RefObject<number>
}) {
  /*
    Relógio e velocidade anterior do carro da frente. Locais: só este laço
    os usa, e o componente de cima não tem o que fazer com eles.
  */
  const relogioCarro = useRef(0)
  const velCarroAnt = useRef(0)
  const desdeAtualizacao = useRef(0)
  const paradoDesde = useRef(0)
  const amareloDesde = useRef<number | null>(null)
  const paradoNoSinal = useRef(0)
  const esperouGaragem = useRef(0)
  const buzinou = useRef(false)
  const esperouOnibus = useRef(0)
  const chegou = useRef(false)
  const guinchou = useRef(false)
  // mesmo motivo do pedestreLiberado: o que ficou para trás já está resolvido
  const passouNoSinal = useRef(
    (distancia.current ?? 0) > (evento('semaforo')?.metro ?? 0),
  )
  const julgados = useRef<Record<string, boolean>>(
    Object.fromEntries(
      (['onibus', 'ciclista', 'celular'] as const)
        .filter((t) => (distancia.current ?? 0) > (evento(t)?.metro ?? 0))
        .map((t) => [t, true]),
    ),
  )

  useFrame((_, bruto) => {
    // o dt é limitado: numa aba em segundo plano ele chega em segundos e o
    // veículo atravessaria o trajeto inteiro num quadro
    const dt = Math.min(bruto, TETO_DT)
    if (distancia.current >= DISTANCIA_TOTAL) return

    let v = velocidade.current
    const p = pedal.current
    if (p === 'acelera') v += VEICULO.aceleracao * dt
    else if (p === 'freia') v -= VEICULO.freio * dt
    else v -= VEICULO.arrasto * dt
    v = Math.max(0, Math.min(VEICULO.maxima, v))

    const d = distancia.current
    const { trecho } = trechoEm(d)
    const kmh = v * 3.6

    // Veículo à frente. Ele nasce SEMPRE a ~70 m do jogador, não numa
    // posição fixa do trajeto: com posição fixa e velocidade constante, quem
    // anda rápido nunca o alcança e quem anda devagar o perde de vista — e o
    // exercício de distância de seguimento simplesmente não acontece.
    const evCarro = EVENTOS.find((e) => e.tipo === 'carro')
    if (evCarro && d > evCarro.metro - 70) {
      if (carro.current == null) carro.current = d + 70
      /*
        ELE NÃO ANDA MAIS EM VELOCIDADE CONSTANTE.

        Andava, e é justamente este o veículo que o jogador encara durante
        todo o trecho de distância de seguimento — o mais parado de todos os
        comportamentos estava no carro que mais se olha. Com velocidade
        fixa, manter distância é uma conta feita uma vez; com velocidade que
        varia, é o que manter distância é de verdade.

        Dois senos incomensuráveis (7,3 s e 3,1 s), como a respiração do
        personagem: o olho não acha o compasso e não sente o truque.
      */
      relogioCarro.current += dt
      const tc = relogioCarro.current
      const base = (evCarro as { velocidade: number }).velocidade / 3.6
      const alvo = base * (1 + Math.sin(tc / 7.3) * 0.20 + Math.sin(tc / 3.1) * 0.10)
      // o quanto ele está ALIVIANDO agora, de 0 a 1 — é o que acende a
      // lanterna de freio lá no `Mundo`
      const aceleracao = (alvo - (velCarroAnt.current || alvo)) / Math.max(dt, 1e-4)
      velCarroAnt.current = alvo
      freioCarro.current = Math.max(0, Math.min(1, -aceleracao / 1.2))
      carro.current += alvo * dt
      /*
        ELE NAO FOGE.

        `carro.current` avanca todo quadro desde que entra em cena, com
        velocidade propria e sem olhar para tras. Quem dirige devagar o
        perde: medido num teste, 634 m de vao — e com o carro a 600 m o
        exercicio de distancia de seguimento simplesmente deixa de existir,
        que e o oposto do que este trecho cobra.

        O teto e 95 m, que e onde ele ainda se ve na nevoa. Carro da frente
        de verdade nao esta correndo de ninguem: anda no proprio ritmo e,
        se o de tras some, quem fica para tras e so o de tras.
      */
      // O CARRO DA FRENTE NAO PASSA DE 70 m, que e onde ele comeca.
      //
      // Era 95, e com 95 ele vivia grudado no teto: andando mais rapido que
      // o jogador, batia no limite e ficava la. A 95 m a lanterna de freio
      // dele tem dois pixels — a decisao da fase e "o carro da frente
      // freou, afaste-se", e ela nao cabe em dois pixels.
      carro.current = Math.min(carro.current, d + 70)
      const vao = carro.current - d
      const seguro = Math.max(8, v * CONDUTA.segundosDeSeguimento)
      if (vao < seguro) contar(faltas, 'seguimento', dt)
      // Não atravessa o carro da frente.
      //
      // 7,5 m e não 6: o carro tem 4,48 m e está centrado no próprio metro,
      // então a traseira fica a `vao - 2,24`; o bico do caminhão está em
      // z +2,40 (caixa envolvente da cabine, medida). Com vão 6 sobravam
      // 1,36 m entre os dois — cabia, mas por pouco, e qualquer quadro longo
      // (o dt é limitado em 0,05 s, que a 60 km/h são 0,83 m) comia metade
      // disso. Com 7,5 sobram 2,86 m.
      if (vao < 7.5) v = Math.min(v, alvo * 0.9)
    }

    // Semáforo. O amarelo abre a uma distância fixa do cruzamento, não num
    // relógio solto: assim todo jogador encara a MESMA decisão, que é o que
    // torna a nota comparável entre colaboradores. Quem vem devagar chega
    // depois e pega o vermelho; quem vem rápido pega o amarelo e tem de
    // decidir. É a zona de dilema de verdade.
    const evSinal = evento('semaforo')
    let ateSinal: number | null = null
    if (evSinal) {
      const falta = evSinal.metro - d
      if (falta > -6 && falta < 140) ateSinal = Math.max(0, falta)

      // TUDO do semáforo mora dentro deste `if`. A primeira versão deixava o
      // cronômetro do amarelo rodando solto por fora: ele reescrevia
      // `sinal = vermelho` todo quadro, DEPOIS da liberação — e quem parava
      // no vermelho, que é a conduta certa, ficava preso no cruzamento para
      // sempre. O jogo travava exatamente em quem acertava.
      if (!passouNoSinal.current) {
        if (falta <= CONDUTA.amareloEm && amareloDesde.current == null) {
          amareloDesde.current = 0
        }
        if (amareloDesde.current != null) {
          amareloDesde.current += dt
          sinal.current = amareloDesde.current > CONDUTA.amareloSegundos ? 2 : 1
        }

        if (falta <= 0) {
          // cruzou a linha: julga uma vez só
          passouNoSinal.current = true
          if (sinal.current === 2 && kmh >= CONDUTA.paradoKmh) {
            contar(faltas, 'semaforo', 1)
          }
        } else if (sinal.current === 2 && kmh < CONDUTA.paradoKmh) {
          // parou no vermelho: o sinal abre e ele segue
          paradoNoSinal.current += dt
          if (paradoNoSinal.current > 2.5) {
            sinal.current = 0
            passouNoSinal.current = true
          }
        }
      }
    }

    // Ônibus escolar em embarque e ciclista na pista: os dois são a mesma
    // regra — passar por ali é passar devagar. A falta é julgada no metro em
    // que o veículo os ultrapassa, não por tempo.
    for (const [tipo, chave, teto] of [
      ['onibus', 'onibus', CONDUTA.onibusKmh],
      ['ciclista', 'ciclista', CONDUTA.ciclistaKmh],
    ] as const) {
      const ev = evento(tipo)
      if (!ev || julgados.current[chave]) continue
      if (d >= ev.metro) {
        julgados.current[chave] = true
        if (kmh > teto) contar(faltas, chave, 1)
      }
    }

    /*
      A ULTRAPASSAGEM DO CICLISTA É UMA MANOBRA, e não uma linha no relatório.

      Antes o jogo cobrava "passou colado" num texto que só aparecia depois
      da fase terminar — e na tela o ciclista passava raspando a lataria sem
      que nada acontecesse. Agora o caminhão SAI da faixa, dá a seta, passa
      com folga e volta.

      Quem comanda é a velocidade: só sai da faixa quem já está em
      velocidade de ultrapassar. Passar a 60 sem desviar continua sendo o
      erro, e agora ele se vê acontecendo em vez de ser lido no fim.

      A seta acende sozinha porque o jogador não dirige — ele só controla o
      pedal. Mostrá-la é o que ensina que a manobra tem um aviso, mesmo sem
      ter um volante para girar.
    */
    /*
      QUEM MANDA NO `lateral` NA CHEGADA É A CHEGADA.

      Esta linha roda todo quadro e puxa `lateral` para `desviar` (0 fora do
      trecho do ciclista). O encosto no meio-fio escreve no mesmo ref 200
      linhas abaixo — e as duas puxavam para lados opostos a cada quadro, de
      modo que o caminhão nunca chegava perto da calçada. Cabo de guerra não
      aparece no código de nenhum dos dois lados; só medindo na tela.
    */
    const encostando = DISTANCIA_TOTAL - d < CHEGADA_M
    const evCiclista = encostando ? null : evento('ciclista')
    let desviar = 0
    if (evCiclista) {
      const falta = evCiclista.metro - d
      if (falta < ANTES_CICLISTA && falta > -DEPOIS_CICLISTA
          && kmh <= CONDUTA.ciclistaKmh) desviar = DESVIO_CICLISTA
    }
    // 1,1 e não um salto: a 30 km/h a manobra leva uns dois segundos, que é
    // o tempo de um caminhão mudar de faixa sem jogar a carga para o lado.
    if (!encostando) {
      lateral.current += (desviar - lateral.current) * Math.min(1, dt * 1.1)
    }
    seta.current = desviar > 0 && lateral.current < desviar - 0.05 ? 'esquerda'
      : desviar === 0 && lateral.current > 0.08 ? 'direita'
      : null

    // Veículo saindo da garagem. Vale nota, então tudo aqui é função do
    // METRO do jogador, nunca do relógio — dois colaboradores têm de
    // encontrar a mesma cena no mesmo ponto.
    const evGaragem = evento('garagem')
    let ateGaragem: number | null = null
    if (evGaragem && !garagemLiberada.current) {
      const falta = evGaragem.metro - d
      if (falta > -8 && falta < 70) ateGaragem = Math.max(0, falta)
      // a buzina do carro que manobra avisa antes de o aviso aparecer na tela;
      // dispara pelo METRO, como o resto do evento, e uma vez só
      if (falta < 70 && !buzinou.current) { buzinou.current = true; som.buzina() }
      // reduziu e segurou: ele termina de sair e a via libera
      if (ateGaragem != null && kmh <= CONDUTA.garagemKmh) {
        esperouGaragem.current += dt
        if (esperouGaragem.current > 1.4) garagemLiberada.current = true
      }
      // passou por cima da manobra sem reduzir
      if (falta <= 0 && !garagemLiberada.current) {
        contar(faltas, 'garagem', 1)
        garagemLiberada.current = true
      }
    }

    // O celular toca e fica tocando até o jogador decidir. Não há falta por
    // demorar: a falta é atender.
    const evCel = evento('celular')
    if (evCel && celular.current === 'dormindo' && d >= evCel.metro) {
      celular.current = 'tocando'
      painel.current?.celular(true)
      mostrarFone(true)
      som.telefone()
    }
    if (celular.current === 'atendeu' && !julgados.current.celular) {
      julgados.current.celular = true
      contar(faltas, 'celular', 1)
      mostrarFone(false)
      /*
        ATENDER TEM DE DOER NA HORA.
        A falta era contabilizada em silêncio e só reaparecia no relatório,
        oito minutos depois — o cliente atendeu de propósito para ver o que
        acontecia e não viu nada. Quem recusa ouve o personagem dizer por
        quê; quem atende não ouvia nada, que é o avesso do que a fase ensina.
      */
      marcarErro()
      dizer('Atendeu dirigindo. É infração grave — e tirou os olhos da pista.')
      window.setTimeout(() => dizer(null), 3600)
    }
    // Recusou: o personagem fala. A legenda carrega o sentido e a voz carrega
    // só a intenção — é de propósito que não dê para entender a palavra.
    if (celular.current === 'ignorou' && !julgados.current.recusou) {
      julgados.current.recusou = true
      mostrarFone(false)
      const dura = som.fala(7) ?? 1.6
      dizer('Não devo atender dirigindo.')
      window.setTimeout(() => dizer(null), (dura + 1.4) * 1000)
    }

    /** Até onde o veículo pode ir neste quadro. Null = sem obstáculo. */
    let teto: number | null = null

    // ÔNIBUS ESCOLAR EM EMBARQUE — é obstáculo, não aviso.
    //
    // Ele ocupa a faixa (2,42 m em x -1,0 contra a caçamba de -0,7 a 1,5) e
    // não há volante para desviar: a única saída é esperar. Antes disso ele
    // era cenário e dava para atravessá-lo, o que ensina o contrário do que
    // a fase avalia.
    //
    // Reduzir e esperar libera: as crianças terminam de entrar e ele arranca.
    // Mesma regra do pedestre e da garagem — quem fez o certo não fica preso.
    const evOnibus = evento('onibus')
    if (evOnibus) {
      if (!onibusLiberado.current) {
        const falta = evOnibus.metro - d
        if (falta < 55 && kmh <= CONDUTA.onibusKmh) {
          esperouOnibus.current += dt
          if (esperouOnibus.current > 4.5) onibusLiberado.current = true
        }
      }
      // COLISÃO. O teto é aplicado lá embaixo, junto com a escrita da
      // distância: clampar aqui não adianta porque a linha
      // `distancia.current = d + v * dt` roda DEPOIS e sobrescreve com o `d`
      // antigo. Custou uma rodada de medição descobrir isso.
      //
      // E ele segue o ônibus, não o metro do evento. Antes a trava sumia no
      // instante da liberação, e o ônibus arranca a 9 m/s contra os até 16,7
      // do caminhão: quem pisava fundo na saída alcançava e ATRAVESSAVA o
      // ônibus com as crianças ainda em quadro. Agora o teto anda com ele e
      // some sozinho quando ele se afasta.
      const onde = onibusOnde.current ?? evOnibus.metro
      const trava = onde - PARAR_ATRAS_DO_ONIBUS
      if (trava - d < 60) teto = trava
    }

    // parada obrigatória na faixa
    const evFaixa = EVENTOS.find((e) => e.tipo === 'faixa')
    let ateParada: number | null = null
    if (evFaixa && !pedestreLiberado.current) {
      const falta = evFaixa.metro - d
      if (falta > -4 && falta < 80) ateParada = Math.max(0, falta)
      // Basta estar PARADO com o aviso na tela — não é preciso chegar perto.
      // Exigir os últimos metros travava quem freava cedo: o aviso não sai
      // enquanto o pedestre não atravessa, e o pedestre não atravessa
      // enquanto o veículo não chega perto. Quem parou cedo parou: a lição
      // de dar preferência já aconteceu.
      if (ateParada != null && kmh < CONDUTA.paradoKmh) {
        paradoDesde.current += dt
        if (paradoDesde.current > 1.6) pedestreLiberado.current = true
      }
      if (falta <= 0 && !pedestreLiberado.current && kmh >= CONDUTA.paradoKmh) {
        contar(faltas, 'pedestre', 1)
        pedestreLiberado.current = true   // marca uma vez só
      }
    }

    // lombada
    const evLombada = EVENTOS.find((e) => e.tipo === 'lombada')
    if (evLombada) {
      const antes = evLombada.metro - d
      const depois = evLombada.metro - (d + v * dt)
      if (antes > 0 && depois <= 0) {
        // 0 no limite, 1 a 55 km/h. A batida existe mesmo dentro do limite,
        // só que pequena: lombada é lombada.
        // 0,10 no piso e 1 a partir de 50 km/h. O piso existe porque lombada
        // é lombada: mesmo no limite o caminhão balança um pouco. O teto em
        // 30 acima do limite, e não 35, para a diferença entre passar certo
        // e passar errado ser grande — era de 13 para 22 mm e não bastava.
        const forte = Math.min(1, Math.max(0.10,
          (kmh - CONDUTA.lombadaKmh) / 30))
        solavanco.current = forte
        som.solavanco(forte)
        if (kmh > CONDUTA.lombadaKmh) contar(faltas, 'lombada', 1)
      }
    }

    // velocidade compatível
    if (kmh > trecho.limite + CONDUTA.toleranciaKmh) contar(faltas, 'excesso', dt)
    // satura 25 km/h acima da tolerância: passado disso não adianta tremer mais
    excesso.current = Math.min(
      1, Math.max(0, (kmh - trecho.limite - CONDUTA.toleranciaKmh) / 25),
    )
    // Andar devagar só conta quando o jogador NÃO está acelerando: sair de
    // uma parada obrigatória passa necessariamente por velocidade baixa, e
    // punir a retomada ensinaria a coisa errada.
    // "Muito abaixo do fluxo" não vale perto de NENHUM evento que peça
    // redução — e todos os seis pedem.
    //
    // Isto já tinha sido corrigido uma vez só para a faixa e o semáforo, e
    // continuava errado nos outros quatro: reduzir para o ônibus escolar em
    // embarque custava falta de lentidão, porque 14 km/h é menos que metade
    // dos 30 do trecho escolar. Mesma coisa na lombada e no ciclista. O jogo
    // cobrava a redução num item e punia a mesma redução no outro — jogando
    // uma partida inteira é que isso aparece.
    const perto = REDUTORES.some(
      (e) => d > e.metro - 70 && d < e.metro + 25,
    )
    if (!perto && p !== 'acelera' && d > 40
        && kmh < trecho.limite * CONDUTA.fracaoMinima) {
      contar(faltas, 'lento', dt)
    }

    /*
      CHEGADA: ELE ENCOSTA NA CALÇADA E PARA. ANTES RASTEJAVA.

      A rampa era `max(1,5; restante/4)` — decaimento exponencial com piso.
      Com piso de 1,5 m/s o caminhão NUNCA para por conta dela: ele entra
      nos últimos metros andando a 5,4 km/h e fica assim até o esmaecer
      cortar a tela. Medido do gatilho até o fim: ~12 s de arrasto, mais a
      aproximação do jogador — foi o "ele fica 20 segundos parando
      lentamente".

      Agora é uma frenagem de verdade: `v = V_CHEGADA·√(restante/CHEGADA_M)`
      é o perfil de desaceleração CONSTANTE (1,4 m/s², que é freada
      tranquila de caminhão), e ele chega a zero no ponto, não perto dele.
      Dos 42 m até parar são 7,6 s.

      E ele ENCOSTA: nos últimos 30 m a lateral vai para o meio-fio da
      direita, como quem estaciona. Sem isso o caminhão para no meio da
      faixa e a fase seguinte começa com ele plantado na pista.
    */
    const restante = DISTANCIA_TOTAL - d
    if (restante < CHEGADA_M) {
      const freado = V_CHEGADA * Math.sqrt(Math.max(0, restante) / CHEGADA_M)
      // Guincho uma vez so, e so se a rampa estiver REDUZINDO de verdade.
      // Quem ja vinha devagar encosta sem freada — carro que chia parando a
      // 10 km/h soa errado, e e justamente quem obedeceu o limite.
      if (!guinchou.current && v - freado > 4) {
        guinchou.current = true
        som.freada(Math.min(1, (v - freado) / 12))
      }
      v = Math.min(v, freado)

      // encosta no meio-fio: 0 a 30 m vira 0 a 1, suavizado nas duas pontas
      const u = Math.min(1, Math.max(0, (ENCOSTA_M - restante) / ENCOSTA_M))
      const alvoLateral = LATERAL_CALCADA * (u * u * (3 - 2 * u))
      lateral.current += (alvoLateral - lateral.current)
        * Math.min(1, dt * 1.6)
    }

    if (teto != null && d >= teto) {
      // encostou na traseira do ônibus: para e fica parado
      v = 0
    }
    velocidade.current = v
    som.motor(v)
    // Pátio de escola: entra e sai junto com o muro, e sobe conforme chega.
    // É o aviso sonoro de que ali se reduz — chega antes da placa.
    {
      const emEscola = d > ZONA_ESCOLA.de - 90 && d < ZONA_ESCOLA.ate + 60
      const centro = (ZONA_ESCOLA.de + ZONA_ESCOLA.ate) / 2
      const meia = (ZONA_ESCOLA.ate - ZONA_ESCOLA.de) / 2 + 80
      som.criancas(emEscola, emEscola
        ? Math.max(0.15, 1 - Math.abs(d - centro) / meia)
        : 0)
    }
    distancia.current = Math.min(
      DISTANCIA_TOTAL, teto ?? DISTANCIA_TOTAL, d + v * dt,
    )

    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__trajeto = {
        // os metros dos eventos entram no gancho para quem dirige por script
        // não precisar repetir aqui números que já moram no conteúdo
        lombada: EVENTOS.find((e) => e.tipo === 'lombada')?.metro ?? null,
        onibus: evento('onibus')?.metro ?? null,
        ciclista: evento('ciclista')?.metro ?? null,
        d: +d.toFixed(1), kmh: +(v * 3.6).toFixed(1), pedal: pedal.current,
        ateParada: ateParada == null ? null : +ateParada.toFixed(1),
        ateGaragem: ateGaragem == null ? null : +ateGaragem.toFixed(1),
        garagemLiberada: garagemLiberada.current,
        carro: carro.current == null ? null : +carro.current.toFixed(1),
        vao: carro.current == null ? null : +(carro.current - d).toFixed(1),
        trecho: trecho.id, limite: trecho.limite, dt: +dt.toFixed(4),
        faltas: { ...faltas.current },
        paradoDesde: +paradoDesde.current.toFixed(2),
        pedestreLiberado: pedestreLiberado.current,
        lateral: +lateral.current.toFixed(2), seta: seta.current,
        excesso: +excesso.current.toFixed(2),
        // quanto o carro da frente está freando AGORA. Ver `?freioaceso=1`
        // em Via.tsx: conferir a lanterna por captura de tela é loteria.
        freio: +freioCarro.current.toFixed(2),
      }
    }

    desdeAtualizacao.current += dt
    if (desdeAtualizacao.current > 0.1) {
      desdeAtualizacao.current = 0
      painel.current?.atualizar({
        distancia: distancia.current, velocidade: v, trecho,
        limite: trecho.limite, ateParada,
        sinal: sinal.current, ateSinal,
        ateGaragem, seta: seta.current,
      })
    }
    // Chegou: a tela esmaece ANTES de trocar de fase. O corte seco fazia
    // parecer troca de slide; o esmaecer dá o segundo que o olho precisa para
    // registrar que o caminhão parou ao lado do poste.
    // chegou = PAROU, e não "passou da marca". Com a frenagem de verdade os
    // dois acontecem quase junto, mas a condição certa é a parada: é ela que
    // o jogador vê acontecer.
    if (distancia.current >= DISTANCIA_TOTAL - 0.4 && !chegou.current) {
      chegou.current = true
      aoChegar()
    }
  })
  return null
}

function contar(
  ref: React.RefObject<Record<string, number>>, chave: string, quanto: number,
) {
  const m = ref.current
  if (!m) return
  m[chave] = (m[chave] ?? 0) + quanto
}

/**
 * Converte o acumulado em registros do relatório.
 *
 * Falta por tempo (excesso, lento, seguimento) só conta a partir de 1,5 s:
 * um pico de meio segundo ao entrar num trecho mais lento é reação normal, não
 * conduta insegura, e punir isso ensina o jogador a desconfiar do jogo.
 */
export function montarRegistros(acumulado: Record<string, number>): Registro[] {
  const PISO = 1.5
  const porTempo = new Set(['excesso', 'lento', 'seguimento'])
  return Object.values(FALTAS).map((f) => {
    const bruto = acumulado[f.id] ?? 0
    const cometeu = porTempo.has(f.id) ? bruto > PISO : bruto > 0
    if (!cometeu) {
      return {
        fase: 'trajeto', id: f.id, titulo: f.acerto, veredito: 'correta',
        pontos: f.peso,
        porque: 'Sem apontamento neste item durante o trajeto.',
        norma: f.norma,
      }
    }
    const quanto = porTempo.has(f.id)
      ? ` Foram ${bruto.toFixed(0)} segundos nessa condição.`
      : ''
    return {
      fase: 'trajeto', id: f.id, titulo: f.titulo, veredito: 'incorreta',
      pontos: 0, porque: f.porque + quanto, norma: f.norma,
    }
  })
}

export type PainelAPI = {
  atualizar: (s: Situacao) => void
  /** Mostra ou esconde a chamada no celular. */
  celular: (tocando: boolean) => void
}

type CelularRef = React.RefObject<'dormindo' | 'tocando' | 'atendeu' | 'ignorou'>

const Painel = forwardRef<
  PainelAPI, { pedal: React.RefObject<Pedal>; celular: CelularRef }
>(
  function Painel({ pedal, celular }, ref) {
    const kmhEl = useRef<HTMLElement>(null)
    const maxEl = useRef<HTMLElement>(null)
    const arcoEl = useRef<SVGCircleElement>(null)
    const tracoEl = useRef<SVGLineElement>(null)
    const trechoEl = useRef<HTMLElement>(null)
    const avisoEl = useRef<HTMLElement>(null)
    const barraEl = useRef<HTMLElement>(null)
    const alertaEl = useRef<HTMLDivElement>(null)
    const alertaTexto = useRef<HTMLSpanElement>(null)
    const sinalEl = useRef<HTMLDivElement>(null)
    const setaEl = useRef<HTMLDivElement>(null)
    // A chamada é o único pedaço do painel que passa pelo estado do React:
    // ela aparece uma vez por partida, então o re-render não custa nada —
    // e sem estado não dá para montar os dois botões.
    const [chamando, setChamando] = useState(false)
    /*
      O ANÚNCIO GRANDE DE TRECHO.
      O aviso do trecho morava numa linha de 19 px no canto de cima, junto da
      barra de progresso — que é onde se põe dado consultável, não onde se
      avisa que a rua mudou. Dirigindo, ninguém lê o canto da tela.

      Entra como estado do React, e não pelos refs como o resto do painel:
      trecho muda oito vezes numa partida inteira, então o re-render não
      custa nada. O que não pode passar pelo estado é o que muda por quadro.
    */
    const [anuncio, setAnuncio] = useState<
      { tipo: TipoAviso; nome: string; aviso: string } | null>(null)
    const trechoAnterior = useRef<string | null>(null)
    const someAnuncio = useRef(0)

    useImperativeHandle(ref, () => ({
      celular(tocando) { setChamando(tocando) },
      atualizar(s) {
        const kmh = Math.round(s.velocidade * 3.6)
        if (kmhEl.current) {
          kmhEl.current.textContent = String(kmh)
          kmhEl.current.classList.toggle(
            'acima', kmh > s.limite + CONDUTA.toleranciaKmh,
          )
        }
        if (maxEl.current) maxEl.current.textContent = `máx ${s.limite}`
        // O arco varre 270°, de 7h30 a 4h30. `pathLength=100` deixa a conta
        // ser porcentagem direto: 75 das 100 unidades são os 270°.
        if (arcoEl.current) {
          const f = Math.max(0, Math.min(1, kmh / ESCALA_VELOCIMETRO))
          arcoEl.current.style.strokeDasharray = `${f * 75} 100`
        }
        // o traço do limite da via anda com o trecho: é contra ele que o
        // jogador compara, não contra o fim da escala
        if (tracoEl.current) {
          const g = -135 + 270 * (s.limite / ESCALA_VELOCIMETRO)
          tracoEl.current.setAttribute('transform', `rotate(${g} 60 60)`)
        }
        // A SETA PISCA PELO RELÓGIO, e não pelo metro: é o único pedaço do
        // painel que não precisa ser reprodutível entre duas partidas, e uma
        // seta que não pisca não lê como seta.
        if (setaEl.current) {
          const piscando = s.seta != null && Math.floor(Date.now() / 420) % 2 === 0
          setaEl.current.className =
            `trajeto-seta${s.seta ? ` seta-${s.seta}` : ''}${piscando ? ' acesa' : ''}`
        }
        if (s.trecho.id !== trechoAnterior.current) {
          trechoAnterior.current = s.trecho.id
          setAnuncio({
            tipo: s.trecho.id as TipoAviso,
            nome: s.trecho.nome,
            // o nome já está no título: aqui fica só o que ele AVISA
            aviso: s.trecho.aviso
              .split(' · ')
              .filter((x) => x !== s.trecho.nome && !/^\d+\s*km\/h$/.test(x.trim()))
              .join(' · '),
          })
          window.clearTimeout(someAnuncio.current)
          someAnuncio.current = window.setTimeout(() => setAnuncio(null), 3000)
        }
        if (trechoEl.current) trechoEl.current.textContent = s.trecho.nome
        if (avisoEl.current) {
          // Os avisos antigos começavam com "Nome · 60 km/h · ..." e eu
          // cortava os dois primeiros pedaços, porque nome e limite ganharam
          // lugar próprio. Só que o do pátio foi reescrito para explicar o
          // MOTIVO e não tem mais esse prefixo — e o corte cego apagava a
          // frase inteira. Agora só tira o que de fato for nome ou limite.
          const partes = s.trecho.aviso.split(' · ')
          const util = partes.filter(
            (x) => x !== s.trecho.nome && !/^\d+\s*km\/h$/.test(x.trim()),
          )
          avisoEl.current.textContent = util.join(' · ')
        }
        if (barraEl.current) {
          barraEl.current.style.width =
            `${(s.distancia / DISTANCIA_TOTAL) * 100}%`
        }
        if (sinalEl.current) {
          const mostra = s.ateSinal != null
          sinalEl.current.style.display = mostra ? '' : 'none'
          if (mostra) {
            sinalEl.current.className =
              `trajeto-sinal sinal-${['verde', 'amarelo', 'vermelho'][s.sinal]}`
            sinalEl.current.textContent =
              s.ateSinal! < 1 ? 'Cruzamento' : `${Math.round(s.ateSinal!)} m`
          }
        }
        if (alertaEl.current) {
          // Um alerta só, para dois eventos. Dois avisos simultâneos na
          // mesma tela competem e o jogador não lê nenhum — e eles estão
          // separados por 40 m de propósito, então nunca coincidem.
          const texto = s.ateParada != null
            ? `Pedestre na faixa · pare a ${Math.round(s.ateParada)} m`
            : s.ateGaragem != null
              ? `Veículo saindo da garagem · reduza a ${Math.round(s.ateGaragem)} m`
              : null
          alertaEl.current.style.display = texto ? '' : 'none'
          alertaEl.current.className =
            `trajeto-alerta ${s.ateParada != null ? 'alerta-pedestre' : 'alerta-garagem'}`
          if (texto && alertaTexto.current) alertaTexto.current.textContent = texto
        }
      },
    }), [])

    const segurar = (p: Pedal) => ({
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault()
        pedal.current = p
      },
      onPointerUp: () => { pedal.current = null },
      onPointerLeave: () => { pedal.current = null },
      onPointerCancel: () => { pedal.current = null },
    })

    return (
      <>
        <header className="trajeto-topo">
          <div className="trajeto-barra" aria-hidden>
            <i ref={barraEl} style={{ width: '0%' }} />
            {/* um traço por fronteira de trecho: o jogador vê quanto falta
                PARA O PRÓXIMO lugar, não só quanto falta para o fim */}
            {MARCAS_DE_TRECHO.map((pc) => (
              <u key={pc} style={{ left: `${pc}%` }} />
            ))}
          </div>
          <p className="trajeto-trecho">
            <b ref={trechoEl}>{TRAJETO[0].nome}</b>
            <span ref={avisoEl}>{TRAJETO[0].aviso}</span>
          </p>
        </header>

        {anuncio && (
          <div className="trajeto-anuncio" key={anuncio.nome} role="status">
            <div className="anuncio-icone"><IconeAviso tipo={anuncio.tipo} /></div>
            <div>
              <p className="anuncio-nome">{anuncio.nome}</p>
              {anuncio.aviso && <p className="anuncio-aviso">{anuncio.aviso}</p>}
            </div>
          </div>
        )}

        {/* Os dois ícones ficam SEMPRE no DOM e o CSS esconde o que não vale.
            O texto do alerta é uma contagem em metros que muda por quadro, e
            por isso continua imperativo — trocar o ícone por `innerHTML` a
            cada quadro seria pagar análise de HTML 60 vezes por segundo. */}
        <div className="trajeto-alerta" ref={alertaEl} style={{ display: 'none' }}>
          <span className="alerta-ic ic-pedestre"><IconeAviso tipo="pedestre" /></span>
          <span className="alerta-ic ic-garagem"><IconeAviso tipo="garagem" /></span>
          <span ref={alertaTexto} />
        </div>
        <div className="trajeto-sinal" ref={sinalEl} style={{ display: 'none' }} />

        {chamando && (
          <div className="trajeto-chamada" role="dialog" aria-live="polite">
            <div className="fone">
              <p className="fone-estado">Chamada recebida</p>
              <div className="fone-avatar" aria-hidden>S</div>
              <p className="fone-quem">Supervisão</p>
              <p className="fone-nota">Você está dirigindo</p>
              <div className="fone-botoes">
                <button
                  className="fone-recusa"
                  onClick={() => { celular.current = 'ignorou'; setChamando(false) }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M3 10.5c5-4 13-4 18 0l-2.2 3-3.6-1.1-.4-2.4a12 12 0 0 0-5.6 0l-.4 2.4-3.6 1.1Z" />
                    <path d="M4 20 20 4" />
                  </svg>
                  Deixar tocar
                </button>
                <button
                  className="fone-atende"
                  onClick={() => { celular.current = 'atendeu'; setChamando(false) }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path d="M7.5 4.5 9.8 9l-2 1.8a12 12 0 0 0 5.4 5.4l1.8-2 4.5 2.3-1 3.1a2 2 0 0 1-2.1 1.3C9.6 20.2 3.8 14.4 2.9 7.6A2 2 0 0 1 4.2 5.5Z" />
                  </svg>
                  Atender
                </button>
              </div>
            </div>
          </div>
        )}

        {/* As duas setas, sempre na tela e apagadas: aparecendo e sumindo
            elas empurrariam o velocímetro de lado a cada manobra. */}
        <div className="trajeto-seta" ref={setaEl} aria-hidden>
          <svg viewBox="0 0 24 24"><path d="M15 5 L8 12 L15 19" /></svg>
          <svg viewBox="0 0 24 24"><path d="M9 5 L16 12 L9 19" /></svg>
        </div>

        <div className="trajeto-velocimetro">
          <svg viewBox="0 0 120 120" aria-hidden>
            <circle className="veloc-trilho" cx="60" cy="60" r="50" pathLength={100} />
            <circle
              className="veloc-valor" ref={arcoEl} cx="60" cy="60" r="50"
              pathLength={100} style={{ strokeDasharray: '0 100' }}
            />
            <line
              className="veloc-limite" ref={tracoEl}
              x1="60" y1="3" x2="60" y2="17"
              transform={`rotate(${-135 + 270 * (TRAJETO[0].limite / ESCALA_VELOCIMETRO)} 60 60)`}
            />
          </svg>
          <strong ref={kmhEl}>0</strong>
          <span>km/h</span>
          <em ref={maxEl}>máx {TRAJETO[0].limite}</em>
        </div>

        <div className="trajeto-pedais">
          <button className="pedal pedal-freio" {...segurar('freia')}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M5 17V7M19 17V7" />
            </svg>
            Frear
          </button>
          <button className="pedal pedal-acel" {...segurar('acelera')}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M6 5l9 7-9 7z" />
            </svg>
            Acelerar
          </button>
        </div>
        <p className="trajeto-dica">Segure os botões · ou use as setas ↑ e ↓</p>
      </>
    )
  },
)

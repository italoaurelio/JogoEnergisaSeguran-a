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
import { Canvas, useFrame } from '@react-three/fiber'
import { som } from '../som'
import { Acabamento } from '../cena/Acabamento'
import { ZONA_ESCOLA } from '../cena/paisagem'
import { Environment, Sky } from '@react-three/drei'
import * as THREE from 'three'
import { Mundo, paisagem, type Marco } from '../cena/Via'
import { perfilEm, type NoTracado } from '../cena/curva'
import { Cabine, LuzCabine } from '../cena/Cabine3D'
import {
  CONDUTA, DISTANCIA_TOTAL, FALTAS, MAXIMO_TRAJETO, TRAJETO, VEICULO,
  type Evento, type Trecho,
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
const OLHO: [number, number, number] = [0.38, 1.17 + ALTURA_CABINE, -0.20]

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
  const [acabou, setAcabou] = useState(false)

  const marcos = useMemo<Marco[]>(() => {
    const base = paisagem(DISTANCIA_TOTAL)
    for (const e of EVENTOS) {
      if (e.tipo === 'placa') base.push({ peca: 'placa', metro: e.metro, x: -2.9 })
      if (e.tipo === 'lombada') base.push({ peca: 'lombada', metro: e.metro, x: 0 })
      if (e.tipo === 'faixa') base.push({ peca: 'faixa_pedestre', metro: e.metro, x: 0 })
      // o semáforo fica na borda do lado do motorista, recuado do cruzamento
      if (e.tipo === 'semaforo') base.push({ peca: 'semaforo', metro: e.metro, x: -3.1 })
      // o ônibus para encostado na direita, no sentido do jogador
      if (e.tipo === 'onibus') base.push({ peca: 'onibus', metro: e.metro, x: -1.0 })
      // o ciclista anda junto à borda direita
      if (e.tipo === 'ciclista') base.push({ peca: 'ciclista', metro: e.metro, x: -1.3 })
    }
    return base
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
        <Canvas dpr={[1, 1.5]} shadows camera={{ position: OLHO, fov: 52 }}>
          <Sky sunPosition={[-40, 28, 60]} turbidity={5} rayleigh={1.4} />
          {/* névoa: sem ela a via some num corte seco no fim do alcance e a
              profundidade da paisagem não lê */}
          <fog attach="fog" args={['#b8c6d4', 90, 290]} />
          <Environment files="./hdri/ceu.hdr" environmentIntensity={0.35} />
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
                              'celular_guardado', 'checklist_feito']} />
          </group>
          <Mundo
            distancia={distancia}
            marcos={marcos}
            carro={carro}
            tracado={TRACADO}
            sinal={sinal}
            faixa={evento('faixa')?.metro ?? null}
            pedestreLiberado={pedestreLiberado}
            onibus={evento('onibus')?.metro ?? null}
            onibusLiberado={onibusLiberado}
            garagem={{
              metro: evento('garagem')?.metro ?? null,
              liberada: garagemLiberada,
            }}
          />
          <Motor
            distancia={distancia}
            velocidade={velocidade}
            pedal={pedal}
            carro={carro}
            faltas={faltas}
            pedestreLiberado={pedestreLiberado}
            onibusLiberado={onibusLiberado}
            garagemLiberada={garagemLiberada}
            sinal={sinal}
            celular={celular}
            painel={painel}
            aoTerminar={terminar}
          />
          <CameraFixa distancia={distancia} />
          <Acabamento raio={2.0} />
        </Canvas>
      </div>

      <Painel ref={painel} pedal={pedal} celular={celular} />
    </div>
  )
}

/**
 * Mantém a câmera no olho do motorista, com uma balançada leve.
 *
 * A inclinação na curva é pequena de propósito (no máximo 1,7°): a dobra
 * acontece no cenário, e exagerar aqui briga com o que os olhos veem e enjoa.
 */
function CameraFixa({ distancia }: { distancia: React.RefObject<number> }) {
  const { current: base } = useRef(new THREE.Vector3(...OLHO))
  const inclinacao = useRef(0)
  useFrame(({ camera, clock }, dt) => {
    const t = clock.elapsedTime
    camera.position.set(
      base.x + Math.sin(t * 2.1) * 0.004,
      base.y + Math.sin(t * 3.3) * 0.005,
      base.z,
    )
    camera.lookAt(base.x + 0.02, base.y - 0.42, base.z + 6)
    const alvo = -perfilEm(TRACADO, distancia.current ?? 0).curva * 0.03
    inclinacao.current += (alvo - inclinacao.current) * Math.min(1, dt * 2.5)
    camera.rotateZ(inclinacao.current)
  })
  return null
}

function Motor({
  distancia, velocidade, pedal, carro, faltas, pedestreLiberado, onibusLiberado,
  garagemLiberada, sinal, celular, painel, aoTerminar,
}: {
  distancia: React.RefObject<number>
  velocidade: React.RefObject<number>
  pedal: React.RefObject<Pedal>
  carro: React.RefObject<number | null>
  faltas: React.RefObject<Record<string, number>>
  pedestreLiberado: React.RefObject<boolean>
  onibusLiberado: React.RefObject<boolean>
  garagemLiberada: React.RefObject<boolean>
  sinal: React.RefObject<number>
  celular: React.RefObject<'dormindo' | 'tocando' | 'atendeu' | 'ignorou'>
  painel: React.RefObject<PainelAPI | null>
  aoTerminar: () => void
}) {
  const desdeAtualizacao = useRef(0)
  const paradoDesde = useRef(0)
  const amareloDesde = useRef<number | null>(null)
  const paradoNoSinal = useRef(0)
  const esperouGaragem = useRef(0)
  const buzinou = useRef(false)
  const esperouOnibus = useRef(0)
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
    const dt = Math.min(bruto, 0.05)
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
      const alvo = (evCarro as { velocidade: number }).velocidade / 3.6
      carro.current += alvo * dt
      const vao = carro.current - d
      const seguro = Math.max(8, v * CONDUTA.segundosDeSeguimento)
      if (vao < seguro) contar(faltas, 'seguimento', dt)
      if (vao < 6) v = Math.min(v, alvo * 0.9)   // não atravessa o carro da frente
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
      som.telefone()
    }
    if (celular.current === 'atendeu' && !julgados.current.celular) {
      julgados.current.celular = true
      contar(faltas, 'celular', 1)
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
    if (evOnibus && !onibusLiberado.current) {
      const falta = evOnibus.metro - d
      if (falta < 55 && kmh <= CONDUTA.onibusKmh) {
        esperouOnibus.current += dt
        if (esperouOnibus.current > 4.5) onibusLiberado.current = true
      }
      // COLISÃO. O teto é aplicado lá embaixo, junto com a escrita da
      // distância: clampar aqui não adianta porque a linha
      // `distancia.current = d + v * dt` roda DEPOIS e sobrescreve com o `d`
      // antigo. Custou uma rodada de medição descobrir isso.
      teto = evOnibus.metro - PARAR_ATRAS_DO_ONIBUS
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
      if (antes > 0 && depois <= 0 && kmh > CONDUTA.lombadaKmh) {
        contar(faltas, 'lombada', 1)
      }
    }

    // velocidade compatível
    if (kmh > trecho.limite + CONDUTA.toleranciaKmh) contar(faltas, 'excesso', dt)
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
      }
    }

    desdeAtualizacao.current += dt
    if (desdeAtualizacao.current > 0.1) {
      desdeAtualizacao.current = 0
      painel.current?.atualizar({
        distancia: distancia.current, velocidade: v, trecho,
        limite: trecho.limite, ateParada,
        sinal: sinal.current, ateSinal,
        ateGaragem,
      })
    }
    if (distancia.current >= DISTANCIA_TOTAL) aoTerminar()
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
    const sinalEl = useRef<HTMLDivElement>(null)
    // A chamada é o único pedaço do painel que passa pelo estado do React:
    // ela aparece uma vez por partida, então o re-render não custa nada —
    // e sem estado não dá para montar os dois botões.
    const [chamando, setChamando] = useState(false)

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
        if (trechoEl.current) trechoEl.current.textContent = s.trecho.nome
        if (avisoEl.current) {
          // o aviso do trecho já começa com o nome e o limite, que agora têm
          // lugar próprio na tela; aqui fica só o que sobra
          const resto = s.trecho.aviso.split(' · ').slice(2).join(' · ')
          avisoEl.current.textContent = resto
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
          if (texto) alertaEl.current.textContent = texto
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
            <span ref={avisoEl}>
              {TRAJETO[0].aviso.split(' · ').slice(2).join(' · ')}
            </span>
          </p>
        </header>

        <div className="trajeto-alerta" ref={alertaEl} style={{ display: 'none' }} />
        <div className="trajeto-sinal" ref={sinalEl} style={{ display: 'none' }} />

        {chamando && (
          <div className="trajeto-chamada" role="dialog" aria-live="polite">
            <p className="chamada-quem">Chamada · Supervisão</p>
            <p className="chamada-nota">Você está dirigindo.</p>
            <div className="chamada-botoes">
              <button
                className="chamada-recusa"
                onClick={() => { celular.current = 'ignorou'; setChamando(false) }}
              >
                Deixar tocar
              </button>
              <button
                className="chamada-atende"
                onClick={() => { celular.current = 'atendeu'; setChamando(false) }}
              >
                Atender
              </button>
            </div>
          </div>
        )}

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

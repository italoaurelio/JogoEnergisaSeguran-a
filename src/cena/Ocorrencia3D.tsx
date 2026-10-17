/**
 * A cena da ocorrência: poste com transformador na via.
 *
 * O cenário fixo vem assado do Blender. As peças que o jogador posiciona —
 * caminhão, cones, cavalete, fita — são nós separados, instanciados aqui
 * conforme as decisões da fase 3a. É o mesmo padrão do EPI e da cabine: o que
 * o jogador decide, ele vê acontecer.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { som } from '../som'
import { TOM_ASSADO, aquecerPele, domarSheen } from './texturas'
import { ALTURA_BASE, type Fisico } from './Personagem'
import * as THREE from 'three'

const MODELO = './modelos/ocorrencia.glb'
const ELETRICISTA = './modelos/eletricista.glb'
const VIA = './modelos/via.glb'
const DRACO = './draco/gltf/'

useGLTF.preload(MODELO, DRACO)
useGLTF.preload(ELETRICISTA, DRACO)
useGLTF.preload(VIA, DRACO)

/** Uma peça posicionada pelo jogador. */
export type Colocada = {
  peca: 'oc_veiculo' | 'oc_cone' | 'oc_cavalete' | 'oc_fita' | 'oc_caixa'
    | 'oc_escada'
  pos: [number, number, number]
  giro?: number
  /** A fita tem 3 m de vão; esticar é mais barato que exportar vários tamanhos. */
  escala?: [number, number, number]
  /** Inclinação em X e Z (rad). A escada encosta no poste, não fica em pé. */
  tombo?: [number, number]
  /** Só o caminhão: 0 lança de transporte, 1 cesto no alto. */
  elevacao?: number
  /**
   * PRÉVIA: a peça aparece translúcida, já no lugar, sem andar, sem cair e
   * sem som. É o que o jogador vê enquanto ainda está decidindo — e vira
   * peça de verdade quando ele confirma.
   */
  fantasma?: boolean
  /** Escada de alumínio: mesma malha da de fibra, acabamento de metal nu. */
  metal?: boolean
}

/**
 * Deixa uma cópia translúcida.
 *
 * Os materiais TÊM de ser clonados: `Object3D.clone(true)` copia a árvore mas
 * compartilha o material com o original, então baixar a opacidade aqui
 * apagaria metade do caminhão de verdade junto. Os clones são devolvidos para
 * quem chamou poder descartá-los quando a prévia sai de cena.
 */
function fantasmar(raiz: THREE.Object3D): THREE.Material[] {
  const criados: THREE.Material[] = []
  raiz.traverse((n) => {
    const m = n as THREE.Mesh
    if (!m.isMesh) return
    const lista = Array.isArray(m.material) ? m.material : [m.material]
    const novos = lista.map((x) => {
      const c = (x as THREE.MeshStandardMaterial).clone()
      c.transparent = true
      c.opacity = 0.36
      // sem isto as faces de trás da própria peça furam a de frente e a
      // prévia vira um emaranhado em vez de um volume
      c.depthWrite = false
      c.emissive = new THREE.Color('#4fe39b')
      c.emissiveIntensity = 0.55
      c.metalness = 0
      c.roughness = 1
      criados.push(c)
      return c
    })
    m.material = novos.length === 1 ? novos[0] : novos
    m.castShadow = false
    m.receiveShadow = false
  })
  return criados
}

/**
 * Articulação do cesto aéreo, em coordenadas do jogo. Os dois pontos saem de
 * `public/modelos/ocorrencia.json` (campos `pino` e `cestoBase`), escritos
 * pelo exportador a partir das medidas de `arte/blender/caminhao.py`.
 *
 * A lança gira em torno do PINO; o cesto é LEVADO pelo mesmo giro mas não
 * gira — cesto que acompanha o ângulo da lança despeja o eletricista na rua.
 */
const PINO = new THREE.Vector3(-0.88, 2.14, 0)
const CESTO_BASE = new THREE.Vector3(2.88, 1.96, 0)
/**
 * Ângulo da lança com o cesto no alto.
 *
 * 62° e não 42°: a câmera do reparo mira y = 6,4 m, que é a altura da chave
 * fusível no poste. Com 42° o piso do cesto para em 4,52 m e o eletricista
 * fica OLHANDO PARA CIMA para o serviço que está fazendo com as mãos — a
 * altura é conta, não gosto. Com 62° o piso vai a 5,38 m e o peito de quem
 * está dentro encosta nos 6,4 m. O braço tem 3,76 m e o pino está a 2,14 m,
 * então 5,9 m é o teto físico desta lança.
 */
const ELEVACAO_MAX = THREE.MathUtils.degToRad(62)

/** Comprimento do braço em repouso: do pino até a base do cesto. */
const BRACO = CESTO_BASE.clone().sub(PINO)

/**
 * ONDE O CESTO PRECISA PARAR para alguém trabalhar na chave fusível.
 *
 * 6,20 m de piso: o eletricista tem 1,47 m do pé à mão com os braços na
 * altura do rosto (medido no rig), e a chave está a 7,73 m. 6,20 + 1,47 =
 * 7,67 — ele alcança esticando, que é como se trabalha em altura.
 *
 * 1,40 m de afastamento do poste: cesto encostado no poste seria o próprio
 * cesto batendo na cruzeta.
 */
const ALTURA_DE_TRABALHO = 6.20
const AFASTAMENTO = 1.40

/**
 * A lança é TELESCÓPICA e gira na base, e isso não é enfeite: é o que faz o
 * eletricista poder estar no cesto.
 *
 * O braço modelado tem 3,76 m. O caminhão, quando o jogador o estaciona
 * protegendo a área — que é a resposta CERTA —, para a 8,5 m do poste. Com
 * 3,76 m de alcance o cesto subia para o meio da rua, a sete metros de onde
 * o serviço acontece, e era por isso que o eletricista tinha acabado parando
 * em cima do transformador: não havia cesto nenhum perto do poste onde pôr
 * ele.
 *
 * Equipamento de verdade para distribuição alcança 10 a 13 m, e alcança
 * porque a lança ESTENDE e GIRA. Aqui a extensão é escala no eixo do braço
 * (a lança é um perfil reto, então esticar lê como seção telescópica) e o
 * giro é uma rotação em torno da vertical no pino. Os dois saem da posição
 * em que o jogador estacionou, não de número escrito à mão — se ele parar em
 * outro lugar, a lança aponta para o outro lado sozinha.
 */
export function miraDoCesto(posicaoCaminhao: [number, number, number]) {
  const [tx, , tz] = posicaoCaminhao
  // o poste está na origem do mundo; em coordenada do caminhão, aqui:
  const alvoX = -tx - PINO.x
  const alvoZ = -tz - PINO.z
  const dist = Math.hypot(alvoX, alvoZ)
  const giro = Math.atan2(-alvoZ, alvoX)

  const horizontal = Math.max(1.2, dist - AFASTAMENTO)
  const subida = ALTURA_DE_TRABALHO - PINO.y
  const comprimento = Math.hypot(horizontal, subida)
  const estica = Math.max(1, comprimento / BRACO.length())
  // o braço em repouso já aponta 2,7° para baixo; a elevação é a diferença
  const repouso = Math.atan2(BRACO.y, BRACO.x)
  const elevar = Math.atan2(subida, horizontal) - repouso

  // onde o piso do cesto para, em coordenada do MUNDO
  const bracoEsticado = BRACO.clone().multiplyScalar(estica)
  const girado = bracoEsticado.clone().applyAxisAngle(EIXO_Z, elevar)
  const ponta = new THREE.Vector3(
    PINO.x + girado.x * Math.cos(giro),
    PINO.y + girado.y,
    PINO.z - girado.x * Math.sin(giro),
  )
  return {
    giro, estica, elevar,
    cesto: [ponta.x + tx, ponta.y, ponta.z + tz] as [number, number, number],
  }
}

/**
 * Onde o piso do cesto está COM A LANÇA A MEIO CAMINHO.
 *
 * Existe porque o eletricista precisa subir JUNTO. Antes ele era posto no
 * ponto final da lança desde o primeiro quadro: o cesto subia vazio e ele
 * aparecia lá em cima desde o começo, flutuando no ar enquanto o braço ia
 * atrás dele.
 *
 * O caminho do cesto é um ARCO, não uma reta — a lança gira e estica ao
 * mesmo tempo. Interpolar entre a posição de repouso e a final em linha reta
 * tiraria ele de dentro do cesto no meio da subida. Aqui se refaz a mesma
 * conta da lança para o `t` pedido, que é o que mantém os dois grudados.
 */
export function cestoEm(
  posicaoCaminhao: [number, number, number], t: number,
): [number, number, number] {
  const [tx, , tz] = posicaoCaminhao
  const m = miraDoCesto(posicaoCaminhao)
  const estica = 1 + (m.estica - 1) * t
  const p = BRACO.clone().multiplyScalar(estica).applyAxisAngle(EIXO_Z, m.elevar * t)
  const giro = m.giro * t
  return [
    tx + PINO.x + p.x * Math.cos(giro),
    PINO.y + p.y,
    tz + PINO.z - p.x * Math.sin(giro),
  ]
}

/**
 * A MESMA suavização do cesto, replicada por quem precisa acompanhá-lo.
 *
 * Não é estado compartilhado: é a mesma regra, com a mesma entrada, no mesmo
 * laço de quadro. Dois `ref` independentes com `dt` igual produzem o mesmo
 * número — e isso é mais simples de seguir do que um ponteiro mutável que
 * dois componentes escrevem.
 */
export function subirCesto(atual: number, alvo: number, dt: number) {
  return atual + (alvo - atual) * Math.min(1, dt * 0.9)
}

export function CenaOcorrencia({ colocadas }: { colocadas: Colocada[] }) {
  const { scene } = useGLTF(MODELO, DRACO)

  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__ocorrencia = scene
    }
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true }
    })
    // as peças soltas só aparecem pelas cópias
    for (const no of scene.children) {
      if (no.name.startsWith('oc_') && MOVEIS.has(no.name)) no.visible = false
    }
  }, [scene])

  return (
    <group>
      <primitive object={scene} />
      {colocadas.map((c, i) => (
        <Peca key={`${c.peca}_${i}`} molde={scene} c={c} />
      ))}
    </group>
  )
}

/**
 * Uma peça colocada, que ANDA até o lugar em vez de aparecer lá.
 *
 * É o que separa "o 3D é papel de parede" de "o 3D é a consequência da
 * escolha". O caminhão é o caso que importa: enquanto a pergunta "onde parar"
 * está aberta ele está parado na pista, antes da área; escolhida a posição, a
 * MESMA peça (mesma chave de React, então o mesmo componente) recebe um alvo
 * novo e dirige até lá. Chegar e estacionar sai de graça da reconciliação.
 *
 * As peças pequenas não andam, caem: nascem 60 cm acima e assentam. Cone que
 * aparece pronto no chão não parece colocado por ninguém.
 */
function Peca({ molde, c }: { molde: THREE.Object3D; c: Colocada }) {
  const descartar = useRef<THREE.Material[]>([])
  const obj = useMemo(() => {
    const base = molde.getObjectByName(c.peca)
    if (!base) return null
    const clone = base.clone(true)
    clone.visible = true
    if (c.metal) descartar.current.push(...metalizar(clone))
    if (c.fantasma) descartar.current.push(...fantasmar(clone))
    return clone
  }, [molde, c.peca, c.fantasma, c.metal])

  // material clonado não é recolhido pelo coletor do navegador: fica na GPU
  useEffect(() => () => {
    for (const m of descartar.current) m.dispose()
    descartar.current = []
  }, [obj])

  const grupo = useRef<THREE.Group>(null)
  const alvo = useMemo(() => new THREE.Vector3(...c.pos), [c.pos])
  const inicio = useRef(true)
  // sem isto o motor fica roncando depois que a fase sai de cena
  useEffect(() => () => { if (c.peca === 'oc_veiculo') som.motor(null) }, [c.peca])

  useFrame((_, dt) => {
    const g = grupo.current
    if (!g) return
    if (inicio.current) {
      inicio.current = false
      // o caminhão já entra no lugar certo (ele está CHEGANDO); o resto cai.
      // A prévia nunca cai: ela não é uma peça sendo colocada, é o desenho
      // de onde ela ficaria.
      g.position.copy(alvo)
      if (c.peca !== 'oc_veiculo' && !c.fantasma) g.position.y += 0.6
    }
    const antes = g.position.x
    g.position.lerp(alvo, Math.min(1, dt * 2.6))
    if (c.peca === 'oc_veiculo' && !c.fantasma) {
      // velocidade real da peça vira rotação de motor: o caminhão que
      // manobra se ouve, e para de se ouvir quando estaciona
      const v = Math.abs(g.position.x - antes) / Math.max(dt, 1e-3)
      som.motor(v > 0.05 ? Math.min(v, 9) : null)
    }
  })

  if (!obj) return null
  return (
    <group
      ref={grupo}
      rotation={[c.tombo?.[0] ?? 0, c.giro ?? 0, c.tombo?.[1] ?? 0]}
      scale={c.escala ?? [1, 1, 1]}
    >
      <primitive object={obj} />
      {c.peca === 'oc_veiculo' && (
        <CestoAereo
          molde={molde} elevacao={c.elevacao ?? 0} fantasma={c.fantasma}
          onde={c.pos}
        />
      )}
    </group>
  )
}

/**
 * A escada de alumínio é a MESMA malha da de fibra, com o acabamento trocado.
 *
 * Modelar uma segunda escada só para a resposta errada seria caro e inútil:
 * a diferença que importa entre as duas não é a forma, é o material — uma
 * conduz e a outra não. Alumínio nu, espelhando a rede logo acima, diz isso
 * numa olhada.
 */
function metalizar(raiz: THREE.Object3D): THREE.Material[] {
  const criados: THREE.Material[] = []
  raiz.traverse((n) => {
    const m = n as THREE.Mesh
    if (!m.isMesh) return
    const lista = Array.isArray(m.material) ? m.material : [m.material]
    const novos = lista.map((x) => {
      const c = (x as THREE.MeshStandardMaterial).clone()
      // metal quase puro (0,95) ficava PRETO: o céu desta cena é um HDRI a
      // 0,22 de intensidade, e metal sem nada para refletir reflete o escuro.
      // Alumínio escovado real já é difuso o bastante para 0,55/0,38.
      c.color = new THREE.Color('#ced4da')
      c.metalness = 0.55
      c.roughness = 0.38
      criados.push(c)
      return c
    })
    m.material = novos.length === 1 ? novos[0] : novos
    return
  })
  return criados
}

/**
 * A lança e o cesto, que saíram do `.glb` como nós separados exatamente para
 * isto. Parentesco não sobrevive ao glTF, então a montagem é feita aqui: um
 * grupo no pino segura a lança (deslocada de −pino para girar em torno dele),
 * e o cesto recebe a posição já girada, com rotação zero.
 */
function CestoAereo({
  molde, elevacao, fantasma, onde,
}: {
  molde: THREE.Object3D
  elevacao: number
  fantasma?: boolean
  /** Posição do caminhão no mundo, para a lança saber onde está o poste. */
  onde: [number, number, number]
}) {
  const pecas = useMemo(() => {
    const l = molde.getObjectByName('oc_veiculo_lanca')?.clone(true)
    const c = molde.getObjectByName('oc_veiculo_cesto')?.clone(true)
    if (l) { l.visible = true; if (fantasma) fantasmar(l) }
    if (c) { c.visible = true; if (fantasma) fantasmar(c) }
    return { lanca: l ?? null, cesto: c ?? null }
  }, [molde, fantasma])

  const base = useRef<THREE.Group>(null)
  const eixo = useRef<THREE.Group>(null)
  const cestoRef = useRef<THREE.Group>(null)
  const atual = useRef(0)
  const mira = useMemo(() => miraDoCesto(onde), [onde])

  useFrame((_, dt) => {
    // sobe devagar: guindaste não é elevador de prédio, e o movimento lento é
    // metade do que faz a cena parecer um equipamento e não um brinquedo
    atual.current = subirCesto(atual.current, elevacao, dt)
    const t = atual.current
    const elev = mira.elevar * t
    const estica = 1 + (mira.estica - 1) * t

    if (base.current) base.current.rotation.y = mira.giro * t
    if (eixo.current) {
      eixo.current.rotation.z = elev
      eixo.current.scale.set(estica, 1, 1)
    }
    if (cestoRef.current) {
      const p = BRACO.clone().multiplyScalar(estica).applyAxisAngle(EIXO_Z, elev)
      cestoRef.current.position.copy(p).sub(BRACO)
    }
  })

  return (
    <group ref={base} position={PINO}>
      <group ref={eixo}>
        {pecas.lanca && (
          <primitive object={pecas.lanca} position={PINO.clone().negate()} />
        )}
      </group>
      <group ref={cestoRef}>
        {pecas.cesto && (
          <primitive object={pecas.cesto} position={PINO.clone().negate()} />
        )}
      </group>
    </group>
  )
}

const EIXO_Z = new THREE.Vector3(0, 0, 1)

/* ====================================================================
   O REPARO COMO CENA, não como lista
   ====================================================================
   Tudo daqui para baixo existe porque a fase 3c era um formulário: nove
   frases numa lista, clicadas na ordem. O que o eletricista escolhe no
   serviço não é uma frase — é uma FERRAMENTA, e um LUGAR para encostar
   ela. Estas peças são esses lugares.
   ==================================================================== */

/**
 * As marcas em que se pode encostar uma ferramenta.
 *
 * Mesmo `Html` do vestiário, e pelo mesmo motivo: o alvo tem de ter tamanho
 * de dedo num totem, e sprite encolhe quando a câmera recua. Aqui a câmera
 * fica a 7 m do poste, então sprite seria um ponto.
 */
export function AlvosDoPoste({
  alvos, ativo, feitos, escolher,
}: {
  alvos: { id: string; nome: string; onde: [number, number, number] }[]
  /** Alvo sob o cursor da ferramenta escolhida, ou null. */
  ativo: string | null
  /** Alvos que já receberam o que precisavam. */
  feitos: Set<string>
  escolher: (id: string) => void
}) {
  return (
    <>
      {alvos.map((a) => (
        <Html key={a.id} position={a.onde} center zIndexRange={[14, 2]}>
          <button
            className={`alvo ${feitos.has(a.id) ? 'alvo-feito' : ''} ${
              ativo === a.id ? 'alvo-mirado' : ''}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); escolher(a.id) }}
            title={a.nome}
          >
            <span className="alvo-ponto" />
            <span className="alvo-nome">{a.nome}</span>
          </button>
        </Html>
      ))}
    </>
  )
}

/**
 * O porta-fusível basculando.
 *
 * O nó `oc_chave_tubo` sai do Blender JÁ nas coordenadas de mundo dele, com
 * transformação identidade. Para girar em torno de um pino qualquer sem
 * reparentar nada — e reparentar não dá, porque a cena inteira entra como um
 * `primitive` só — a conta é: posição = pino − R·pino. É a mesma rotação em
 * torno de ponto arbitrário de sempre, escrita no próprio nó.
 */
export function PortaFusivel({
  aberta, pino,
}: {
  aberta: boolean
  pino: [number, number, number] | null
}) {
  const { scene } = useGLTF(MODELO, DRACO)
  const atual = useRef(0)
  const eixo = useMemo(() => new THREE.Vector3(0, 0, 1), [])

  useFrame((_, dt) => {
    const no = scene.getObjectByName('oc_chave_tubo')
    if (!no || !pino) return
    const alvo = aberta ? ABERTURA_CHAVE : 0
    // devagar: a vara empurra o tubo e ele cai pelo próprio peso, não salta
    atual.current += (alvo - atual.current) * Math.min(1, dt * 3.4)
    const q = new THREE.Quaternion().setFromAxisAngle(eixo, atual.current)
    const p = new THREE.Vector3(...pino)
    no.quaternion.copy(q)
    no.position.copy(p).sub(p.clone().applyQuaternion(q))
  })
  return null
}

/** Quanto o porta-fusível bascula ao abrir. Chave aberta fica pendurada. */
const ABERTURA_CHAVE = -2.0

/**
 * O aterramento temporário, desenhado — não modelado.
 *
 * São três cabos de cobre nu do condutor até a haste de terra. Desenhar aqui
 * em vez de modelar no Blender não é atalho: o aterramento só existe depois
 * que o jogador o instala, e ele precisa APARECER no instante do clique.
 * Peça do .glb seria mais um nó para ligar e desligar, com um ciclo de export
 * por ajuste de traçado.
 */
/**
 * O marcador do local do serviço — o cilindro de missão.
 *
 * "Na hora de chegar no local do reparo, deve ter um ícone, como se fosse
 * uma missão do GTA." É um pedido de ORIENTAÇÃO, não de enfeite: a fase 3
 * abre com o caminhão a 40 m do poste e três opções de onde parar, e até
 * aqui nada na cena dizia QUAL poste é o da ordem de serviço. A rua tem
 * cinco.
 *
 * Cilindro translúcido, sem tampa, pulsando devagar. Não entrega resposta
 * nenhuma — diz onde é o serviço, que é justamente o que o jogador já
 * saberia se estivesse lá.
 */
export function MarcadorDoServico({
  em, cor = '#2fd18c', raio = 1.9,
}: {
  em: [number, number, number]
  cor?: string
  raio?: number
}) {
  const grupo = useRef<THREE.Group>(null)
  useFrame((estado) => {
    const g = grupo.current
    if (!g) return
    const t = estado.clock.elapsedTime
    // respira entre 1,0 e 1,12 e gira devagar: parado ele vira decalque
    const e = 1 + Math.sin(t * 1.9) * 0.06
    g.scale.set(e, 1, e)
    g.rotation.y = t * 0.35
    g.position.y = em[1] + Math.sin(t * 1.9) * 0.05
  })

  return (
    <group ref={grupo} position={em}>
      {/* a coluna: aberta em cima e embaixo, vista dos dois lados */}
      <mesh>
        <cylinderGeometry args={[raio, raio, 2.6, 28, 1, true]} />
        <meshBasicMaterial
          color={cor} transparent opacity={0.3}
          side={THREE.DoubleSide} depthWrite={false}
        />
      </mesh>
      {/* o anel no chão, que é o que dá o PONTO exato */}
      <mesh position={[0, -1.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[raio * 0.72, raio, 36]} />
        <meshBasicMaterial
          color={cor} transparent opacity={0.55}
          side={THREE.DoubleSide} depthWrite={false}
        />
      </mesh>
    </group>
  )
}

export function Aterramento({ posto }: { posto: boolean }) {
  const grupo = useRef<THREE.Group>(null)
  /*
    O CABO PASSA POR FORA DO TRANSFORMADOR.

    Medido na cena: o transformador ocupa x 0,22→1,03, y 6,16→7,15,
    z −0,38→0,39. O traçado antigo tinha um nó em (0,52 · 6,20 · 0,12) —
    dentro dessa caixa nos três eixos. O cabo de aterramento atravessava a
    carcaça, que é a imagem que o cliente mandou.

    Agora ele encosta no poste na altura do transformador (x 0,13, que fica
    entre a face do poste em 0,06 e a face do trafo em 0,22) e passa pela
    frente, em z 0,26 — o poste vai só até z 0,18. Desce pelos dois vãos
    que existem, em vez de pelo meio do equipamento.
  */
  const curva = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.95, 9.20, 0.10),
    new THREE.Vector3(0.62, 8.42, 0.20),
    new THREE.Vector3(0.15, 7.60, 0.27),
    new THREE.Vector3(0.13, 6.40, 0.27),
    new THREE.Vector3(0.24, 4.00, 0.25),
    new THREE.Vector3(0.42, 0.90, 0.30),
    new THREE.Vector3(0.52, 0.04, 0.34),
  ]), [])

  useFrame((_, dt) => {
    const g = grupo.current
    if (!g) return
    const alvo = posto ? 1 : 0
    const e = g.scale.y + (alvo - g.scale.y) * Math.min(1, dt * 6)
    g.scale.setScalar(Math.max(0.0001, e))
    g.visible = e > 0.02
  })

  return (
    <group ref={grupo} scale={0.0001}>
      <mesh>
        <tubeGeometry args={[curva, 40, 0.012, 6, false]} />
        <meshStandardMaterial color="#b87333" roughness={0.42} metalness={0.85} />
      </mesh>
      {/* haste de terra cravada no chão: sem ela o cabo morre no nada */}
      <mesh position={[0.52, 0.22, 0.34]}>
        <cylinderGeometry args={[0.016, 0.016, 0.44, 8]} />
        <meshStandardMaterial color="#9a6b3f" roughness={0.5} metalness={0.8} />
      </mesh>
      {/* grampo no condutor */}
      <mesh position={[0.95, 9.20, 0.10]}>
        <boxGeometry args={[0.07, 0.09, 0.07]} />
        <meshStandardMaterial color="#d8dde2" roughness={0.35} metalness={0.9} />
      </mesh>
    </group>
  )
}

/** Cadeado e etiqueta na chave. Vermelho porque etiqueta de bloqueio é. */
export function Bloqueio({ posto }: { posto: boolean }) {
  if (!posto) return null
  return (
    <group position={[0.46, 7.52, 0.0]}>
      <mesh>
        <boxGeometry args={[0.02, 0.16, 0.11]} />
        <meshStandardMaterial
          color="#d3302a" roughness={0.6}
          emissive="#5a0f0c" emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[0, 0.11, 0]}>
        <torusGeometry args={[0.035, 0.008, 6, 14, Math.PI]} />
        <meshStandardMaterial color="#cfd4d9" roughness={0.3} metalness={0.9} />
      </mesh>
    </group>
  )
}

/** Cobertura isolante na rede vizinha: mangote laranja por cima do cabo. */
export function Cobertura({ posta }: { posta: boolean }) {
  if (!posta) return null
  return (
    <mesh position={[-0.95, 9.22, 0.10]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.055, 0.055, 1.5, 10]} />
      <meshStandardMaterial color="#d2641c" roughness={0.65} />
    </mesh>
  )
}

/* ====================================================================
   A CIDADE EM VOLTA
   ====================================================================
   A ocorrência acontecia num descampado: uma fileira de casas atrás do
   poste e, fora dela, chão liso até o horizonte. Pior, os condutores
   iam de z −19 a z +19 e TERMINAVAM NO AR — não havia poste nenhum nas
   pontas segurando a linha.

   Nada disto é modelo novo: são as peças que `via.glb` já tem, as
   mesmas do trajeto, instanciadas aqui. O catálogo inteiro da via são
   8.984 triângulos, então povoar sai quase de graça.

   CONVENÇÃO: no trajeto o veículo olha para +Z e as casas olham para
   −X (a rua é o eixo Z). Aqui a rua corre em X e a linha de
   distribuição em Z, então tudo que veio da via entra girado 90°.
   ==================================================================== */

/** Sorteio preso à posição: a mesma cena em toda partida. */
function sorte(i: number) {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

type Posta = {
  peca: string
  pos: [number, number, number]
  giro: number
  escala?: number
}

/**
 * Onde cada coisa vai — e, principalmente, onde NÃO vai.
 *
 * A primeira tentativa encheu as duas calçadas e tapou a cena: as câmeras
 * desta fase vivem entre z = 3,7 e z = 13, do lado de lá da rua, e uma
 * árvore de 5,3 m plantada em z = 7,4 fica a quatro metros da lente. O
 * quadro do briefing virou duas folhagens verdes.
 *
 * O corredor livre sai das câmeras, não do gosto. Lendo as sete vistas da
 * fase, a mais recuada é a do briefing, em z = 12, mirando z = 0:
 *
 *     z  <  0   atrás do poste — é fundo, pode tudo
 *     z 0..13   CORREDOR DE VISADA — só o que for rasteiro
 *     z > 13    atrás de todas as câmeras — pode tudo de novo
 *
 * Por isso o lado de lá da rua começa só em z = 20: de dentro do jogo ele
 * aparece como fundo atrás do poste, que é o que uma rua tem mesmo.
 */
const CIDADE: Posta[] = (() => {
  const saida: Posta[] = []

  // POSTES NAS PONTAS DA LINHA. Os condutores já iam até ±19 e não havia
  // nada segurando eles — a linha nascia e morria no ar.
  for (const z of [-19, 19, -39, 39]) {
    saida.push({ peca: 'poste', pos: [0, 0, z], giro: 0 })
  }
  // e a linha segue além deles: `via_cabos` tem 40 m, centrado na origem
  for (const z of [-39, 39]) {
    saida.push({ peca: 'cabos', pos: [0, 0, z], giro: 0 })
  }

  // CASAS DO LADO DE LÁ, em z 20 — atrás de todas as câmeras
  for (let i = 0; i < 10; i++) {
    const x = -38 + i * 8.6 + sorte(i) * 1.4
    saida.push({
      peca: ['casa', 'casa_b', 'casa_c'][Math.floor(sorte(i * 3) * 3)],
      pos: [x, 0, 20 + sorte(i * 7) * 1.6],
      giro: -Math.PI / 2,
    })
  }
  // o quarteirão de cá continua para os lados, onde ele terminava em corte
  for (let i = 0; i < 6; i++) {
    const lado = i < 3 ? -1 : 1
    saida.push({
      peca: ['casa_c', 'casa', 'casa_b'][i % 3],
      pos: [lado * (21 + (i % 3) * 8.2), 0, -9 - sorte(i * 5) * 1.5],
      giro: Math.PI / 2,
    })
  }

  // ÁRVORES: as de cá ficam atrás do poste; as de lá, atrás das câmeras
  for (let i = 0; i < 14; i++) {
    const x = -36 + i * 5.4 + sorte(i * 11) * 2.2
    // nada rente ao serviço: árvore em cima do poste tapa a própria cena
    if (Math.abs(x) > 9) {
      saida.push({
        peca: 'arvore', pos: [x, 0, -4.2 - sorte(i) * 0.9],
        giro: sorte(i * 13) * 6.28, escala: 0.85 + sorte(i * 17) * 0.35,
      })
    }
    saida.push({
      peca: 'arvore', pos: [x + 2.6, 0, 15.5 + sorte(i * 2) * 1.2],
      giro: sorte(i * 19) * 6.28, escala: 0.9 + sorte(i * 23) * 0.3,
    })
  }

  // ARBUSTOS no muro de cá: 1,7 m, baixos o bastante para não tapar nada
  for (let i = 0; i < 12; i++) {
    const x = -30 + i * 5.4 + sorte(i * 19) * 2
    if (Math.abs(x) < 5) continue
    saida.push({ peca: 'arbusto', pos: [x, 0, -4.9], giro: sorte(i * 23) * 6.28 })
  }

  // CARROS ESTACIONADOS na guia de lá, longe no eixo da rua: dentro do
  // corredor eles ficariam entre a lente e o poste
  for (const [i, x] of [-44, -30, 22, 34, 46].entries()) {
    saida.push({
      peca: 'carro', pos: [x + sorte(i * 29) * 1.4, 0, 5.4],
      // o carro da via anda em +Z; estacionado nesta rua ele fica em X
      giro: Math.PI / 2 + (sorte(i * 31) - 0.5) * 0.05,
    })
  }
  return saida
})()

/** Instancia as peças da via em volta da ocorrência. */
export function CidadeAoRedor() {
  const { scene } = useGLTF(VIA, DRACO)

  const copias = useMemo(() => CIDADE.map((p, i) => {
    const base = scene.getObjectByName(`via_${p.peca}`)
    if (!base) return null
    const c = base.clone(true)
    c.visible = true
    c.position.set(...p.pos)
    c.rotation.y = p.giro
    if (p.escala) c.scale.setScalar(p.escala)
    c.traverse((o) => {
      const m = o as THREE.Mesh
      // sombra SÓ de receber: 40 peças projetando sombra a 35 m do poste
      // estouram o mapa de sombra da cena, e nenhuma delas aparece de perto
      if (m.isMesh) { m.castShadow = false; m.receiveShadow = true }
    })
    return <primitive key={`${p.peca}_${i}`} object={c} />
  }).filter(Boolean), [scene])

  return <>{copias}</>
}

/**
 * O ELETRICISTA, com uma pose por nó.
 *
 * O `.glb` traz quatro corpos inteiros — `el_parado`, `el_trabalhando`,
 * `el_choque`, `el_subindo` — e aqui liga-se um de cada vez. É o mesmo padrão
 * do EPI no vestiário, e pelo mesmo motivo: o pipeline assa a pose na malha,
 * não há esqueleto, e rigar as peças de roupa (que são recortadas da pele)
 * seria meio dia com risco de quebrar o EPI inteiro. A 7 m da câmera, com
 * 120 px de altura, trocar entre poses assadas lê como animação.
 *
 * ONDE ELE FICA: no cesto do caminhão, que é de onde se trabalha numa chave
 * a 7,7 m. A primeira versão o pôs nos degraus do poste porque a lança não
 * alcançava — e ele acabou DENTRO DO TRANSFORMADOR, que ocupa exatamente
 * aquela altura. A correção não foi mover o boneco: foi fazer a lança
 * esticar e girar (ver `miraDoCesto`), que é o que equipamento de verdade
 * faz.
 */
export type PoseEletricista =
  | 'parado' | 'trabalhando' | 'choque' | 'subindo' | 'radio'

export function Eletricista({
  pose, caminhao, subindo, giro = 0, altura = 0.06, fisico,
}: {
  pose: PoseEletricista
  /**
   * O FÍSICO QUE O JOGADOR MONTOU no vestiário.
   *
   * Sem isto o homem no cesto era outra pessoa — altura padrão, tom de pele
   * padrão — e o cliente reparou na hora: "o personagem não é o que eu
   * criei? acaba com a imersão". Ele tem razão, e o conserto é barato
   * porque o `.glb` do eletricista é assado com o MESMO tom neutro do
   * personagem em pé. Tom e cabelo são multiplicação no material; a altura
   * é escala da malha, não do grupo, senão a altura do cesto escalaria
   * junto e o pé sairia do piso.
   */
  fisico?: Fisico
  /** Onde o caminhão está: é dele que sai o caminho do cesto. */
  caminhao: [number, number, number]
  /** 0 lança recolhida, 1 cesto na posição de trabalho. */
  subindo: number
  /** Para que lado ele olha. */
  giro?: number
  /** Quanto os pés ficam acima do piso do cesto. */
  altura?: number
}) {
  const { scene } = useGLTF(ELETRICISTA, DRACO)
  const grupo = useRef<THREE.Group>(null)
  const tremor = useRef(0)
  /** Cópia local da subida do cesto, pela mesma regra e com o mesmo dt. */
  const t = useRef(0)

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true }
    })
    // O MESMO SHEEN BRANCO do motorista e do personagem em pé.
    //
    // Medido aqui: `tecido_epi_uniforme_fr`, a jugular, o cadarço e o
    // absorvedor do talabarte chegam todos com `sheen = 1` e cor BRANCA. O
    // eletricista é quem o jogador olha a fase inteira do reparo, que é a
    // parte que o cliente chama de mais importante — e era justamente a que
    // tinha ficado de fora da correção.
    domarSheen(scene)
    aquecerPele(scene, fisico?.tom)
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__eletricista = scene
    }
  }, [scene, fisico?.tom])

  useEffect(() => {
    if (!fisico) return
    scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial
      if (mat?.name?.startsWith('pele_')) {
        // Sem textura (que é o caso dele), o tom neutro do forno não está em
        // lugar nenhum: o material chega BRANCO. Entra aqui multiplicado
        // pelo tom do jogador, que é a mesma conta que a textura faria.
        const base = mat.map ? [1, 1, 1] : TOM_ASSADO
        mat.color.setRGB(
          base[0] * fisico.tom[0], base[1] * fisico.tom[1], base[2] * fisico.tom[2],
        )
      }
      if (mat?.name === 'cabelo' && fisico.cabelo) mat.color.setRGB(...fisico.cabelo)
    })
  }, [scene, fisico])

  /*
    ONDE ESTÃO OS PÉS DE CADA POSE.
    -----------------------------------------------------------------
    `cestoEm` devolve o CENTRO do cesto — conferido: devolve mesmo, o
    centro da caixa do cesto e a origem do grupo batem na terceira casa.
    O que não bate é a pose: medida em cena, a faixa dos pés de
    `trabalhando` fica 24,7 cm deslocada em x dentro do próprio `.glb`,
    e com isso a botina atravessava a parede do cesto do lado do poste —
    17 cm para fora, medidos.

    O deslocamento é por POSE (cada uma é uma malha assada separada), e
    sai de medir os vértices da faixa de 25 cm acima do piso, que é onde
    só há pé. Medir é melhor que corrigir à mão porque a próxima pose
    exportada se corrige sozinha.
  */
  const centroDosPes = useMemo(() => {
    const mapa: Record<string, [number, number]> = {}
    const v = new THREE.Vector3()
    /*
      MEDIDO NO ESPAÇO DA MALHA, e não no do mundo.

      `o.matrixWorld` já carrega a posição e o GIRO do grupo do cesto, e a
      correção é aplicada no `position` do primitivo, que vive no espaço do
      grupo. Medir num espaço e corrigir no outro deixava a botina 11 cm
      fora da parede mesmo depois da conta certa — a conta estava certa, o
      sistema de coordenadas é que não era.
    */
    scene.updateWorldMatrix(true, true)
    const paraLocal = scene.matrixWorld.clone().invert()
    for (const no of scene.children) {
      if (!no.name.startsWith('el_')) continue
      // piso desta pose, no mesmo espaço
      let piso = Infinity
      const cantos: THREE.Vector3[] = []
      no.traverse((o) => {
        const g = (o as THREE.Mesh).geometry
        const pos = g?.attributes?.position
        if (!pos) return
        for (let i = 0; i < pos.count; i += 3) {
          v.fromBufferAttribute(pos, i)
            .applyMatrix4(o.matrixWorld).applyMatrix4(paraLocal)
          if (v.y < piso) piso = v.y
          cantos.push(v.clone())
        }
      })
      if (cantos.length < 20) continue
      // MEIO DA CAIXA dos pés, e não centroide: o centroide é puxado pelo pé
      // com mais vértices, e com um pé à frente do outro ele cai 16 cm fora
      // do meio. O que tem de caber no cesto é a caixa.
      const teto = piso + 0.25
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, n = 0
      for (const c of cantos) {
        if (c.y > teto) continue
        if (c.x < x0) x0 = c.x
        if (c.x > x1) x1 = c.x
        if (c.z < z0) z0 = c.z
        if (c.z > z1) z1 = c.z
        n++
      }
      if (n > 20) mapa[no.name] = [(x0 + x1) / 2, (z0 + z1) / 2]
    }
    return mapa
  }, [scene])

  useEffect(() => {
    for (const no of scene.children) {
      if (no.name.startsWith('el_')) no.visible = no.name === `el_${pose}`
    }
    if (pose === 'choque') tremor.current = 1
  }, [scene, pose])

  useFrame((estado, dt) => {
    const g = grupo.current
    if (!g) return
    t.current = subirCesto(t.current, subindo, dt)
    const onde = cestoEm(caminhao, t.current)
    onde[1] += altura
    const tempo = estado.clock.elapsedTime

    // O TRANCO. A pose sozinha é uma estátua de braços abertos; o que faz
    // ler como choque é a figura TREMENDO por um segundo. Frequência alta
    // (28 Hz) e amplitude que decai — qualquer coisa mais lenta vira dança.
    if (tremor.current > 0) {
      tremor.current = Math.max(0, tremor.current - dt / 1.1)
      const a = tremor.current * tremor.current
      g.position.set(
        onde[0] + Math.sin(tempo * 28) * 0.035 * a,
        onde[1] + Math.sin(tempo * 33) * 0.022 * a,
        onde[2] + Math.cos(tempo * 25) * 0.030 * a,
      )
      g.rotation.z = Math.sin(tempo * 30) * 0.10 * a
      return
    }

    // parado no cesto: respira e se ajeita, como no vestiário
    g.rotation.z = 0
    const ar = Math.sin(tempo * 1.3)
    g.position.set(onde[0], onde[1] + ar * 0.006, onde[2])
    // o giro da lança leva ele junto: no começo olha para a frente do
    // caminhão, no fim para o poste
    g.rotation.y = giro * t.current
  })

  const escala = (fisico?.altura ?? ALTURA_BASE) / ALTURA_BASE
  const [px, pz] = centroDosPes[`el_${pose}`] ?? [0, 0]

  return (
    <group ref={grupo} rotation={[0, 0, 0]}>
      <primitive
        object={scene}
        scale={escala}
        /* centrado PELOS PÉS no piso do cesto, e não pela origem do `.glb` */
        position={[-px * escala, 0, -pz * escala]}
      />
    </group>
  )
}

const MOVEIS = new Set([
  'oc_veiculo', 'oc_veiculo_lanca', 'oc_veiculo_cesto',
  'oc_cone', 'oc_cavalete', 'oc_fita', 'oc_caixa', 'oc_escada',
])

export type Vista = {
  de: [number, number, number]
  para: [number, number, number]
  lente?: number
}

function campoDe(lente: number, proporcao: number) {
  const alturaSensor = 36 / Math.max(proporcao, 0.0001)
  return (2 * Math.atan(alturaSensor / 2 / lente) * 180) / Math.PI
}

/** Mesma câmera interpolada da cabine: o corte seco desorienta. */
export function CameraDaCena({ vista }: { vista: Vista }) {
  const { camera, size } = useThree()
  const estado = useMemo(
    () => ({ pos: new THREE.Vector3(), mira: new THREE.Vector3(), iniciado: false }),
    [],
  )

  useFrame((_, dt) => {
    const destino = new THREE.Vector3(...vista.de)
    const mira = new THREE.Vector3(...vista.para)
    if (!estado.iniciado) {
      estado.pos.copy(destino)
      estado.mira.copy(mira)
      estado.iniciado = true
    }
    const passo = Math.min(1, dt * 2.4)
    estado.pos.lerp(destino, passo)
    estado.mira.lerp(mira, passo)
    camera.position.copy(estado.pos)
    camera.lookAt(estado.mira)
    const p = camera as THREE.PerspectiveCamera
    const desejado = campoDe(vista.lente ?? 34, size.width / size.height)
    p.fov += (desejado - p.fov) * passo
    p.updateProjectionMatrix()
  })
  return null
}

export function LuzOcorrencia() {
  return (
    <>
      <hemisphereLight args={['#bcd6f2', '#5a5040', 1.5]} />
      <directionalLight
        position={[-14, 20, 10]}
        intensity={3.2}
        castShadow
        shadow-mapSize={[4096, 4096]}
        /* O enquadramento tem de cobrir TUDO o que a câmera vê, não só o poste.
           Com o recorte antigo (28 m x 22 m) a fileira de casas e meio asfalto
           caíam fora, e fora da câmera de sombra nada recebe sombra: dava uma
           faixa clara retangular atravessando a cena — o "bugado" do retorno. */
        shadow-camera-left={-46}
        shadow-camera-right={46}
        shadow-camera-top={46}
        shadow-camera-bottom={-28}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[12, 8, -10]} intensity={0.9} color="#cfe0ff" />
    </>
  )
}

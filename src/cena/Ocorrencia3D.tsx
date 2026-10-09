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
import * as THREE from 'three'

const MODELO = './modelos/ocorrencia.glb'
const DRACO = './draco/gltf/'

useGLTF.preload(MODELO, DRACO)

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
  molde, elevacao, fantasma,
}: { molde: THREE.Object3D; elevacao: number; fantasma?: boolean }) {
  const pecas = useMemo(() => {
    const l = molde.getObjectByName('oc_veiculo_lanca')?.clone(true)
    const c = molde.getObjectByName('oc_veiculo_cesto')?.clone(true)
    if (l) { l.visible = true; if (fantasma) fantasmar(l) }
    if (c) { c.visible = true; if (fantasma) fantasmar(c) }
    return { lanca: l ?? null, cesto: c ?? null }
  }, [molde, fantasma])

  const eixo = useRef<THREE.Group>(null)
  const cestoRef = useRef<THREE.Group>(null)
  const atual = useRef(0)

  useFrame((_, dt) => {
    // sobe devagar: guindaste não é elevador de prédio, e o movimento lento é
    // metade do que faz a cena parecer um equipamento e não um brinquedo
    atual.current += (elevacao - atual.current) * Math.min(1, dt * 0.9)
    const t = atual.current * ELEVACAO_MAX
    if (eixo.current) eixo.current.rotation.z = t
    if (cestoRef.current) {
      const alvo = CESTO_BASE.clone().sub(PINO).applyAxisAngle(EIXO_Z, t).add(PINO)
      cestoRef.current.position.copy(alvo).sub(CESTO_BASE)
    }
  })

  return (
    <>
      <group ref={eixo} position={PINO}>
        {pecas.lanca && (
          <primitive object={pecas.lanca} position={PINO.clone().negate()} />
        )}
      </group>
      <group ref={cestoRef}>
        {pecas.cesto && <primitive object={pecas.cesto} />}
      </group>
    </>
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
export function Aterramento({ posto }: { posto: boolean }) {
  const grupo = useRef<THREE.Group>(null)
  const curva = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.95, 9.20, 0.10),
    new THREE.Vector3(0.75, 8.10, 0.16),
    new THREE.Vector3(0.52, 6.20, 0.12),
    new THREE.Vector3(0.38, 3.40, 0.08),
    new THREE.Vector3(0.46, 0.60, 0.26),
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

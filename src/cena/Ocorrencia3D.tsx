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
import { useGLTF } from '@react-three/drei'
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
  const obj = useMemo(() => {
    const base = molde.getObjectByName(c.peca)
    if (!base) return null
    const clone = base.clone(true)
    clone.visible = true
    return clone
  }, [molde, c.peca])

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
      // o caminhão já entra no lugar certo (ele está CHEGANDO); o resto cai
      g.position.copy(alvo)
      if (c.peca !== 'oc_veiculo') g.position.y += 0.6
    }
    const antes = g.position.x
    g.position.lerp(alvo, Math.min(1, dt * 2.6))
    if (c.peca === 'oc_veiculo') {
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
        <CestoAereo molde={molde} elevacao={c.elevacao ?? 0} />
      )}
    </group>
  )
}

/**
 * A lança e o cesto, que saíram do `.glb` como nós separados exatamente para
 * isto. Parentesco não sobrevive ao glTF, então a montagem é feita aqui: um
 * grupo no pino segura a lança (deslocada de −pino para girar em torno dele),
 * e o cesto recebe a posição já girada, com rotação zero.
 */
function CestoAereo({ molde, elevacao }: { molde: THREE.Object3D; elevacao: number }) {
  const pecas = useMemo(() => {
    const l = molde.getObjectByName('oc_veiculo_lanca')?.clone(true)
    const c = molde.getObjectByName('oc_veiculo_cesto')?.clone(true)
    if (l) l.visible = true
    if (c) c.visible = true
    return { lanca: l ?? null, cesto: c ?? null }
  }, [molde])

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

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
    </group>
  )
}

const MOVEIS = new Set([
  'oc_veiculo', 'oc_cone', 'oc_cavalete', 'oc_fita', 'oc_caixa', 'oc_escada',
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

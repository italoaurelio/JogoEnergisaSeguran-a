/**
 * A cena da ocorrência: poste com transformador na via.
 *
 * O cenário fixo vem assado do Blender. As peças que o jogador posiciona —
 * caminhão, cones, cavalete, fita — são nós separados, instanciados aqui
 * conforme as decisões da fase 3a. É o mesmo padrão do EPI e da cabine: o que
 * o jogador decide, ele vê acontecer.
 */
import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
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

  const copias = useMemo(() => {
    return colocadas.map((c, i) => {
      const molde = scene.getObjectByName(c.peca)
      if (!molde) return null
      const clone = molde.clone(true)
      clone.visible = true
      clone.position.set(...c.pos)
      clone.rotation.y = c.giro ?? 0
      if (c.escala) clone.scale.set(...c.escala)
      clone.name = `${c.peca}_copia_${i}`
      return clone
    }).filter((c): c is THREE.Object3D => c !== null)
  }, [scene, colocadas])

  return (
    <group>
      <primitive object={scene} />
      {copias.map((c) => <primitive key={c.name} object={c} />)}
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

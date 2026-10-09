/**
 * A cabine em 3D, com os estados conferidos ligando e desligando.
 *
 * Mesmo padrão do personagem: o .glb traz os PARES de estado (cinto solto /
 * afivelado, retrovisor desregulado / regulado…) e aqui se liga um de cada
 * par. Mandar corrigir na fase 2 troca o nó — o jogador vê a correção
 * acontecer, em vez de só marcar um visto numa lista.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { GRAO_CABINE, uvPorEixoDominante, vestir } from './texturas'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'

const MODELO = './modelos/cabine.glb'
const DRACO = './draco/gltf/'

useGLTF.preload(MODELO, DRACO)

export type Vista = {
  de: [number, number, number]
  para: [number, number, number]
  lente?: number
}

/** Converte distância focal (mm, sensor de 36 mm) em campo vertical. */
function campoDe(lente: number, proporcao: number) {
  const alturaSensor = 36 / Math.max(proporcao, 0.0001)
  return (2 * Math.atan(alturaSensor / 2 / lente) * 180) / Math.PI
}

export function Cabine({ ligados }: { ligados: string[] }) {
  const { scene } = useGLTF(MODELO, DRACO)
  const [grao, trama] = useTexture(['./tex/grao_nor.jpg', './tex/trama_nor.jpg'])
  const anisotropia = useThree((e) => e.gl.capabilities.getMaxAnisotropy())
  const ativos = useMemo(() => new Set(ligados), [ligados])

  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__cabine = scene
    }
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = true
      m.receiveShadow = true

      // Micro-superfície. A cabine saiu do Blender com 31 materiais e ZERO
      // textura: o reflexo especular era uniforme em toda a peça, em qualquer
      // ângulo, e é isso que faz painel e banco lerem como plástico de
      // brinquedo. Só o RELEVO entra — as cores do interior já foram
      // escolhidas com cuidado e não há razão para mexer nelas.
      uvPorEixoDominante(m.geometry)
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        const material = mat as THREE.MeshStandardMaterial
        if (!material?.name || material.normalMap) continue
        const regra = GRAO_CABINE.find((g) => material.name.startsWith(g.prefixo))
        if (!regra) continue
        vestir(
          material,
          { relevo: regra.mapa === 'trama' ? trama : grao },
          Math.min(8, anisotropia),
          1,
          regra.cm / 100,
        )
      }
    })
  }, [scene, grao, trama, anisotropia])

  // em desenvolvimento, avisa quando um estado pedido não existe no modelo
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const nos = new Set(
      scene.children.filter((o) => o.name.startsWith('est_')).map((o) => o.name),
    )
    const orfaos = ligados.filter((n) => !nos.has(`est_${n}`))
    if (orfaos.length) console.warn('[cabine] estado sem nó:', orfaos.join(', '))
  }, [scene, ligados])

  /** Y de repouso de cada estado, lido uma vez: nem todo nó nasce em zero. */
  const repouso = useRef(new Map<THREE.Object3D, number>())
  /** Estados assentando: nó -> quanto falta (1 a 0). */
  const entrando = useRef(new Map<THREE.Object3D, number>())

  useEffect(() => {
    // só o primeiro nível, pelo mesmo motivo do personagem: as malhas filhas
    // herdam o nome do nó e se esconderiam por dentro do grupo
    for (const no of scene.children) {
      if (!no.name.startsWith('est_')) continue
      if (!repouso.current.has(no)) repouso.current.set(no, no.position.y)
      const mostrar = ativos.has(no.name.slice(4))
      // A CORREÇÃO TEM DE SER VISTA ACONTECENDO.
      //
      // Antes era uma troca de `visible` entre dois quadros: o cinto solto
      // sumia e o afivelado aparecia no mesmo instante, sem transição. O
      // comentário no topo deste arquivo já prometia que "o jogador vê a
      // correção acontecer" — e o que ele via era um pulo. Com 3 cm de queda
      // em 0,3 s o apoio de cabeça SOBE, o cinto DESCE para a fivela e a
      // prancheta POUSA no banco.
      if (mostrar && !no.visible) entrando.current.set(no, 1)
      no.visible = mostrar
    }
  }, [scene, ativos])

  useFrame((_, dt) => {
    if (!entrando.current.size) return
    for (const [no, t] of entrando.current) {
      const base = repouso.current.get(no) ?? 0
      const novo = t - dt / 0.30
      if (novo <= 0) {
        no.position.y = base
        entrando.current.delete(no)
      } else {
        entrando.current.set(no, novo)
        no.position.y = base - 0.03 * novo * novo
      }
    }
  })

  return <primitive object={scene} />
}

/**
 * Leva a câmera até o ponto de observação do item, interpolando.
 *
 * O corte seco entre um item e outro desorienta: quem está conferindo precisa
 * entender que continua dentro da MESMA cabine, só olhando para outro canto.
 */
export function CameraDaVista({ vista, prontidao = 2.6 }: { vista: Vista; prontidao?: number }) {
  const { camera, size } = useThree()
  const alvo = useRef(new THREE.Vector3())
  const olhando = useRef(new THREE.Vector3())
  const iniciado = useRef(false)

  useFrame((_, dt) => {
    const destino = new THREE.Vector3(...vista.de)
    const mira = new THREE.Vector3(...vista.para)
    if (!iniciado.current) {
      alvo.current.copy(destino)
      olhando.current.copy(mira)
      iniciado.current = true
    }
    const passo = Math.min(1, dt * prontidao)
    alvo.current.lerp(destino, passo)
    olhando.current.lerp(mira, passo)
    camera.position.copy(alvo.current)
    camera.lookAt(olhando.current)

    const perspectiva = camera as THREE.PerspectiveCamera
    const desejado = campoDe(vista.lente ?? 30, size.width / size.height)
    perspectiva.fov += (desejado - perspectiva.fov) * passo
    perspectiva.updateProjectionMatrix()
  })

  return null
}

export function LuzCabine() {
  return (
    <>
      {/* interior de veículo é quase todo luz indireta: o que entra pelo vidro
          rebate no forro e no painel. Direcional sozinha deixa a cabine em
          silhueta, como aconteceu no render do Blender. */}
      <hemisphereLight args={['#c9dcf5', '#3a3428', 1.05]} />
      {/* castShadow fica ligado: o <Canvas> do trajeto não pede sombra, e
          então esta luz simplesmente não gera passe lá. Quem usa é a
          conferência da cabine, onde a sombra dá volume ao interior. */}
      <directionalLight
        position={[-2.2, 3.4, -2.6]}
        intensity={2.0}
        castShadow
        /* Sem estes ajustes a luz usava o mapa padrão de 512 px num tronco
           padrão de 5 m para um interior de 2 m: a sombra vinha acneada e
           aparecia como um moiré diagonal nas superfícies claras e planas —
           a folha da prancheta era onde mais se via. O tronco apertado em
           volta da cabine é o que faz os 2048 px renderem de verdade. */
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={9}
        shadow-camera-left={-1.6}
        shadow-camera-right={1.6}
        shadow-camera-top={1.6}
        shadow-camera-bottom={-1.6}
        shadow-bias={-0.0004}
        shadow-normalBias={0.012}
      />
      <directionalLight position={[2.4, 1.6, 1.8]} intensity={0.45} color="#cfe0ff" />
      <pointLight position={[0, 1.25, 0.4]} intensity={0.5} distance={3} decay={2} />
    </>
  )
}

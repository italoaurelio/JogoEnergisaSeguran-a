/**
 * O personagem em 3D, com as peças de EPI ligando e desligando.
 *
 * O .glb traz o corpo e TODAS as peças do catálogo como nós separados; vestir
 * é ligar a visibilidade de umas e desligar as outras. É por isso que o
 * `publicar-arte.sh` exporta com `--join false`.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const MODELO = './modelos/personagem.glb'
// decodificador Draco local: o padrão do drei baixa de CDN, o que quebraria o
// jogo empacotado no Electron e em máquina sem internet
const DRACO = './draco/gltf/'

/** Altura do personagem como ele saiu do Blender, em metros. */
export const ALTURA_BASE = 1.7996

useGLTF.preload(MODELO, DRACO)

export type Fisico = {
  altura: number
  /** Multiplicador da cor da pele sobre o mapa assado em tom neutro. */
  tom: [number, number, number]
}

type Props = {
  fisico: Fisico
  /** Ids do catálogo que devem aparecer vestidos. */
  vestindo: string[]
  /** Giro em radianos; o vestiário deixa o jogador virar o personagem. */
  giro: number
}

export default function Personagem({ fisico, vestindo, giro }: Props) {
  const { scene } = useGLTF(MODELO, DRACO)
  const grupo = useRef<THREE.Group>(null)
  const vestidos = useMemo(() => new Set(vestindo), [vestindo])

  // gancho de inspeção: só em desenvolvimento, para conferir o grafo e os
  // materiais do modelo direto no console do navegador
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__personagem = scene
    }
  }, [scene])

  // sombra e filtragem: uma vez só, não a cada troca de peça
  useEffect(() => {
    scene.traverse((o) => {
      const malha = o as THREE.Mesh
      if (!malha.isMesh) return
      malha.castShadow = true
      malha.receiveShadow = true
      const mat = malha.material as THREE.MeshStandardMaterial
      if (mat?.map) mat.map.anisotropy = 8
    })
  }, [scene])

  // em desenvolvimento, avisa quando um id escolhido não tem nó no modelo —
  // é o sintoma de catálogo e Blender fora de sincronia
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const nos = new Set(
      scene.children.filter((o) => o.name.startsWith('epi_')).map((o) => o.name),
    )
    // peça sem malha é legítima quando a escolha certa é NÃO vestir nada
    // (guardar os adornos no armário); só avisa das outras
    const semMalhaDePropósito = new Set(['nada_no_corpo'])
    const orfas = vestindo.filter(
      (id) => !nos.has(`epi_${id}`) && !semMalhaDePropósito.has(id),
    )
    if (orfas.length) {
      console.warn('[personagem] sem malha no .glb:', orfas.join(', '))
    }
  }, [scene, vestindo])

  useEffect(() => {
    // só os nós do primeiro nível, nunca `traverse`. Uma peça com mais de um
    // material vira um grupo cujas malhas filhas herdam o nome (`epi_botina_
    // isolante_l`, `_1`, ...); percorrendo a árvore inteira cada filho não
    // encontrava o próprio id na lista e se escondia por dentro do grupo que
    // acabara de ser mostrado.
    for (const no of scene.children) {
      if (!no.name.startsWith('epi_')) continue
      no.visible = vestidos.has(no.name.slice(4))
    }
  }, [scene, vestidos])

  useEffect(() => {
    scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial
      if (mat?.name === 'pele_export') mat.color.setRGB(...fisico.tom)
    })
  }, [scene, fisico.tom])

  // o giro é interpolado para o personagem não pular quando o jogador arrasta
  useFrame((_, dt) => {
    if (!grupo.current) return
    const atual = grupo.current.rotation.y
    grupo.current.rotation.y = atual + (giro - atual) * Math.min(1, dt * 9)
  })

  const escala = fisico.altura / ALTURA_BASE

  return (
    <group ref={grupo}>
      <primitive object={scene} scale={escala} />
    </group>
  )
}

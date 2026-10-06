/**
 * O motorista sentado ao volante.
 *
 * Sem ele o cinto afivelado cruza um banco vazio — e o cinto é o item mais
 * importante da conferência do veículo.
 *
 * Ele veste o que o jogador escolheu no vestiário nas duas vagas que se veem
 * sentado: corpo e cabeça. Mostrar EPI completo em quem escolheu boné
 * ensinaria o contrário do que a fase toda quer ensinar.
 */
import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const MODELO = './modelos/motorista.glb'
const DRACO = './draco/gltf/'

useGLTF.preload(MODELO, DRACO)

/** Peças com nó próprio no modelo. As demais escolhas não aparecem sentado. */
const VARIANTES = new Set([
  'vestimenta_fr', 'camisa_algodao', 'colete_refletivo',
  'capacete_b', 'capacete_a', 'bone',
])

/** Cobre o corpo inteiro, então a roupa de baixo sai de cena. */
const COBRE_BASE = new Set(['vestimenta_fr', 'camisa_algodao'])

export function Motorista({ vestindo }: { vestindo: string[] }) {
  const { scene } = useGLTF(MODELO, DRACO)

  const ativos = useMemo(() => {
    const escolhidos = vestindo.filter((id) => VARIANTES.has(id))
    const cobre = escolhidos.some((id) => COBRE_BASE.has(id))
    return new Set(cobre ? escolhidos : ['base_roupa', ...escolhidos])
  }, [vestindo])

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true }
    })
  }, [scene])

  useEffect(() => {
    // só o primeiro nível, pelo mesmo motivo do personagem e da cabine
    for (const no of scene.children) {
      if (!no.name.startsWith('mot_')) continue
      const id = no.name.slice(4)
      // corpo, cabelo e olhos não são variante: estão sempre lá
      no.visible = VARIANTES.has(id) || id === 'base_roupa'
        ? ativos.has(id)
        : true
    }
  }, [scene, ativos])

  return <primitive object={scene} />
}

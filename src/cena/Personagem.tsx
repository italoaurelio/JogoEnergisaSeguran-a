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
  /** Cor absoluta do material `cabelo`. Opcional: o motorista não escolhe. */
  cabelo?: [number, number, number]
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

  /** Peças ainda assentando no corpo: nó -> quanto falta (1 a 0). */
  const entrando = useRef(new Map<THREE.Object3D, number>())

  useEffect(() => {
    // só os nós do primeiro nível, nunca `traverse`. Uma peça com mais de um
    // material vira um grupo cujas malhas filhas herdam o nome (`epi_botina_
    // isolante_l`, `_1`, ...); percorrendo a árvore inteira cada filho não
    // encontrava o próprio id na lista e se escondia por dentro do grupo que
    // acabara de ser mostrado.
    for (const no of scene.children) {
      if (!no.name.startsWith('epi_')) continue
      const mostrar = vestidos.has(no.name.slice(4))
      // peça que ACABOU de entrar assenta de 4 cm acima, em ~0,22 s. Sem
      // isto a roupa troca entre dois quadros e o jogador não vê que vestiu
      // nada — a escolha vira só um texto mudando na lista ao lado.
      if (mostrar && !no.visible) entrando.current.set(no, 1)
      no.visible = mostrar
    }
  }, [scene, vestidos])

  useFrame((_, dt) => {
    if (!entrando.current.size) return
    for (const [no, t] of entrando.current) {
      const novo = t - dt / 0.22
      if (novo <= 0) {
        no.position.y = 0
        entrando.current.delete(no)
      } else {
        entrando.current.set(no, novo)
        // ease-out: cai rápido e encosta devagar
        no.position.y = 0.04 * novo * novo
      }
    }
  })

  useEffect(() => {
    scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial
      if (mat?.name === 'pele_export') mat.color.setRGB(...fisico.tom)
      // o cabelo é nó próprio com material próprio: é a única peça do corpo
      // que dá para variar sem reexportar o modelo
      if (mat?.name === 'cabelo' && fisico.cabelo) mat.color.setRGB(...fisico.cabelo)
    })
  }, [scene, fisico.tom, fisico.cabelo])

  // o giro é interpolado para o personagem não pular quando o jogador arrasta
  useFrame((estado, dt) => {
    const g = grupo.current
    if (!g) return
    const atual = g.rotation.y
    g.rotation.y = atual + (giro - atual) * Math.min(1, dt * 9)

    // RESPIRAÇÃO. O corpo não tem animação de esqueleto, então ela é feita no
    // grupo inteiro: 6 mm de sobe-e-desce e 0,35% de escala, a 14 ciclos por
    // minuto, que é respiração de pessoa parada. É pouco de propósito — a
    // 1 cm já lê como pulo, e o personagem está de pé numa arara, não
    // correndo.
    //
    // Dois períodos incomensuráveis (13 s e 7 s) somam um balanço lento de
    // peso nas pernas. Sem ele a respiração vira metrônomo: o olho acha o
    // compasso em dois ciclos e o boneco volta a parecer um objeto.
    const t = estado.clock.elapsedTime
    const ar = Math.sin(t * 1.466)
    g.position.y = ar * 0.006
    const e = 1 + ar * 0.0035
    g.scale.set(e, e, e)
    g.rotation.z = Math.sin(t / 13) * 0.004 + Math.sin(t / 7) * 0.0022
  })

  const escala = fisico.altura / ALTURA_BASE

  return (
    <group ref={grupo}>
      <primitive object={scene} scale={escala} />
    </group>
  )
}

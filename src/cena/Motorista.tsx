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
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/** Mesma curva de entra-e-sai da respiração do personagem em pé. */
function suave(x: number) {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}

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

/**
 * O QUADRIL DO MOTORISTA, em coordenadas do jogo.
 *
 * É o eixo em torno do qual um corpo sentado se mexe: tronco, ombro e cabeça
 * giram sobre a bacia, não sobre o chão da cabine. Sai de `BACIA` em
 * `exportar_motorista.py` — (0, 0,16, 0,455) no Blender — convertido para o
 * jogo (x, z, −y) e deslocado para o lugar do motorista em x.
 */
const EIXO_QUADRIL: [number, number, number] = [0.38, 0.455, -0.16]

export function Motorista({ vestindo }: { vestindo: string[] }) {
  const { scene } = useGLTF(MODELO, DRACO)
  const quadril = useRef<THREE.Group>(null)

  /*
    O MOTORISTA ESTAVA COMPLETAMENTE PARADO.
    ---------------------------------------------------------------------
    Não era "pouca animação": era nenhuma. Este componente não tinha um
    `useFrame`, e o .glb traz a pose assada na malha — então o que a fase 2
    mostrava era uma estátua sentada num banco, com a câmera passeando em
    volta. O retorno do cliente foi "adicione mais animação, principalmente
    dele dentro do veículo".

    Sem esqueleto no modelo não dá para mexer braço nem cabeça, mas o corpo
    inteiro pode se mexer sobre o QUADRIL, que é como gente sentada se mexe
    de verdade. São três coisas somadas, todas pequenas de propósito:

      respirar   o peito sobe 5 mm e o tronco roda 0,4° para trás, em ciclo
                 assimétrico (inspira rápido, solta devagar, pausa)
      acomodar   troca de apoio no banco a cada ~9 s, 0,6° de rolagem
      olhar      o tronco gira ±1,1° em torno do eixo vertical, devagar

    Nenhuma delas é perceptível sozinha. Juntas, a diferença entre um
    manequim e alguém esperando a hora de dar a partida.
  */
  useFrame(({ clock }) => {
    const g = quadril.current
    if (!g) return
    const t = clock.elapsedTime

    const CICLO = 4.8
    const f = (t % CICLO) / CICLO
    const ar = f < 0.3 ? suave(f / 0.3)
      : f < 0.85 ? 1 - suave((f - 0.3) / 0.55)
      : 0
    g.position.y = EIXO_QUADRIL[1] + ar * 0.005
    g.rotation.x = -ar * 0.007

    const acomoda = Math.sin(t / 9) * 0.7 + Math.sin(t / 5.3) * 0.3
    g.rotation.z = acomoda * 0.010
    g.rotation.y = Math.sin(t / 13) * 0.019 + Math.sin(t / 7.1) * 0.006
  })

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

  return (
    <group ref={quadril} position={EIXO_QUADRIL}>
      <group position={EIXO_QUADRIL.map((v) => -v) as [number, number, number]}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

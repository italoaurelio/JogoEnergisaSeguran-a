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
import { aquecerPele, domarSheen } from './texturas'

const MODELO = './modelos/personagem.glb'
// decodificador Draco local: o padrão do drei baixa de CDN, o que quebraria o
// jogo empacotado no Electron e em máquina sem internet
const DRACO = './draco/gltf/'

/** Curva de aceleração e freada, para o ar entrar e sair como ar. */
function suavizar(x: number) {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}

/** Altura do personagem como ele saiu do Blender, em metros.
 *
 * Sai de `arte/export/personagem.json` (campo `altura`) e muda quando a POSE
 * muda: com os braços descidos e as coxas fechadas o personagem perdeu 4 mm.
 * Quem reexportar com pose nova tem de reler este número daqui, senão a
 * escolha de altura do jogador passa a errar por essa diferença. */
export const ALTURA_BASE = 1.7982

useGLTF.preload(MODELO, DRACO)

export type Fisico = {
  altura: number
  /** Multiplicador da cor da pele sobre o mapa assado em tom neutro. */
  tom: [number, number, number]
  /** Cor absoluta do material `cabelo`. Opcional: o motorista não escolhe. */
  cabelo?: [number, number, number]
  /** Qual dos três cortes. Geometria, não cor: são três peças no `.glb`. */
  corte?: 'curto' | 'medio' | 'raspado'
}

type Props = {
  fisico: Fisico
  /** Ids do catálogo que devem aparecer vestidos. */
  vestindo: string[]
  /** Giro em radianos; o vestiário deixa o jogador virar o personagem. */
  giro: number
  /**
   * COMO ELE ESTÁ. Muda só o jeito de ficar parado, e isso basta.
   *
   * O `.glb` sai do Blender sem esqueleto — o exportador apaga a armadura
   * depois de aplicar a pose. Então não há como dobrar um braço em tempo de
   * jogo, e prometer "animação de tristeza" seria prometer um round de
   * Blender inteiro. O que dá para fazer sem rig é o que o corpo faz
   * sozinho: respirar mais fundo e mais devagar, afundar os ombros, inclinar
   * o tronco para a frente. Visto de dois metros, é o que separa alguém
   * satisfeito de alguém levando bronca.
   */
  animo?: 'triste' | 'ok' | 'feliz'
}

export default function Personagem({ fisico, vestindo, giro, animo = 'ok' }: Props) {
  const { scene } = useGLTF(MODELO, DRACO)
  // mesmo uniforme, mesmo sheen branco vindo do forno
  useEffect(() => { domarSheen(scene) }, [scene])
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

  /**
   * O Y DE REPOUSO de cada peça, lido uma vez antes de qualquer animação.
   *
   * A animação de assentar somava 4 cm em `position.y` e, ao terminar,
   * zerava o campo. Isso só está certo para peça cuja origem já é zero — e
   * `epi_capacete_b` tem origem na CABEÇA (0, 1,60, 0,052). Resultado: o
   * capacete certo, o único da fase que dá ponto cheio, caía no chão entre
   * os pés do personagem no instante em que era vestido, e ficava lá. Toda
   * peça com origem própria tinha o mesmo destino.
   */
  const repouso = useRef(new Map<THREE.Object3D, number>())

  useEffect(() => {
    // o repouso é lido aqui, e não no quadro em que a peça entra: naquele
    // momento o Y já pode estar deslocado pela animação anterior
    for (const no of scene.children) {
      if (no.name.startsWith('epi_') && !repouso.current.has(no)) {
        repouso.current.set(no, no.position.y)
      }
    }
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

    /*
      O CABELO SOB O CAPACETE É OUTRA PEÇA.

      A documentação de `humano.cabelo` prometia desde sempre que "o cabelo
      some junto quando entra o capacete", e isso nunca foi ligado: com o
      volume de 2,7 cm do corte médio, o cabelo atravessava o casco — foi a
      foto que o cliente mandou.

      Sumir inteiro também está errado: capacete não deixa a pessoa careca,
      deixa à mostra a nuca e a costeleta. Por isso a troca é por
      `cabelo_capacete`, que é o mesmo recorte cortado abaixo da linha do
      casco.
    */
    const comCapacete = [...vestidos].some((id) => id.startsWith('capacete'))
    const alvoCabelo = comCapacete
      ? 'cabelo_capacete'
      : `cabelo_${fisico.corte ?? 'medio'}`
    for (const no of scene.children) {
      if (no.name.startsWith('cabelo')) no.visible = no.name === alvoCabelo
    }
  }, [scene, vestidos, fisico.corte])

  useFrame((_, dt) => {
    if (!entrando.current.size) return
    for (const [no, t] of entrando.current) {
      const base = repouso.current.get(no) ?? 0
      const novo = t - dt / 0.22
      if (novo <= 0) {
        no.position.y = base
        entrando.current.delete(no)
      } else {
        entrando.current.set(no, novo)
        // ease-out: cai rápido e encosta devagar
        no.position.y = base + 0.04 * novo * novo
      }
    }
  })

  useEffect(() => {
    // o calor da pele anda junto com o tom: no tom 8 o multiplicador e' 0,40,
    // e um vermelho fixo por baixo dele viraria brasa
    aquecerPele(scene, fisico.tom)
    scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial
      if (mat?.name === 'pele_export') mat.color.setRGB(...fisico.tom)
      // o cabelo é nó próprio com material próprio: é a única peça do corpo
      // que dá para variar sem reexportar o modelo
      if (mat?.name === 'cabelo' && fisico.cabelo) mat.color.setRGB(...fisico.cabelo)
    })
  }, [scene, fisico.tom, fisico.cabelo])

  /** O giro já interpolado, sem a oscilação de ocioso somada por cima. */
  const giroBase = useRef(0)

  useFrame((estado, dt) => {
    const g = grupo.current
    if (!g) return
    giroBase.current += (giro - giroBase.current) * Math.min(1, dt * 9)

    const t = estado.clock.elapsedTime

    // RESPIRAÇÃO, e não uma senoide.
    //
    // Pessoa parada inspira em ~1,5 s, solta em ~2,5 s e fica meio segundo
    // sem fazer nada antes da próxima. A senoide gasta o mesmo tempo nas
    // duas metades, e é isso que faz o boneco pulsar como um balão em vez de
    // respirar. Aqui o ciclo é dividido em três trechos de duração diferente.
    // peito arriado respira mais devagar; peito aberto, mais solto
    const CICLO = animo === 'triste' ? 5.9 : animo === 'feliz' ? 3.9 : 4.6
    const f = (t % CICLO) / CICLO
    let ar: number
    if (f < 0.33) ar = suavizar(f / 0.33)              // inspira, rápido
    else if (f < 0.87) ar = 1 - suavizar((f - 0.33) / 0.54)  // solta, devagar
    else ar = 0                                         // pausa
    // o abatido AFUNDA: 2 cm de ombro para baixo é pouco no número e muito
    // no olho, porque muda a silhueta inteira contra o fundo
    const afunda = animo === 'triste' ? -0.021 : animo === 'feliz' ? 0.006 : 0
    g.position.y = ar * 0.007 + afunda
    const e = 1 + ar * (animo === 'triste' ? 0.006 : 0.004)
    g.scale.set(e, e, e)

    // PESO DE UM PÉ PARA O OUTRO.
    //
    // Ninguém fica parado em pé com o peso dividido: o corpo troca de apoio
    // a cada dez ou quinze segundos. São 9 mm de lado e 0,5° de inclinação —
    // de propósito pouco, porque a 2 m de distância 1 cm já lê como passo.
    // Dois períodos incomensuráveis (11 s e 6,5 s) evitam que o olho ache o
    // compasso, que é o que denuncia a animação.
    // quem está mal troca menos de pé; quem está bem, mais
    const inquieto = animo === 'triste' ? 0.45 : animo === 'feliz' ? 1.4 : 1
    const peso = Math.sin(t / 11) * 0.7 + Math.sin(t / 6.5) * 0.3
    g.position.x = peso * 0.009 * inquieto
    g.rotation.z = peso * 0.009 * inquieto

    // e um giro de tronco lento por cima do giro que o jogador escolheu
    g.rotation.y = giroBase.current + Math.sin(t / 17) * 0.022
    // tronco para a frente quando é bronca, e um dedo para trás quando não é
    const pende = animo === 'triste' ? 0.085 : animo === 'feliz' ? -0.022 : 0
    g.rotation.x = Math.sin(t / 13) * 0.006 + pende
  })

  const escala = fisico.altura / ALTURA_BASE

  return (
    <group ref={grupo}>
      <primitive object={scene} scale={escala} />
    </group>
  )
}

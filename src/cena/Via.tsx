/**
 * O mundo do trajeto, correndo por baixo da cabine.
 *
 * Quem se move é o cenário: a cabine fica na origem e cada peça da via é
 * reposicionada a cada quadro conforme a distância percorrida. É o que permite
 * um trajeto de 2 km com onze malhas no total — e é também o que mantém a
 * câmera estável, que importa para quem enjoa fácil.
 *
 * Eixos do jogo: o veículo olha para +Z, a faixa dele é centrada em x=0 e o
 * eixo da via fica em x=+1,75 (mão direita).
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import {
  aplicarPerfil, criarDobra, dobrarMaterial, type NoTracado,
} from './curva'
import { uvPorPosicao, vestir } from './texturas'
import { som } from '../som'
import {
  ALCANCE, BORDA_DIR, BORDA_ESQ, POOL, TRECHO, paisagem, type Marco,
} from './paisagem'

export { ALCANCE, BORDA_DIR, BORDA_ESQ, POOL, TRECHO, paisagem }
export type { Marco }

const MODELO = './modelos/via.glb'
const DRACO = './draco/gltf/'

/** Comprimento de um trecho, em metros. Tem de bater com via.py. */
/** Até onde o mundo é desenhado à frente. */
/** Faixa contrária: do outro lado do eixo da via, que fica em x = +1,75. */
const CONTRA_X = 3.5
/** Velocidade de quem vem de frente, em m/s (≈ 50 km/h). */
const VELOCIDADE_CONTRA = 14
/** Distância entre um veículo e o seguinte na fila contrária. */
// 52 m, não 95: o que governa quantos carros se vê é o VÃO, não a contagem.
// Com 95 m e 320 m de alcance passavam três no campo inteiro, e a via lia
// como deserta mesmo com mais veículos no pool.
const VAO_CONTRA = 52

/** Borda do lado do motorista e borda oposta, em x. */

useGLTF.preload(MODELO, DRACO)

/** Pool de cópias de uma peça, recicladas conforme o mundo corre. */
function Fileira({
  molde, marcos, distancia, limite = 14,
}: {
  molde: THREE.Object3D | null
  marcos: Marco[]
  distancia: React.RefObject<number>
  limite?: number
}) {
  const grupo = useRef<THREE.Group>(null)

  const copias = useMemo(() => {
    if (!molde) return []
    return Array.from({ length: limite }, () => {
      const c = molde.clone(true)
      c.visible = false
      return c
    })
  }, [molde, limite])

  useEffect(() => {
    const g = grupo.current
    if (!g) return
    copias.forEach((c) => g.add(c))
    return () => { copias.forEach((c) => g.remove(c)) }
  }, [copias])

  useFrame(() => {
    const d = distancia.current ?? 0
    let usadas = 0
    for (const marco of marcos) {
      const z = marco.metro - d
      if (z < -TRECHO || z > ALCANCE) continue
      const c = copias[usadas]
      if (!c) break
      c.position.set(marco.x, 0, z)
      c.rotation.y = marco.giro ?? 0
      c.visible = true
      usadas++
    }
    for (let i = usadas; i < copias.length; i++) copias[i].visible = false
  })

  return <group ref={grupo} />
}

/** A pista, que é uma fileira contínua e por isso tem regra própria. */
function Pista({
  molde, distancia,
}: { molde: THREE.Object3D | null; distancia: React.RefObject<number> }) {
  const quantos = Math.ceil(ALCANCE / TRECHO) + 2
  const grupo = useRef<THREE.Group>(null)

  const copias = useMemo(() => {
    if (!molde) return []
    return Array.from({ length: quantos }, () => molde.clone(true))
  }, [molde, quantos])

  useEffect(() => {
    const g = grupo.current
    if (!g) return
    copias.forEach((c) => g.add(c))
    return () => { copias.forEach((c) => g.remove(c)) }
  }, [copias])

  useFrame(() => {
    const d = distancia.current ?? 0
    const resto = ((d % TRECHO) + TRECHO) % TRECHO
    copias.forEach((c, i) => {
      c.position.set(0, 0, (i - 1) * TRECHO - resto)
    })
  })

  return <group ref={grupo} />
}

/**
 * Tráfego no sentido oposto.
 *
 * O cliente pediu "outros carros" e "tráfego no sentido oposto" olhando um
 * trajeto que era uma reta vazia. É só cenário — não entra na pontuação, não
 * invade a faixa do jogador e não exige decisão nenhuma. O que ele faz é
 * fazer a via parecer uma via: um veículo cruzando a cada poucos segundos
 * muda a leitura do trecho mais do que qualquer árvore a mais.
 *
 * Como não vale nota, a posição pode andar com o RELÓGIO em vez de com o
 * metro do trajeto — a regra de cenário determinístico existe para a prova
 * ser comparável entre colaboradores, e aqui não há o que comparar.
 */
function Contrafluxo({
  molde, distancia, quantos = 11, vao = VAO_CONTRA, deslocamento = 0,
  velocidade = VELOCIDADE_CONTRA, x = CONTRA_X, forcaSom = 1,
}: {
  molde: THREE.Object3D | null
  distancia: React.RefObject<number>
  quantos?: number
  /** Metros entre um veículo e o seguinte desta fila. */
  vao?: number
  /** Desencontra esta fila da outra, para não nascerem lado a lado. */
  deslocamento?: number
  /** m/s. Fila mais rápida nunca fica emparelhada com a mais lenta. */
  velocidade?: number
  /** Posição lateral. A moto anda no corredor, não no meio da faixa. */
  x?: number
  /** Volume do "fiuu" ao cruzar. A moto passa mais perto, então soa mais. */
  forcaSom?: number
}) {
  const grupo = useRef<THREE.Group>(null)

  const copias = useMemo(() => {
    if (!molde) return []
    return Array.from({ length: quantos }, () => {
      const c = molde.clone(true)
      // meia-volta: ele vem de frente
      c.rotation.y = Math.PI
      c.position.x = x
      c.visible = false
      return c
    })
  }, [molde, quantos])

  useEffect(() => {
    const g = grupo.current
    if (!g) return
    copias.forEach((c) => g.add(c))
    return () => { copias.forEach((c) => g.remove(c)) }
  }, [copias])

  // Onde cada um está, em metros de trajeto. Preenchido no primeiro quadro a
  // partir de onde o jogador começa — o atalho `?m=` pode largar a fase no
  // meio, e nascer todos em zero deixaria a estrada vazia até alcançá-los.
  const posicoes = useRef<number[] | null>(null)
  /** z do quadro anterior, para saber QUANDO cada um cruza o jogador. */
  const antes = useRef<number[]>([])

  useFrame((_, bruto) => {
    const dt = Math.min(bruto, 0.05)
    const d = distancia.current ?? 0
    if (!posicoes.current) {
      posicoes.current = copias.map((_, i) => d + 60 + deslocamento + i * vao)
      antes.current = posicoes.current.map((v) => v - d)
    }
    const p = posicoes.current
    for (let i = 0; i < copias.length; i++) {
      p[i] -= velocidade * dt
      // passou do jogador: volta para o fim da fila, lá na frente. O resto da
      // divisão por 5 (e não por 3) evita que os reciclados voltem sempre nas
      // mesmas três distâncias e formem comboio visível.
      // Recicla ATRÁS DO ÚLTIMO, não numa das cinco posições fixas que a
      // conta antiga usava. Com cinco destinos possíveis e onze veículos,
      // dois que reciclam perto um do outro caíam no MESMO ponto — e, como
      // todos andam na mesma velocidade, ficavam grudados para sempre.
      // Medido dirigindo a fase: dois carros em z=0 exatamente, e outro par
      // a 5 m, que é menos que o comprimento de um carro.
      //
      // Entrar no fim da fila mantém o vão constante por construção.
      if (p[i] < d - 25) {
        let ultimo = d + ALCANCE
        for (let j = 0; j < p.length; j++) if (j !== i && p[j] > ultimo) ultimo = p[j]
        p[i] = ultimo + vao
      }
      const z = p[i] - d
      // cruzou o jogador neste quadro: é agora que o "fiuu" tem de soar,
      // senão o som chega depois do carro já ter sumido do retrovisor
      if ((antes.current[i] ?? 999) > 2 && z <= 2) som.passagem(forcaSom)
      antes.current[i] = z
      copias[i].position.z = z
      copias[i].visible = z > -25 && z < ALCANCE
    }
  })

  return <group ref={grupo} />
}

/**
 * O pedestre da faixa.
 *
 * A fase manda "pare e deixe atravessar" desde sempre e não havia ninguém na
 * faixa: o jogador parava por causa de um texto. É o mesmo defeito do cinto
 * que não aparecia em quadro — a decisão sem a imagem.
 *
 * Ele ESPERA no meio-fio enquanto o veículo se aproxima e só atravessa depois
 * que `liberado` vira — que é quando o jogador ficou parado 1,6 s. Essa ordem
 * importa: pedestre que atravessa sozinho, antes de o motorista parar, ensina
 * que dá para passar que ele se vira.
 */
function Pedestre({
  molde, distancia, metro, liberado,
}: {
  molde: THREE.Object3D | null
  distancia: React.RefObject<number>
  metro: number | null
  liberado: React.RefObject<boolean>
}) {
  const grupo = useRef<THREE.Group>(null)
  const obj = useMemo(() => {
    if (!molde) return null
    const c = molde.clone(true)
    c.visible = true
    return c
  }, [molde])
  /** 0 parado no meio-fio, 1 do outro lado. */
  const avanco = useRef(0)

  useFrame((_, bruto) => {
    const g = grupo.current
    if (!g || metro == null) return
    const dt = Math.min(bruto, 0.05)
    const z = metro - (distancia.current ?? 0)
    // 7 s para atravessar os 8,7 m: ~1,2 m/s, que é passo de gente comum
    if (liberado.current) avanco.current = Math.min(1, avanco.current + dt / 7)
    const x = DE_PE_X + (ATE_PE_X - DE_PE_X) * avanco.current
    g.position.set(x, 0, z)
    g.visible = z > -30 && z < ALCANCE
  })

  if (!obj) return null
  return <group ref={grupo}><primitive object={obj} /></group>
}

/** Meio-fio de onde ele sai e meio-fio onde ele chega. */
const DE_PE_X = BORDA_DIR - 0.85
const ATE_PE_X = BORDA_ESQ + 0.85

/**
 * O veículo que sai da garagem.
 *
 * Diferente do contrafluxo, este VALE NOTA — então a posição dele anda com o
 * metro do trajeto, nunca com o relógio: dois colaboradores têm de encontrar
 * exatamente a mesma cena no mesmo ponto, senão a prova não é comparável.
 *
 * Ele começa recolhido na garagem e vai avançando conforme o jogador se
 * aproxima. Se o jogador reduz e espera, o carro completa a manobra e segue
 * — é a mesma regra do pedestre na faixa: quem fez o certo não fica preso.
 */
function Garagem({
  molde, distancia, metro, liberada,
}: {
  molde: THREE.Object3D | null
  distancia: React.RefObject<number>
  /** Onde a garagem fica, em metros de trajeto. Null quando não há. */
  metro: number | null
  /** O Motor levanta quando o jogador esperou; aí o carro sai de cena. */
  liberada: React.RefObject<boolean>
}) {
  const grupo = useRef<THREE.Group>(null)
  const saindo = useRef(0)

  const copia = useMemo(() => molde?.clone(true) ?? null, [molde])

  useFrame((_, bruto) => {
    const g = grupo.current
    if (!g || metro == null) return
    const d = distancia.current ?? 0
    const z = metro - d

    // Quanto da manobra já aconteceu, em função de ONDE o jogador está —
    // não de quanto tempo passou. Começa a 70 m e está na pista a 25 m.
    const avanco = Math.max(0, Math.min(1, (d - (metro - 70)) / 45))

    // liberada: o jogador reduziu e esperou, então ele termina de sair
    if (liberada.current) saindo.current = Math.min(1, saindo.current + bruto * 0.5)

    const lateral = -7.6 + (7.0 * avanco) + (6.5 * saindo.current)
    g.position.set(lateral, 0, z + saindo.current * 14)
    // entra de ré perpendicular à via e vai endireitando
    g.rotation.y = -Math.PI / 2 + (Math.PI / 2) * (avanco * 0.75 + saindo.current * 0.25)
    g.visible = z > -30 && z < 160 && avanco > 0.02
  })

  if (metro == null) return null
  return (
    <group ref={grupo} visible={false}>
      {copia && <primitive object={copia} />}
    </group>
  )
}

export function Mundo({
  distancia, marcos, carro, tracado, sinal, garagem, faixa, pedestreLiberado,
}: {
  distancia: React.RefObject<number>
  marcos: Marco[]
  /** Posição do veículo à frente, em metros de trajeto. Null quando não há. */
  carro: React.RefObject<number | null>
  /** Onde a via dobra e onde sobe. Vazio = reta. */
  tracado: NoTracado[]
  /** Lâmpada acesa do semáforo: 0 verde, 1 amarelo, 2 vermelho. */
  sinal?: React.RefObject<number>
  /** Metro da faixa de pedestre, e se o pedestre já atravessou. */
  faixa: number | null
  pedestreLiberado: React.RefObject<boolean>
  /** Metro da saída de garagem, e se o jogador já cedeu passagem. */
  garagem?: { metro: number | null; liberada: React.RefObject<boolean> }
}) {
  const { scene } = useGLTF(MODELO, DRACO)
  const [asfaltoCor, asfaltoRelevo, terraCor, terraRelevo, gramaCor, gramaRelevo] =
    useTexture([
      './tex/asfalto_diff.jpg', './tex/asfalto_nor.jpg',
      './tex/terra_diff.jpg', './tex/terra_nor.jpg',
      './tex/grama_diff.jpg', './tex/grama_nor.jpg',
    ])
  const anisotropia = useThree((e) => e.gl.capabilities.getMaxAnisotropy())
  const gl = useThree((e) => e.gl)

  // Uma dobra para o mundo inteiro. As cópias compartilham o material do
  // molde (clone não duplica material), então remendar o catálogo uma vez
  // alcança todas as peças em cena.
  const dobra = useMemo(criarDobra, [])

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = true
      m.receiveShadow = true
      // o corte por caixa envolvente é calculado na geometria reta; depois da
      // dobra a peça não está mais lá e o three a descartaria em curva
      m.frustumCulled = false
      uvPorPosicao(m.geometry)
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        dobrarMaterial(mat, dobra)
        const material = mat as THREE.MeshStandardMaterial
        if (material.map) continue
        const anis = Math.min(8, anisotropia)
        if (material.name === 'via_asfalto') {
          // 0,42 e não 0,9: a textura do Poly Haven vem com albedo de
          // ~0,25 e o asfalto do jogo nasceu em 0,042. Clarear demais
          // deixou a pista bege — mais chapada do que antes da textura.
          // Asfalto de verdade fica entre 0,06 e 0,12 de albedo.
          vestir(material, { cor: asfaltoCor, relevo: asfaltoRelevo }, anis, 0.42)
        } else if (material.name === 'via_terra') {
          vestir(material, { cor: terraCor, relevo: terraRelevo }, anis, 0.5)
        } else if (material.name === 'via_mato') {
          // A grama é gerada em arte/gerar_grama.py: não havia nenhuma em
          // arte/tex, e é a maior superfície do trajeto — chapada, era ela
          // que tirava a referência de profundidade e fazia arbusto a 150 m
          // parecer flutuando.
          vestir(material, { cor: gramaCor, relevo: gramaRelevo }, anis, 0.55)
        }
      }
    })
    // o catálogo não entra em cena: só as cópias entram
    scene.visible = false
  }, [scene, dobra, anisotropia, asfaltoCor, asfaltoRelevo, terraCor,
      terraRelevo, gramaCor, gramaRelevo])

  // Pelo MATERIAL, não pelo nó: as lentes são parte da malha do semáforo, e
  // as cópias em cena compartilham o material do molde — acender aqui acende
  // o semáforo que o jogador vê.
  const lampadas = useMemo(() => {
    const achados: Record<string, THREE.MeshStandardMaterial> = {}
    scene.traverse((o) => {
      const malha = o as THREE.Mesh
      if (!malha.isMesh) return
      for (const mat of Array.isArray(malha.material) ? malha.material : [malha.material]) {
        const m = mat as THREE.MeshStandardMaterial
        if (m?.name?.startsWith('via_semaforo_')) achados[m.name] = m
      }
    })
    return ['verde', 'amarela', 'vermelha']
      .map((cor) => achados[`via_semaforo_${cor}`])
  }, [scene])

  useEffect(() => {
    if (import.meta.env.DEV) {
      const w = window as unknown as Record<string, unknown>
      w.__lampadas = lampadas
      // o renderer, para medir custo de quadro sem adivinhar
      w.__gl = gl
      const mats: Record<string, unknown> = {}
      scene.traverse((o) => {
        const malha = o as THREE.Mesh
        if (!malha.isMesh) return
        for (const mat of Array.isArray(malha.material) ? malha.material : [malha.material]) {
          const m = mat as THREE.MeshStandardMaterial
          if (!m?.name?.startsWith('via_')) continue
          mats[m.name] = {
            cor: m.color.getHexString(),
            mapa: m.map ? ((m.map.image as { src?: string })?.src ?? 'sim').split('/').pop() : null,
            repete: m.map ? +m.map.repeat.x.toFixed(3) : null,
            uv: !!malha.geometry.getAttribute('uv'),
            normal: !!m.normalMap,
          }
        }
      })
      w.__viaMats = mats
    }
  }, [lampadas, scene, gl])

  useFrame(() => {
    aplicarPerfil(dobra, tracado, distancia.current ?? 0)
    const acesa = sinal?.current ?? 0
    lampadas.forEach((mat, i) => {
      // 16, não 5: a 40 m a lente tem três pixels na tela, e é o BLOOM que
      // transforma esses três pixels num ponto de luz que se lê de longe —
      // como acontece com um semáforo de verdade. Abaixo do limiar do bloom
      // (0,75) a lâmpada acesa fica indistinguível da apagada.
      if (mat) mat.emissiveIntensity = i === acesa ? 16 : 0.02
    })
  })

  // todos os moldes de uma vez: buscar peça a peça dentro do map quebraria a
  // regra dos hooks (useMemo em laço)
  const moldes = useMemo(() => {
    const nomes = ['trecho', 'chao', 'poste', 'cabos', 'arvore', 'arbusto',
      'casa', 'placa', 'lombada', 'faixa_pedestre', 'carro', 'semaforo',
      'onibus', 'ciclista', 'escola', 'moto', 'pedestre', 'crianca'] as const
    const mapa: Record<string, THREE.Object3D | null> = {}
    for (const n of nomes) mapa[n] = scene.getObjectByName(`via_${n}`) ?? null
    return mapa
  }, [scene])

  const porPeca = useMemo(() => {
    const mapa: Record<string, Marco[]> = {}
    for (const m of marcos) (mapa[m.peca] ??= []).push(m)
    return mapa
  }, [marcos])

  // os clones ficam no useMemo: criados no corpo do render, cada re-render
  // trocaria o objeto e o <primitive> remontaria a malha inteira
  const chaoClone = useMemo(
    () => moldes.chao?.clone(true) ?? null, [moldes.chao],
  )
  const carroClone = useMemo(
    () => moldes.carro?.clone(true) ?? null, [moldes.carro],
  )

  const grupoCarro = useRef<THREE.Group>(null)
  useFrame(() => {
    const g = grupoCarro.current
    if (!g) return
    const pos = carro.current
    if (pos == null) { g.visible = false; return }
    g.visible = true
    g.position.set(0, 0, pos - (distancia.current ?? 0))
  })

  // mesmo padrão de `__cabine` e `__ocorrencia`: sem um ponto de entrada não
  // há como CONTAR o que está na tela, e densidade de cenário só se julga
  // contando — "parece vazio" não é medida
  const raiz = useRef<THREE.Group>(null)
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__via = raiz.current
    }
  }, [])

  return (
    <group ref={raiz}>
      {chaoClone && <primitive object={chaoClone} position={[0, 0, 0]} />}
      <Pista molde={moldes.trecho} distancia={distancia} />
      {(['poste', 'cabos', 'arvore', 'arbusto', 'casa', 'escola', 'placa',
        'lombada', 'faixa_pedestre', 'semaforo', 'onibus',
        'ciclista'] as const).map((nome) => (
        <Fileira
          key={nome}
          molde={moldes[nome]}
          marcos={porPeca[nome] ?? []}
          distancia={distancia}
          limite={POOL[nome] ?? 10}
        />
      ))}
      <group ref={grupoCarro} visible={false}>
        {carroClone && <primitive object={carroClone} />}
      </group>
      <Pedestre
        molde={moldes.pedestre}
        distancia={distancia}
        metro={faixa}
        liberado={pedestreLiberado}
      />
      <Contrafluxo molde={moldes.carro} distancia={distancia} />
      {/*
        Moto em fila PRÓPRIA, e não misturada na dos carros.
        Duas correções, e a segunda é a que resolve:

        1. O deslocamento inicial não basta — andando na mesma velocidade, o
           desencontro sobrevivia até a primeira reciclagem e depois moto e
           carro apareciam a 1 m um do outro (medido). A moto é 18% mais
           rápida, que é o que moto faz.
        2. Mas velocidade diferente na MESMA faixa significa que uma hora ela
           ultrapassa, e aí as duas se atravessam. Por isso a moto anda no
           CORREDOR: 2,45 em vez de 3,5, ou seja encostada na faixa central (que
           fica em ~1,75). É onde moto anda no Brasil, e é o que a torna
           visível como moto e não como carro pequeno.

        Mais esparsa de propósito: moto demais no contrafluxo vira desfile.
      */}
      <Contrafluxo
        molde={moldes.moto} distancia={distancia} quantos={5}
        vao={118} deslocamento={37} velocidade={VELOCIDADE_CONTRA * 1.18}
        x={CONTRA_X - 1.05} forcaSom={1.45}
      />
      {garagem && (
        <Garagem
          molde={moldes.carro}
          distancia={distancia}
          metro={garagem.metro}
          liberada={garagem.liberada}
        />
      )}
    </group>
  )
}

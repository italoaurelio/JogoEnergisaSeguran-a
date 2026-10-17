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
  aplicarPerfil, criarDobra, dobrarMaterial, type Dobra, type NoTracado,
} from './curva'
import { uvPorPosicao, vestir } from './texturas'
import { som } from '../som'
import { TETO_DT, VEICULO } from '../conteudo/trajeto'
import {
  ALCANCE, BORDA_DIR, BORDA_ESQ, FILEIRAS, POOL, TRECHO, paisagem, type Marco,
} from './paisagem'

export { ALCANCE, BORDA_DIR, BORDA_ESQ, FILEIRAS, POOL, TRECHO, paisagem }
export type { Marco }

const MODELO = './modelos/via.glb'
const DRACO = './draco/gltf/'

/** Comprimento de um trecho, em metros. Tem de bater com via.py. */
/** Até onde o mundo é desenhado à frente. */
/** Faixa contrária: do outro lado do eixo da via, que fica em x = +1,75. */
const CONTRA_X = 3.5

/**
 * `?setaacesa=1` trava a seta do ônibus acesa, só em desenvolvimento.
 *
 * Existe porque conferir uma lanterna que pisca a 2,4 Hz por captura de tela
 * é loteria: a leitura do estado e o `screenshot` são duas chamadas, e entre
 * elas passa mais do que meio ciclo do pisca. Passei três capturas achando
 * que a lanterna não renderizava — ela estava apagada nos três quadros.
 */
const SETA_SEMPRE_ACESA = import.meta.env.DEV
  && new URLSearchParams(window.location.search).has('setaacesa')

/** Laranja de lanterna, em HDR: ver a nota no material da seta do ônibus. */
const LARANJA_SETA = new THREE.Color(7.0, 2.6, 0.35)
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

/**
 * O CICLISTA, que agora REAGE a quem passa colado.
 *
 * Antes ele era uma cópia estática numa fileira: o caminhão passava a 20 cm
 * do guidão a 60 km/h e ele não balançava, não gritava, não olhava. O
 * momento mais visceral disponível na fase era justamente o que, quando o
 * jogador errava, não existia — e a falta ia para um `ref` que só aparecia
 * no relatório.
 *
 * Isto NÃO é veredito: é um ciclista levando um susto. Quem passa com a
 * folga que o CTB manda não vê nada disso acontecer.
 */
function Ciclista({
  molde, distancia, metro, lateral,
}: {
  molde: THREE.Object3D | null
  distancia: React.RefObject<number>
  metro: number | null
  /** Quanto o caminhão se afastou para ultrapassar. Define a folga. */
  lateral: React.RefObject<number>
}) {
  const grupo = useRef<THREE.Group>(null)
  const copia = useMemo(() => {
    if (!molde) return null
    const c = molde.clone(true)
    c.visible = true
    return c
  }, [molde])
  /** 1 no instante do susto, cai para 0. */
  const susto = useRef(0)
  const julgado = useRef(false)

  useFrame((_, bruto) => {
    const g = grupo.current
    if (!g || metro == null) return
    const dt = Math.min(bruto, TETO_DT)
    const d = distancia.current ?? 0
    const z = metro - d

    /*
      A FOLGA, em metros. O ciclista anda em x -1,30 e a lateral direita do
      caminhão fica em -1,10, então sem desvio nenhum passa-se a 20 cm dele.
      `lateral` é o quanto o caminhão se afastou.
    */
    const folga = 0.2 + (lateral.current ?? 0)

    /*
      O SUSTO COMEÇA NA APROXIMAÇÃO, e não quando o caminhão já passou.

      A primeira versão disparava em z < 1,2 — com o caminhão ao lado dele.
      A 65 km/h o balanço levava 1,6 s para acontecer e o ciclista já estava
      TRINTA METROS ATRÁS: a reação existia e o jogador nunca via. Medido no
      gancho antes de commitar.

      Agora a janela abre a 22 m, que a 65 km/h dá 1,2 s de aproximação. Ele
      ouve o caminhão vindo rápido, se encolhe, e o pico do balanço cai
      justamente quando o para-choque passa pelo guidão. Ataque rápido
      (0,35 s) e solta devagar (1,6 s) — é a curva de um susto.
    */
    const perto = z < 22 && z > -6 && folga < 0.9
    if (perto && !julgado.current) { julgado.current = true; som.fala(2, 0.75) }
    if (z > 30) julgado.current = false
    susto.current = perto
      ? Math.min(1, susto.current + dt / 0.35)
      : Math.max(0, susto.current - dt / 1.6)
    const s = susto.current
    // guinada para o meio-fio e balanço do guidão, os dois decaindo juntos
    const guinada = -0.42 * s * s
    const balanco = Math.sin(susto.current * 34) * 0.30 * s

    g.position.set(-1.3 + guinada, 0, z)
    g.rotation.z = balanco
    g.rotation.y = balanco * 0.45
    g.visible = z > -TRECHO && z < ALCANCE
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__ciclista = {
        z: +z.toFixed(1), folga: +folga.toFixed(2),
        susto: +susto.current.toFixed(2), x: +g.position.x.toFixed(2),
      }
    }
  })

  if (!copia) return null
  return <group ref={grupo}><primitive object={copia} /></group>
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

/*
  AS CORES DO TRÂNSITO.
  -----------------------------------------------------------------
  Todo carro da via era o mesmo vermelho escuro, porque todas as cópias
  dividem o material do molde — `clone()` não duplica material. Onze carros
  idênticos em fila não leem como trânsito, leem como repetição, e foi isso
  que o cliente viu.

  Valores em LINEAR, que é o espaço em que `setRGB` escreve: o vermelho
  original é (0,195 · 0,062 · 0,048), e as outras saíram da mesma faixa para
  não haver uma que estoure ao lado das outras. São as cores que se vê numa
  rua brasileira, na proporção em que se vê: branco, prata e cinza primeiro.
*/
const PINTURAS: [number, number, number][] = [
  [0.620, 0.620, 0.600],   // branco
  [0.340, 0.350, 0.370],   // prata
  [0.160, 0.170, 0.190],   // cinza chumbo
  [0.195, 0.062, 0.048],   // vermelho (o original)
  [0.620, 0.620, 0.600],   // branco de novo: é a cor mais comum da frota
  [0.045, 0.072, 0.165],   // azul
  [0.030, 0.031, 0.034],   // preto
  [0.280, 0.230, 0.165],   // bege
  [0.340, 0.350, 0.370],   // prata
  [0.048, 0.105, 0.062],   // verde escuro
]

/**
 * Pinta UMA cópia, sem encostar no molde.
 *
 * Clonar o material é obrigatório — sem isso a última cor pintaria a frota
 * inteira. E clonar exige repetir a dobra: `Material.clone()` copia o
 * `userData` (e com ele a marca `dobrado`) mas NÃO copia o
 * `onBeforeCompile`. Sem limpar a marca, o material novo sairia do forno sem
 * a dobra e o carro andaria reto no meio de uma curva — com a marca ainda
 * lá, `dobrarMaterial` desistiria em silêncio.
 */
function pintarVeiculo(
  raiz: THREE.Object3D, cor: [number, number, number], dobra: Dobra,
) {
  raiz.traverse((o) => {
    const malha = o as THREE.Mesh
    const m = malha.material as THREE.MeshStandardMaterial
    if (!m || Array.isArray(malha.material) || !/pintura/.test(m.name)) return
    const novo = m.clone()
    novo.color.setRGB(cor[0], cor[1], cor[2])
    novo.userData = { ...novo.userData, dobrado: false }
    dobrarMaterial(novo, dobra)
    malha.material = novo
  })
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
  molde, distancia, dobra, quantos = 11, vao = VAO_CONTRA, deslocamento = 0,
  velocidade = VELOCIDADE_CONTRA, x = CONTRA_X, forcaSom = 1,
  faixa = null, pedestreLiberado, ciclista = null,
}: {
  molde: THREE.Object3D | null
  distancia: React.RefObject<number>
  /** As uniforms da curva, para repintar sem perder a dobra. */
  dobra: Dobra
  /** Metro da faixa de pedestre. Null quando este trajeto não tem uma. */
  faixa?: number | null
  /** Enquanto for falso, esta fila PARA antes da faixa. */
  pedestreLiberado?: React.RefObject<boolean>
  /**
   * Metro do ciclista. Enquanto o jogador se aproxima dele, esta fila
   * ESPERA — ver a regra dentro do laço.
   */
  ciclista?: number | null
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
    return Array.from({ length: quantos }, (_, i) => {
      const c = molde.clone(true)
      // meia-volta: ele vem de frente
      c.rotation.y = Math.PI
      // cada um na sua cor, e cada fila começando num ponto diferente da
      // paleta — senão carro e moto saem na mesma ordem de cores
      pintarVeiculo(c, PINTURAS[(i * 3 + deslocamento) % PINTURAS.length], dobra)
      // e cada um com a sua folga na faixa: alinhamento perfeito é o que
      // denuncia que aquilo é um trilho e não um motorista
      c.position.x = x + ((i * 37) % 11 - 5) * 0.035
      c.visible = false
      return c
    })
  }, [molde, quantos, x, deslocamento, dobra])

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
  /*
    CADA UM COM A SUA VELOCIDADE, e cada um olhando o da frente.

    Todos andavam na MESMA velocidade constante, para sempre. O vão entre
    eles nunca mudava, nenhum nunca alcançava nenhum, e o resultado lê como
    esteira — foi o "parece uma animação plana" do cliente.

    `cruzeiro` é a velocidade que cada um QUER; `atual` é a que ele tem. A
    diferença entre as duas é o que faz trânsito: quem anda mais rápido
    alcança o da frente, alivia, fica preso atrás dele por um tempo e o
    pelotão respira. Nada disso precisa de rota nem de decisão — só de um
    carro olhar para o outro.
  */
  const cruzeiro = useRef<number[] | null>(null)
  const atual = useRef<number[]>([])

  useFrame((_, bruto) => {
    const dt = Math.min(bruto, TETO_DT)
    const d = distancia.current ?? 0
    if (!posicoes.current) {
      posicoes.current = copias.map((_, i) => d + 60 + deslocamento + i * vao)
      antes.current = posicoes.current.map((v) => v - d)
      // ±14% em volta da velocidade da fila, sorteado por índice e não por
      // `Math.random`: cenário do trajeto é determinístico de propósito, para
      // a prova de dois colaboradores ser comparável
      cruzeiro.current = copias.map(
        (_, i) => velocidade * (0.86 + (((i * 29) % 17) / 17) * 0.28),
      )
      atual.current = [...cruzeiro.current]
    }
    const p = posicoes.current
    const vq = cruzeiro.current!
    const va = atual.current

    /*
      ELES PARAM NA FAIXA TAMBÉM.
      -----------------------------------------------------------------
      O retorno do cliente foi "só a gente para, os outros veículos não
      param, eles deveriam". Ele tem razão, e o defeito era pior do que
      parecer feio: o jogador freia, o pedestre começa a atravessar e um
      carro do contrafluxo passa voando POR CIMA da faixa a três metros
      dele. A cena desmente a regra que a fase está cobrando.

      O contrafluxo vem de frente, do metro alto para o baixo, então a
      linha de parada DELE fica depois da faixa — em `faixa + 4`. Quem já
      passou da faixa segue embora; quem ainda não chegou encosta e espera.
    */
    const naFaixa = faixa != null && pedestreLiberado
      && !pedestreLiberado.current

    /*
      A PISTA FICA LIVRE PARA A ULTRAPASSAGEM DO CICLISTA.
      -----------------------------------------------------------------
      Ultrapassar com 1,5 m de folga só cabe invadindo a contramão — é
      disso que o trecho trata. Com o contrafluxo correndo, o jogador era
      espremido entre o ciclista e um carro vindo de frente, e na tela
      parecia que o ciclista se jogava em cima dos outros carros. A cena
      desmentia a manobra que a fase está cobrando.

      Eles esperam 55 m ANTES do ciclista (do lado de lá), que é onde um
      motorista de verdade pararia ao ver alguém ultrapassando na contramão.
      Fila parada à frente é cena comum; carro atravessando o jogador não é.
    */
    const d0 = ciclista
    const esperandoCiclista =
      d0 != null && d >= d0 - 85 && d <= d0 + 18

    /*
      O ciclista NÃO usa o caminho do `parando`.

      Aquele caminho crava `p[i] = linha` de uma vez, e isso só não aparece
      na faixa de pedestre porque lá a linha está sempre longe. Aqui a linha
      cai a 140 m do jogador, dentro do alcance de 320 — um carro saltando
      para trás no meio da tela seria pior que o defeito original.

      Em vez disso a linha entra na PERSEGUIÇÃO como se fosse um veículo
      parado: quem chega nela desacelera sozinho e encosta a 8 m, e quem vem
      atrás enfileira atrás dele pela mesma regra. Nada teleporta.
    */
    const parando = naFaixa
    const linha = (faixa ?? 0) + 4
    const linhaCiclista = esperandoCiclista ? (d0 ?? 0) + 55 : null

    for (let i = 0; i < copias.length; i++) {
      if (!parando) {
        /*
          PERSEGUIÇÃO SIMPLES. Esta fila anda do metro alto para o baixo,
          então quem está À FRENTE é quem tem o menor `p` acima do meu.
          O(n²) com onze veículos é nada, e evita manter uma lista ordenada
          que teria de ser refeita a cada reciclagem.
        */
        let folga = Infinity
        let vFrente = vq[i]
        for (let j = 0; j < p.length; j++) {
          if (j === i) continue
          const gap = p[i] - p[j]
          if (gap > 0 && gap < folga) { folga = gap; vFrente = va[j] }
        }
        // a linha do ciclista conta como um veículo parado à frente
        if (linhaCiclista != null) {
          const gap = p[i] - linhaCiclista
          if (gap > 0 && gap < folga) { folga = gap; vFrente = 0 }
        }
        let alvo = vq[i]
        // 26 m é onde se começa a aliviar; 8 m é onde se para de verdade
        if (folga < 26) {
          alvo = Math.min(alvo, vFrente * Math.max(0, (folga - 8) / 18))
        }
        // acelera devagar e alivia rápido, que é o que um pé faz
        const ritmo = Math.min(1, dt * (alvo < va[i] ? 3.2 : 1.1))
        va[i] += (alvo - va[i]) * ritmo
      }
      p[i] -= (parando ? velocidade : va[i]) * dt
      if (parando && p[i] < linha && p[i] > linha - 120) p[i] = linha
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
        // volta solto: sem isto ele reentra com a velocidade de quem estava
        // parado atrás de alguém e segura a fila nova
        va[i] = vq[i]
      }
      const z = p[i] - d
      // cruzou o jogador neste quadro: é agora que o "fiuu" tem de soar,
      // senão o som chega depois do carro já ter sumido do retrovisor
      // A lateral e a da propria fila: a moto anda no corredor, entao passa
      // mais perto, soa mais alto e com Doppler mais inclinado — de graca,
      // sem numero escrito a mao pra cada fila.
      if ((antes.current[i] ?? 999) > 2 && z <= 2) {
        som.passagem(forcaSom, Math.abs(x))
      }
      antes.current[i] = z
      copias[i].position.z = z
      copias[i].visible = z > -25 && z < ALCANCE
    }

    // Enfileira quem parou. Sem este passe os onze veículos encostavam
    // TODOS na mesma linha e viravam um bloco de carros sobrepostos —
    // pior que não parar. Com 7,5 m de vão mínimo eles formam a fila que
    // qualquer um já viu numa faixa de pedestre.
    if (parando) {
      const ordem = p.map((_, i) => i).sort((a, b) => p[a] - p[b])
      for (let k = 1; k < ordem.length; k++) {
        const atras = ordem[k], frente = ordem[k - 1]
        if (p[atras] < p[frente] + 7.5) p[atras] = p[frente] + 7.5
        const z = p[atras] - d
        copias[atras].position.z = z
        copias[atras].visible = z > -25 && z < ALCANCE
      }
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
/**
 * CICLO DE CAMINHADA das pessoas da via.
 *
 * A passada era ASSADA na malha: uma perna a frente, outra atras, congeladas.
 * Lia como caminhada numa foto e como DESLIZE em movimento — a pessoa
 * atravessava os 8,7 m da pista na mesma pose.
 *
 * Nao da para esfolar: `X.preparar()` roda convert(target="MESH"), que aplica
 * a armadura e congela a pose, entao nada com osso chega ao .glb. Mas nao
 * precisa de osso. As duas pernas saem do Blender como NOS PROPRIOS, com a
 * origem no quadril, e girar no eixo Z local e o ciclo de caminhada mais
 * antigo que existe — o mesmo truque da lanca do cesto aereo em Ocorrencia3D.
 *
 * O ciclo anda com os METROS PERCORRIDOS, nao com o relogio: assim a cadencia
 * acompanha a velocidade sozinha, quem anda mais rapido da mais passos, e
 * parar o movimento para a perna no lugar em vez de deixar ela pedalando.
 */
function pernasDe(obj: THREE.Object3D | null) {
  if (!obj) return null
  const achadas: Record<string, THREE.Object3D> = {}
  obj.traverse((o) => {
    if (o.name.endsWith('_perna_e')) achadas.e = o
    if (o.name.endsWith('_perna_d')) achadas.d = o
  })
  if (!achadas.e || !achadas.d) return null
  // a altura do quadril vem da propria peca (o no ja nasce transladado ate
  // ele), entao a crianca de 1,25 m anda sem nenhum numero a mais
  return { e: achadas.e, d: achadas.d, quadril: achadas.e.position.y }
}

const BALANCO = THREE.MathUtils.degToRad(24)

function andar(
  pernas: ReturnType<typeof pernasDe>,
  corpo: THREE.Object3D | null,
  metros: number,
) {
  if (!pernas || !corpo) return
  // uma passada por ~0,8 do quadril: 0,72 m no adulto, 0,52 m na crianca
  const ang = Math.sin((metros / (pernas.quadril * 0.8)) * Math.PI) * BALANCO
  pernas.e.rotation.z = ang
  pernas.d.rotation.z = -ang
  // O quadril AFUNDA conforme a perna abre — perna rigida de comprimento L
  // sustenta o corpo a L*cos(ang). Sem isso o pe flutua nos extremos da
  // passada; com isso o pe fica no chao e sai de brinde o balanco vertical,
  // que e o que mais faz uma silhueta ler como "andando".
  corpo.position.y = pernas.quadril * (Math.cos(ang) - 1)
}

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
  const pernas = useMemo(() => pernasDe(obj), [obj])

  useFrame((_, bruto) => {
    const g = grupo.current
    if (!g || metro == null) return
    const dt = Math.min(bruto, TETO_DT)
    const z = metro - (distancia.current ?? 0)
    // 7 s para atravessar os 8,7 m: ~1,2 m/s, que é passo de gente comum
    if (liberado.current) avanco.current = Math.min(1, avanco.current + dt / 7)
    const vao = ATE_PE_X - DE_PE_X
    const x = DE_PE_X + vao * avanco.current
    g.position.set(x, 0, z)
    // parado no meio-fio ele fica de pe; andando, anda
    andar(pernas, obj, avanco.current * vao)
    g.visible = z > -30 && z < ALCANCE
  })

  if (!obj) return null
  return <group ref={grupo}><primitive object={obj} /></group>
}

/**
 * Ônibus escolar em embarque, com as crianças entrando.
 *
 * Ele é OBSTÁCULO, não enfeite: ocupa a faixa do jogador (2,42 m de largura
 * em x -1,0, contra a caçamba do caminhão que vai de -0,7 a 1,5) e, sem
 * poder desviar, só resta esperar. A trava de distância mora em `Trajeto`,
 * porque é lá que a distância é escrita; aqui é só o que se vê.
 *
 * As crianças entram UMA A UMA enquanto o jogador espera, e só depois da
 * última o ônibus arranca. É a mesma regra do pedestre e da garagem: quem
 * fez o certo não fica preso, mas também não passa antes da hora.
 */
/**
 * Onde a criança entra, em coordenadas do ônibus.
 *
 * A porta estava modelada em x +1.23 — e o ônibus aponta para +z, parado em
 * x -1.0: ela abria em x +0.23, no meio do asfalto, que vai de -1.75 a 5.25.
 * Porta de ônibus ESCOLAR para o lado do trânsito. Movida para -1.23 em
 * `via.py`; aqui a criança para rente a ela.
 */
const PORTA_ONIBUS = new THREE.Vector3(-1.9, 0, 3.0)

function OnibusEscolar({
  molde, moldeCrianca, distancia, metro, liberado, onde,
}: {
  molde: THREE.Object3D | null
  moldeCrianca: THREE.Object3D | null
  distancia: React.RefObject<number>
  metro: number | null
  liberado: React.RefObject<boolean>
  /** Onde ele está AGORA, em metros de trajeto. O Motor lê para não
      atravessá-lo depois que ele arranca. */
  onde: React.RefObject<number | null>
}) {
  const grupo = useRef<THREE.Group>(null)
  const criancas = useRef<THREE.Group>(null)
  const bus = useMemo(() => {
    if (!molde) return null
    const c = molde.clone(true)
    c.visible = true
    return c
  }, [molde])
  /*
    A SETA DO ÔNIBUS, no canto traseiro esquerdo.

    O modelo não tem lanterna, e mandar uma de volta pelo Blender por causa
    de uma luz de 12 cm seria desproporcional: aqui ela é uma caixinha com
    material básico, que não depende de luz nenhuma para brilhar.

    O canto sai da caixa envolvente do próprio ônibus, e não de números
    escritos à mão — o modelo já mudou de tamanho uma vez.
  */
  const cantoSeta = useMemo(() => {
    if (!bus) return null
    /*
      A CAIXA DA CARROCERIA, e não a do objeto inteiro.

      `setFromObject(bus)` devolvia x de -2,32 a 1,47 — quase quatro metros
      de largura, porque o braço da placa PARE e o espelho entram na conta.
      A lanterna nascia em 1,49 e ficava boiando um metro e meio ao lado do
      ônibus, no ar, que na tela parece defeito e não seta.

      A carroceria é a malha com mais vértices: é o único critério que não
      depende do nome que o exportador deu a cada peça.

      Dirigindo para +z, a esquerda é +x (direita × cima = -x). A traseira é
      o lado de menor z: é a face que o jogador, que vem de trás, vê.
    */
    let corpo: THREE.Mesh | null = null
    let maior = 0
    bus.traverse((o) => {
      const m = o as THREE.Mesh
      const n = m.isMesh ? (m.geometry.getAttribute('position')?.count ?? 0) : 0
      if (n > maior) { maior = n; corpo = m }
    })
    const b = new THREE.Box3().setFromObject(corpo ?? bus)
    /*
      A LARGURA MEDIDA NA TRASEIRA, e não no ônibus inteiro.

      Mesmo pegando só a carroceria a caixa dá 3,37 m de largura: o espelho
      sai 43 cm da lataria lá na frente, e a lanterna colada nesse extremo
      aparecia destacada do ônibus, no ar ao lado dele.

      Os vértices dos últimos 60 cm de traseira não têm espelho nenhum, então
      o maior x entre eles É a quina traseira esquerda. Vale para qualquer
      modelo que venha depois, que é mais do que se pode dizer de subtrair
      43 cm escritos à mão.
    */
    let quina = b.max.x
    const pos = (corpo as THREE.Mesh | null)?.geometry?.getAttribute('position')
    if (pos) {
      quina = -Infinity
      for (let i = 0; i < pos.count; i++) {
        if (pos.getZ(i) < b.min.z + 0.6 && pos.getX(i) > quina) quina = pos.getX(i)
      }
      if (!Number.isFinite(quina)) quina = b.max.x
    }
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__caixaOnibus = {
        caixa: [b.min.toArray().map((n) => +n.toFixed(2)),
                b.max.toArray().map((n) => +n.toFixed(2))],
        quinaTraseira: +quina.toFixed(2),
      }
    }
    // 2 cm PARA FORA da lataria, senão a lanterna briga por profundidade com
    // ela e some em metade dos quadros.
    return [quina + 0.02, 1.05, b.min.z + 0.14] as [number, number, number]
  }, [bus])
  const seta = useRef<THREE.Mesh>(null)
  const filhos = useMemo(() => {
    if (!moldeCrianca) return []
    // Fila NO LADO DO MEIO-FIO, atrás da porta, de frente para ela.
    //
    // Estavam em x -2,5 (fora do ônibus, do lado certo) mas em z negativo —
    // atrás do eixo traseiro, com a porta 5 m à frente — e com rotation.y =
    // PI, ou seja de costas para ela. Nada disso aparecia porque elas
    // sumiam uma a uma em vez de andar: criança que pisca não revela que
    // estava virada para o lado errado, na ponta errada do ônibus.
    return [0, 1, 2].map((i) => {
      const c = moldeCrianca.clone(true)
      c.visible = true
      c.position.set(-1.95, 0, 1.8 - i * 0.8)
      // o modelo anda no eixo X; -90° em Y vira ele para +z, que é onde
      // está a porta
      c.rotation.y = -Math.PI / 2
      return c
    })
  }, [moldeCrianca])
  const pernasFilhos = useMemo(() => filhos.map((c) => pernasDe(c)), [filhos])
  const saidas = useMemo(
    () => filhos.map((c) => c.position.clone()), [filhos],
  )
  /** Quantas já entraram, em fração: 0 nenhuma, 1 todas. */
  const embarcou = useRef(0)
  /** Quanto o ônibus já andou depois de arrancar, em metros. */
  const saiu = useRef(0)
  /** Null até o primeiro quadro; o atalho `?m=` decide o que fazer nele. */
  const nasceu = useRef(false)

  useFrame((_, bruto) => {
    const g = grupo.current
    if (!g || metro == null) return
    const dt = Math.min(bruto, TETO_DT)
    const d = distancia.current ?? 0
    const z = metro - d

    // Entrando pelo atalho `?m=` DEPOIS do embarque, ele já foi embora: sem
    // isto ele nasce atrás do jogador com `liberado` ligado e passa por cima
    // dele indo para a frente, que é o contrário do que aconteceu.
    if (!nasceu.current) {
      nasceu.current = true
      if (liberado.current && z < 0) saiu.current = ALCANCE - z
    }

    // embarque começa quando o jogador está perto o bastante para ver
    if (!liberado.current && z < 60) {
      embarcou.current = Math.min(1, embarcou.current + dt / 4.5)
    }
    if (liberado.current) {
      // Arranca devagar e VAI EMBORA DE VERDADE.
      //
      // O teto antigo era 9 m/s, e o caminhão faz 25 (`VEICULO.maxima`):
      // quem pisava fundo na saída alcançava o ônibus. Com a trava de
      // distância agora seguindo o ônibus, alcançar não atravessa mais — mas
      // prende o jogador atrás dele a 32 km/h pelos 760 m restantes, o que é
      // trocar um defeito por outro.
      //
      // O teto é a máxima do caminhão: assim o vão só aumenta, a trava nunca
      // mais encosta depois do embarque, e o ônibus sai de cena sozinho. Na
      // prática ninguém vê essa velocidade — quem respeita os 30 km/h do
      // trecho escolar vê uma arrancada normal e o ônibus sumindo à frente.
      /*
        DEVAGAR NOS PRIMEIROS 18 m, e só depois embora.

        Com a rampa única (`2 + saiu*0,6`) ele chegava aos 25 m/s do
        caminhão em três segundos — nenhum ônibus escolar faz isso, e pior:
        a entrada na via acontecia inteira longe demais para ser vista.
        Medido tentando filmar, ele sumia do quadro antes do segundo
        fotograma.

        A rampa mais mansa (0,35) leva 4,1 s para cobrir os 18 m da entrada,
        que é o tempo de ver a seta piscar e o ônibus se encaixar na faixa.
        Passados os 18 m volta a rampa antiga, que é o que garante que o vão
        só aumente e o jogador não fique preso atrás dele.
      */
      const rampa = saiu.current < 18 ? 0.35 : 0.6
      saiu.current += Math.min(VEICULO.maxima, 2 + saiu.current * rampa) * dt
    }
    // Cada uma ANDA até a porta na sua vez, e some ao entrar. Antes elas
    // piscavam no lugar: o embarque era uma contagem, não uma cena, e o
    // jogador esperava sem ver por quê.
    for (let i = 0; i < filhos.length; i++) {
      const minha = (i + 1) / filhos.length
      const anterior = i / filhos.length
      const visivel = embarcou.current < minha
      filhos[i].visible = visivel
      if (!visivel) continue
      const t = Math.min(1, Math.max(0,
        (embarcou.current - anterior) / (minha - anterior)))
      const saida = saidas[i]
      const x = saida.x + (PORTA_ONIBUS.x - saida.x) * t
      const zz = saida.z + (PORTA_ONIBUS.z - saida.z) * t
      filhos[i].position.set(x, 0, zz)
      andar(pernasFilhos[i], filhos[i], t * saida.distanceTo(PORTA_ONIBUS))
    }
    // ELE FUGIA PARA SEMPRE.
    //
    // O corte de frente usava o `z` PARADO, não o z de verdade (`z + saiu`):
    // depois de arrancar, `saiu` crescia sem teto e o ônibus continuava
    // visível a qualquer distância, porque `z < ALCANCE` seguia valendo com o
    // z antigo. Medido entrando com `?m=600` (depois do evento, em 580, logo
    // `liberado` já nasce verdadeiro): o ônibus estava em z = 1097 m, ainda
    // com `visible` ligado, tendo atravessado a tela inteira de trás para a
    // frente enquanto o caminhão estava parado.
    /*
      ELE VOLTA PARA A VIA, não arranca de lado.

      Parado ele encosta em x -1,00, junto ao meio-fio. Antes ele saía dali
      em linha reta e seguia a viagem inteira com meio ônibus fora da pista,
      o que não é o que um ônibus escolar faz nem o que o jogador precisa
      aprender a esperar: ele entra na via, e por isso quem vem atrás tem de
      estar pronto para ceder.

      18 m para completar a entrada, que a 30 km/h dá pouco mais de dois
      segundos — tempo de a seta piscar três ou quatro vezes antes de ele
      estar na faixa.
    */
    const entrando = Math.min(1, saiu.current / 18)
    const x = -1.0 + 0.8 * entrando
    const zf = z + saiu.current
    g.position.set(x, 0, zf)
    // pisca enquanto entra, e só; 2,4 Hz é o ritmo de pisca-pisca de veículo
    if (seta.current) {
      seta.current.visible = liberado.current && entrando < 1
        && (SETA_SEMPRE_ACESA || Math.floor(performance.now() / 420) % 2 === 0)
    }
    g.visible = zf > -30 && zf < ALCANCE
    onde.current = metro + saiu.current
    if (criancas.current) criancas.current.visible = saiu.current < 1
    if (import.meta.env.DEV) {
      // para conferir a entrada na via por número, e não por palpite de
      // quando apertar o botão da captura
      ;(window as unknown as Record<string, unknown>).__onibus = {
        x: +x.toFixed(2), saiu: +saiu.current.toFixed(1), z: +zf.toFixed(1),
        seta: seta.current?.visible ?? false,
        setaMundo: seta.current
          ? seta.current.getWorldPosition(new THREE.Vector3()).toArray()
              .map((n) => +n.toFixed(2))
          : null,
      }
    }
  })

  if (!bus) return null
  return (
    <group ref={grupo}>
      <primitive object={bus} />
      {cantoSeta && (
        <mesh ref={seta} position={cantoSeta} visible={false}>
          {/*
            26 cm, que é o tamanho de uma lanterna de ônibus de verdade.
            Com os 10 cm da primeira tentativa ela tinha 3 PIXELS na tela: a
            entrada na via acontece uns 38 m à frente, e ali cada pixel vale
            quase 3 cm. Medido no quadro, não estimado.
          */}
          <boxGeometry args={[0.08, 0.26, 0.22]} />
          {/*
            Básico, e não standard: lanterna acesa não depende da luz do sol,
            e com `standard` ela some na sombra da copa das árvores.

            A COR PASSA DE 1 DE PROPÓSITO. `toneMapped={false}` só dispensa o
            tom do material — o AgX do `Acabamento` roda depois, sobre o
            quadro inteiro, e esmagava um `#ffae2b` (0,45 de luminância) num
            marrom escuro no rear do ônibus. Com 7 a 1 de alcance ela
            atravessa o AgX acesa e ainda entra no bloom, que é o que faz
            lanterna parecer lanterna.
          */}
          <meshBasicMaterial color={LARANJA_SETA} toneMapped={false} />
        </mesh>
      )}
      <group ref={criancas}>
        {filhos.map((c, i) => <primitive key={i} object={c} />)}
      </group>
    </group>
  )
}

/**
 * Gente andando no pátio, entre os veículos estacionados.
 *
 * É esta peça que faz o limite de 20 km/h virar motivo em vez de regra: o
 * jogador reduz porque VÊ alguém podendo sair de trás de uma caçamba, não
 * porque um texto mandou. Sem isso o trecho é obediência sem tradução — e
 * quem obedece sem entender não leva nada para o trabalho.
 *
 * Elas andam com o METRO do jogador, não com o relógio: dois colaboradores
 * têm de encontrar a mesma cena no mesmo ponto, como o resto do cenário.
 * Ninguém entra na pista — são colegas atravessando entre vagas, e o risco
 * que a fase ensina é o de ALGUÉM PODER entrar, que é o que faz reduzir.
 */
// Encostados na beira da pista, não lá no fundo do pátio: a 4 m de distância
// eles ficavam ATRÁS da frota estacionada e não se via ninguém — e gente que
// não se vê não faz ninguém reduzir. O vaivém é curto pelo mesmo motivo de
// nunca entrarem na pista: o risco que a fase ensina é o de alguém PODER
// entrar, e para isso basta estar perto o bastante para assustar.
//
// E ELES PISAVAM NO ASFALTO. Medido: com o vaivém no extremo, quatro dos
// cinco entravam na pista — o de x -2,4 chegava a -0,98, que é 0,77 m dentro
// do asfalto (que vai de -1,75 a 5,25), bem na frente do caminhão e sem
// colisão nenhuma. O comentário acima já dizia "ninguém entra na pista"; a
// conta é que não dizia. Agora os limites saem da medida: no extremo do
// vaivém a silhueta para a 10 cm da beira do asfalto, e do outro lado a 10 cm
// do veículo estacionado.
const NO_PATIO: { metro: number; x: number; ida: number; giro: number }[] = [
  { metro: 16, x: -3.0, ida: 0.6, giro: 0 },
  { metro: 33, x: 6.5, ida: -0.6, giro: Math.PI },
  { metro: 52, x: -3.05, ida: 0.6, giro: 0 },
  { metro: 68, x: 6.6, ida: -0.6, giro: Math.PI },
  { metro: 88, x: -2.95, ida: 0.6, giro: 0 },
]

function PessoasDoPatio({
  molde, distancia,
}: {
  molde: THREE.Object3D | null
  distancia: React.RefObject<number>
}) {
  const grupo = useRef<THREE.Group>(null)
  const copias = useMemo(() => {
    if (!molde) return []
    return NO_PATIO.map((p) => {
      const c = molde.clone(true)
      c.rotation.y = p.giro
      c.visible = false
      return c
    })
  }, [molde])

  // o corpo que afunda e a copia; a perna e filha dela
  const corpos = copias
  const pernas = useMemo(() => copias.map((c) => pernasDe(c)), [copias])

  useEffect(() => {
    const g = grupo.current
    if (!g) return
    copias.forEach((c) => g.add(c))
    return () => { copias.forEach((c) => g.remove(c)) }
  }, [copias])

  useFrame(({ clock }) => {
    const d = distancia.current ?? 0
    const t = clock.elapsedTime
    for (let i = 0; i < copias.length; i++) {
      const p = NO_PATIO[i]
      const z = p.metro - d
      // vai e volta entre as vagas: seno, não sorteio, para ser igual sempre
      const fase = t * 0.42 + i * 1.7
      const anda = Math.sin(fase) * p.ida
      copias[i].position.set(p.x + anda, 0, z)
      // vira para onde anda: perna andando para tras com o corpo de frente e
      // moonwalk, e um colega moonwalking no patio custa a cena inteira
      const paraFrente = Math.cos(fase) * p.ida >= 0
      copias[i].rotation.y = p.giro + (paraFrente ? 0 : Math.PI)
      andar(pernas[i], corpos[i], anda)
      copias[i].visible = z > -20 && z < ALCANCE
    }
  })

  return <group ref={grupo} />
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
  onibus, onibusLiberado, onibusOnde, lateral, ciclista,
}: {
  distancia: React.RefObject<number>
  marcos: Marco[]
  /** Posição do veículo à frente, em metros de trajeto. Null quando não há. */
  carro: React.RefObject<number | null>
  /** Onde a via dobra e onde sobe. Vazio = reta. */
  tracado: NoTracado[]
  /** Lâmpada acesa do semáforo: 0 verde, 1 amarelo, 2 vermelho. */
  sinal?: React.RefObject<number>
  /** Metro do ônibus escolar, e se ele já arrancou. */
  onibus: number | null
  onibusLiberado: React.RefObject<boolean>
  /** Onde o ônibus está agora; o Motor lê para parar atrás dele. */
  onibusOnde: React.RefObject<number | null>
  /** Metro da faixa de pedestre, e se o pedestre já atravessou. */
  faixa: number | null
  pedestreLiberado: React.RefObject<boolean>
  /** Metro da saída de garagem, e se o jogador já cedeu passagem. */
  garagem?: { metro: number | null; liberada: React.RefObject<boolean> }
  /**
   * Quanto o caminhão se afastou para a esquerda, em metros.
   *
   * Quem anda é o MUNDO, para o lado contrário. A cabine é uma malha fixa com
   * a câmera dentro dela: mover a câmera para ultrapassar o ciclista a
   * arrancaria de dentro do próprio caminhão, e mover as duas juntas só
   * acrescentaria um segundo lugar para a conta sair errada. Deslizar a via
   * dá exatamente a mesma imagem, com uma linha.
   */
  lateral?: React.RefObject<number>
  /** Metro do ciclista. Ele tem componente próprio porque REAGE. */
  ciclista?: number | null
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

  /*
    OS TRÊS CAMPOS DE MALHA SÃO LIGADOS NO RENDER, e não no efeito abaixo.

    `clone()` copia `castShadow`, `receiveShadow` e `frustumCulled` no
    momento da cópia, e o mundo inteiro é feito de cópias: o catálogo nem
    entra em cena. Ligados só no efeito, eles chegavam depois de os clones já
    terem nascido — e a rua inteira passou meses sem uma sombra de contato,
    com caminhão, poste e pedestre pousados em nada. Era a maior parte do que
    fazia o trajeto parecer chapado.

    Material e geometria podem ficar no efeito, e ficam: esses o clone
    compartilha por referência, então remendar o molde alcança as cópias
    depois. Os campos da malha, não.

    `useMemo` sem valor é esquisito e é o ponto: isto precisa rodar no corpo
    do render, antes dos `useMemo` que fazem os clones — que vêm mais abaixo
    neste mesmo componente, e portanto depois deste.
  */
  useMemo(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = true
      m.receiveShadow = true
      // o corte por caixa envolvente é calculado na geometria reta; depois da
      // dobra a peça não está mais lá e o three a descartaria em curva
      m.frustumCulled = false
    })
  }, [scene])

  useEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      uvPorPosicao(m.geometry)
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        dobrarMaterial(mat, dobra)
        const material = mat as THREE.MeshStandardMaterial
        /*
          AS COPAS ERAM O PONTO MAIS ESCURO DE CADA QUADRO.

          `via_copa` nasce em (0,030 · 0,052 · 0,022) no Blender — albedo de
          0,05, praticamente preto. Numa paleta onde nada mais desce abaixo
          de 0,10, a árvore virava o ponto mais forte da imagem e puxava o
          olho; no trecho do ciclista, as cinco copas da esquerda venciam o
          ciclista, que é justamente o que o jogador precisa achar.

          Aqui e não no Blender pelo mesmo motivo do cadarço: dá para ver
          sem pagar um rebake.
        */
        if (material.name.startsWith('via_copa')) {
          material.color.multiplyScalar(1.6)
          material.needsUpdate = true
        }
        if (material.map) continue
        const anis = Math.min(8, anisotropia)
        if (material.name === 'via_asfalto') {
          // 0,42 e não 0,9: a textura do Poly Haven vem com albedo de
          // ~0,25 e o asfalto do jogo nasceu em 0,042. Clarear demais
          // deixou a pista bege — mais chapada do que antes da textura.
          // Asfalto de verdade fica entre 0,06 e 0,12 de albedo.
          vestir(material, { cor: asfaltoCor, relevo: asfaltoRelevo }, anis, 0.42,
                 undefined, [0.42, 0.43, 0.46])   // devolve o frio do asfalto
        } else if (material.name === 'via_terra') {
          vestir(material, { cor: terraCor, relevo: terraRelevo }, anis, 0.5,
                 undefined, [0.46, 0.41, 0.36])    // tira o vermelho sem apagar o grão
        } else if (/^via_(escola_parede|concreto|parede|muro|calcada)/.test(material.name)) {
          /*
            A SUPERFÍCIE CONSTRUÍDA TAMBÉM GANHA GRÃO.

            O ramo de textura só conhecia asfalto, terra e mato. Todo o
            resto do mundo construído — muro de pátio, parede de casa,
            escola, calçada — continuava cor lisa. E o muro da escola é a
            MAIOR superfície vertical do trajeto: em `10-trajeto-escola` ele
            toma a lateral esquerda inteira, sem um grão, uma emenda, uma
            mancha. A 30% do quadro, era ele que definia a impressão da cena.

            O grão vem do ASFALTO, e não da terra. Tentei a terra primeiro,
            que era o reaproveitamento óbvio, e o muro da escola ficou
            LARANJA: a textura de terra é avermelhada, e grão de terra numa
            parede lê como terra, não como reboco. A do asfalto é cinza e de
            grão fino, que é o que reboco é.

            Ladrilho apertado (0,9 m, não 2,2): parede vista de perto pede
            grão fino. A tinta escurece um pouco o creme da escola, que
            estava em 0,300 — mesma faixa de valor do asfalto texturizado e
            do céu com névoa, três massas grandes sem hierarquia nenhuma.
          */
          vestir(material, { cor: asfaltoCor, relevo: asfaltoRelevo }, anis, 0.60,
                 0.9, [0.70, 0.69, 0.66])
        } else if (material.name === 'via_mato') {
          // A grama é gerada em arte/gerar_grama.py: não havia nenhuma em
          // arte/tex, e é a maior superfície do trajeto — chapada, era ela
          // que tirava a referência de profundidade e fazia arbusto a 150 m
          // parecer flutuando.
          vestir(material, { cor: gramaCor, relevo: gramaRelevo }, anis, 0.55,
                 undefined, [0.42, 0.52, 0.34])
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
    // Mesma armadilha que FILEIRAS: escrita a mao, esta lista sai de
    // sincronia com o POOL em silencio — molde faltando vira null, e peca
    // sem molde nao desenha nem reclama. Sai do POOL, mais o que nao e marco.
    const nomes = [...FILEIRAS, 'trecho', 'chao', 'moto', 'pedestre',
      'crianca']
    const mapa: Record<string, THREE.Object3D | null> = {}
    for (const n of nomes) mapa[n] = scene.getObjectByName(`via_${n}`) ?? null

    // PARENTESCO NÃO SOBREVIVE AO glTF — de novo.
    //
    // As pernas saem do Blender como FILHAS do corpo, com a origem no
    // quadril. O `optimize` do gltf-transform achata a hierarquia: os nós
    // chegam com a translação certa, mas soltos, e clonar o corpo vem sem
    // perna. Mesma armadilha da lança do cesto aéreo, e a mesma saída:
    // a montagem é feita aqui.
    for (const n of ['pedestre', 'crianca']) {
      const corpo = mapa[n]
      if (!corpo) continue
      const g = new THREE.Group()
      g.name = corpo.name
      g.add(corpo.clone(true))
      for (const lado of ['e', 'd']) {
        const perna = scene.getObjectByName(`via_${n}_perna_${lado}`)
        if (perna) g.add(perna.clone(true))
      }
      mapa[n] = g
    }
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
  useFrame(() => {
    if (raiz.current) raiz.current.position.x = -(lateral?.current ?? 0)
  })
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__via = raiz.current
      ;(window as unknown as Record<string, unknown>).__dobra = dobra
    }
  }, [])

  return (
    <group ref={raiz}>
      {chaoClone && <primitive object={chaoClone} position={[0, 0, 0]} />}
      <Pista molde={moldes.trecho} distancia={distancia} />
      {/*
        A lista vem do POOL, não escrita à mão aqui.
        Escrita à mão ela esqueceu `carro`: os 6 carros do pátio eram
        calculados a cada quadro e jogados fora, e nenhum auto-teste viu.
      */}
      {FILEIRAS.map((nome) => (
        <Fileira
          key={nome}
          molde={moldes[nome]}
          marcos={porPeca[nome] ?? []}
          distancia={distancia}
          limite={POOL[nome]}
        />
      ))}
      {ciclista != null && lateral && (
        <Ciclista
          molde={moldes.ciclista}
          distancia={distancia}
          metro={ciclista}
          lateral={lateral}
        />
      )}
      <group ref={grupoCarro} visible={false}>
        {carroClone && <primitive object={carroClone} />}
      </group>
      <Pedestre
        molde={moldes.pedestre}
        distancia={distancia}
        metro={faixa}
        liberado={pedestreLiberado}
      />
      <OnibusEscolar
        molde={moldes.onibus}
        moldeCrianca={moldes.crianca}
        distancia={distancia}
        metro={onibus}
        liberado={onibusLiberado}
        onde={onibusOnde}
      />
      <PessoasDoPatio molde={moldes.pedestre} distancia={distancia} />
      <Contrafluxo
        molde={moldes.carro} distancia={distancia} dobra={dobra}
        faixa={faixa} pedestreLiberado={pedestreLiberado} ciclista={ciclista}
      />
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
        molde={moldes.moto} distancia={distancia} dobra={dobra} quantos={5}
        vao={118} deslocamento={37} velocidade={VELOCIDADE_CONTRA * 1.18}
        x={CONTRA_X - 1.05} forcaSom={1.45}
        faixa={faixa} pedestreLiberado={pedestreLiberado} ciclista={ciclista}
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

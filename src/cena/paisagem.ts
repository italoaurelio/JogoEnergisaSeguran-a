/**
 * Onde cada peça do cenário fica ao longo do trajeto.
 *
 * Separado de `Via.tsx` por ser função PURA: sem three, sem React, sem GLB.
 * Densidade de cenário só se julga CONTANDO, e com isto a contagem roda em
 * Node (`node --test` ou o auto-teste no fim do arquivo) em vez de depender
 * de abrir o jogo — que é o que trava quando o painel do navegador está
 * oculto.
 */

import { TRAJETO } from '../conteudo/trajeto.ts'

/** Comprimento de um trecho de pista, em metros. */
export const TRECHO = 40
/** Até onde o cenário é desenhado à frente do jogador, em metros. */
export const ALCANCE = 320
/** Beira direita e esquerda da área útil, em metros a partir do eixo. */
export const BORDA_DIR = -1.75
export const BORDA_ESQ = 5.25

/**
 * Até onde vai o acostamento de terra, medido nas submalhas de `via_trecho`.
 *
 * O asfalto é exatamente BORDA_DIR..BORDA_ESQ; o acostamento é a faixa de
 * terra em volta dele. Os dois números estão aqui porque toda posição de
 * cenário deste arquivo se justifica contra eles: nada de beira de via pode
 * entrar no asfalto, e muro e frota não podem nem pisar no acostamento.
 *
 * Era isso que faltava para alguém conferir "está no lugar?" sem abrir o jogo
 * — e foi por não ter régua que o muro do pátio passou 26 vezes por cima da
 * pista sem ninguém ver.
 */
export const ACOSTAMENTO_DIR = -3.95
export const ACOSTAMENTO_ESQ = 7.45

/**
 * Divisa do pátio, de um lado e de outro.
 *
 * Encostada na beira do chão desenhado por trecho (x de -8,95 a 12,45) para
 * sobrar faixa de estacionamento entre o acostamento e o muro: 4,5 m de cada
 * lado, que é o que um ônibus de 3,79 m de largura precisa para encostar em
 * paralelo sem pisar no acostamento.
 */
const MURO_DIR = -8.6
const MURO_ESQ = 12.1

/**
 * Recuo da frontaria, dos dois lados.
 *
 * Não é estética: é a conta de caber. A árvore de calçada gira (`giro: r*6`),
 * então o que conta é a copa NO PIOR GIRO — 2,54 m de raio, não os 1,98 do
 * eixo. Com o recuo antigo (8,2 e 9,0) a copa entrava na casa em 79 pontos do
 * trajeto: "árvore dentro de casa" literal. Estes são o menor recuo em que a
 * copa girada ainda cabe entre a via e a casa.
 */
const CASA_ESQ = BORDA_ESQ + 10.5
const CASA_DIR = BORDA_DIR - 11.2

/**
 * Onde fica a árvore de calçada, de cada lado.
 *
 * Na direita ela recuou 1,15 m: em -4,95 a copa girada cobria a placa de
 * limite (x -3,26 a -2,54) e o jogador lia a velocidade através da folhagem.
 */
const ARVORE_ESQ = BORDA_ESQ + 3.4
const ARVORE_DIR = BORDA_DIR - 4.15

/** Uma peça colocada em algum ponto do trajeto. */
export type Marco = {
  peca: 'poste' | 'cabos' | 'arvore' | 'arbusto' | 'casa'
    | 'casa_b' | 'casa_c' | 'placa'
    | 'carro' | 'lombada' | 'faixa_pedestre' | 'semaforo' | 'cruzamento' | 'onibus'
    | 'ciclista' | 'escola' | 'escola_portao' | 'muro_patio'
  /** Distância absoluta ao longo do trajeto, em metros. */
  metro: number
  x: number
  giro?: number
  /** Só para o carro: ele anda, então a posição vem de fora a cada quadro. */
  movel?: boolean
}

/**
 * Espalha a paisagem ao longo do trajeto de forma determinística.
 *
 * Não usa Math.random: o cenário tem de ser o mesmo em toda sessão, senão dois
 * colaboradores fazem provas diferentes e a nota não é comparável.
 */
/**
 * Trecho do trajeto com entorno de escola, em metros, LIDO DO TRAJETO.
 *
 * Era fixo em 700-1000, chutado por mim — e o trecho `escola` do trajeto, que
 * é o que baixa o limite para 30, vai de 470 a 640. O muro aparecia 230 m
 * depois da placa de 30: o jogador reduzia num bairro comum e passava a 30
 * por uma escola que ainda não tinha começado.
 *
 * Agora sai do próprio `TRAJETO`. Cenário, limite de velocidade e som de
 * pátio passam a ser o mesmo trecho por construção.
 */
/** Trecho de saída do pátio, lido do próprio trajeto. */
export const ZONA_PATIO = (() => {
  let acumulado = 0
  for (const t of TRAJETO) {
    if (t.id === 'patio') return { de: acumulado, ate: acumulado + t.metros }
    acumulado += t.metros
  }
  return { de: 0, ate: 100 }
})()

export const ZONA_ESCOLA = (() => {
  let acumulado = 0
  for (const t of TRAJETO) {
    if (t.id === 'escola') return { de: acumulado, ate: acumulado + t.metros }
    acumulado += t.metros
  }
  return { de: 470, ate: 640 }
})()

/**
 * Qual das tres fachadas usar.
 *
 * Clone de three.js divide o material, entao variacao por cor nao existe:
 * so peca separada no catalogo. Sem isto a mesma casa se repete 37 vezes
 * em 1.340 m, e fachada repetida e papel de parede, nao bairro.
 */
function casaVar(n: number): 'casa' | 'casa_b' | 'casa_c' {
  const t = ((n * 7.13) % 1 + 1) % 1
  return t < 0.4 ? 'casa' : t < 0.72 ? 'casa_b' : 'casa_c'
}

export function paisagem(distanciaTotal: number): Marco[] {
  const saida: Marco[] = []
  const fim = distanciaTotal + ALCANCE
  for (let m = 0; m < fim; m += TRECHO) {
    saida.push({ peca: 'poste', metro: m + 6, x: BORDA_DIR - 1.5 })
    saida.push({ peca: 'cabos', metro: m + 6, x: BORDA_DIR - 1.5 })
  }
  // embaralhamento barato e estável: um gerador linear congruente por índice
  let semente = 7
  const proximo = () => (semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648

  // Em ZONAS, não em ruído uniforme.
  //
  // A versão antiga sorteava uma peça a cada 18 m entre quatro opções: na
  // prática cada categoria caía a cada 70-100 m, e com 320 m de alcance isso
  // é uma casa, duas árvores e um descampado verde até o horizonte. Era a
  // "reta longa e monótona" do retorno do cliente.
  //
  // Agora o trajeto atravessa lugares diferentes, que é o que uma saída de
  // pátio até uma ocorrência atravessa de verdade: pátio, bairro, entorno de
  // escola, e de novo bairro chegando. A fronteira entre eles é o que dá
  // sensação de percurso — num descampado uniforme ninguém sente que andou.
  const zonaDe = (m: number) =>
    m < ZONA_PATIO.ate + 25 ? 'patio'
      : m < ZONA_ESCOLA.de ? 'bairro'
      : m < ZONA_ESCOLA.ate ? 'escola'
      : 'bairro'

  // O passo é 10 m porque é o módulo do muro da escola, que TEM de ladrilhar
  // sem vão. As casas saem a cada 20 m (uma a cada dois passos): com 7,5 m de
  // largura isso dá frontaria legível e mantém o número de objetos na tela
  // dentro do que um mini-PC de totem aguenta. A conta está em `picoVisivel`,
  // e o auto-teste no fim deste arquivo é que diz se cabe no pool.
  let passo = 0
  for (let m = 0; m < fim; m += 10) {
    const r = proximo()
    const zona = zonaDe(m)
    const casaAqui = passo++ % 2 === 0

    if (zona === 'patio') {
      // PÁTIO DE VERDADE, não descampado com placa de 20.
      //
      // O trecho era um aviso sem lugar: o jogador reduzia por obediência e
      // não traduzia nada para o trabalho dele. Um pátio tem muro nos dois
      // lados, frota estacionada em espinha e gente andando entre os
      // veículos — e é a FROTA PARADA que explica o limite sozinha: não se
      // anda a 60 onde alguém pode sair de trás de uma caçamba.
      // O MÓDULO DO MURO CORRE NO X DELE, NÃO NO Z.
      //
      // `muro_patio` é feito em `arte/blender/via.py` como um módulo de 10 m
      // ladrilhável ao longo do X da peça (medido: x de -4,85 a 5,00, e só
      // 0,26 m de espessura em z). Posto com giro 0 a cada 10 m de TRAJETO,
      // ele virava uma cerca de 26 lajes ATRAVESSADAS na via: cada uma ia de
      // x -10,80 a -0,95, ou seja 0,80 m dentro do asfalto, e o caminhão
      // passava por dentro das 26. De dentro da cabine isso lê como um muro
      // contínuo em perspectiva, que é por que ninguém viu de olho.
      //
      // Com o giro de 90° o módulo corre ao lado da via, como muro de pátio.
      saida.push({ peca: 'muro_patio', metro: m, x: MURO_DIR,
                   giro: Math.PI / 2 })
      saida.push({ peca: 'muro_patio', metro: m, x: MURO_ESQ,
                   giro: -Math.PI / 2 })
      // Frota estacionada EM PARALELO, não em espinha.
      //
      // Em espinha o ônibus ocupava 8,7 m de largura a partir de x 3,81 —
      // 1,45 m de asfalto. E não há onde pô-lo em espinha: entre o
      // acostamento e o muro cabem 4,5 m, e o ônibus tem 8,7 de comprimento.
      // Encostado em paralelo ele continua sendo o vulto de onde alguém pode
      // sair, que é o que o trecho ensina, e cabe.
      if (passo % 2 === 0) {
        saida.push({ peca: 'carro', metro: m + 1.5, x: -5.1 })
      } else {
        saida.push({ peca: 'onibus', metro: m + 2, x: 10.1 })
      }
      if (r < 0.5) {
        // encostado no muro: na faixa de estacionamento ele ficava dentro do
        // carro (1,40 m de sobreposição, medido)
        saida.push({ peca: 'arbusto', metro: m + r * 6, x: -7.3 })
      }
      continue
    }

    if (zona === 'escola') {
      // o muro corre pela esquerda inteira; a frontaria de casa fica só na
      // direita, senão as duas somam objeto demais no mesmo trecho
      /*
        UM módulo de ENTRADA no meio da quadra, e o resto de muro.

        "Sem porta, e todos do mesmo tamanho?" — a escola era o mesmo módulo
        de 10 m repetido do começo ao fim. Ninguém constrói escola sem
        entrada, e a entrada é justamente por onde a criança sai para a
        faixa que o jogador tem de respeitar: sem ela o trecho escolar não
        tem por que existir.

        O portão cai no módulo mais próximo do meio da zona, para ficar em
        quadro enquanto o jogador atravessa o trecho.
      */
      const meioDaEscola = (ZONA_ESCOLA.de + ZONA_ESCOLA.ate) / 2
      const noPortao = Math.abs(m - meioDaEscola) < 5
      saida.push({
        peca: noPortao ? 'escola_portao' : 'escola',
        metro: m, x: BORDA_ESQ + 7.6,
      })
      if (casaAqui) {
        saida.push({ peca: casaVar(r), metro: m + 4, x: CASA_DIR - r * 1.6 })
      }
      if (r < 0.55) {
        saida.push({ peca: 'arvore', metro: m + r * 9, x: ARVORE_DIR,
                     giro: r * 6 })
      }
      continue
    }

    // bairro: frontaria dos dois lados
    if (casaAqui) {
      // A escola tem 14,5 m de fundo e é posta a cada 10 m: o último módulo
      // do trecho escolar avança 15 m dentro do bairro. A casa da esquerda
      // nascia em cima dele (2,97 m de sobreposição, medido), então ela só
      // começa depois que a escola acaba de verdade.
      const saindoDaEscola = m >= ZONA_ESCOLA.ate && m < ZONA_ESCOLA.ate + 15
      if (!saindoDaEscola) {
        saida.push({ peca: casaVar(r + 0.37), metro: m, x: CASA_ESQ + r * 1.6,
                     giro: Math.PI })
      }
      saida.push({ peca: casaVar(r + 0.81), metro: m + 6 + r * 3,
                   x: CASA_DIR - r * 1.6 })
    }

    // arborização de calçada, alternando o lado para não virar corredor
    if (r < 0.34) {
      saida.push({ peca: 'arvore', metro: m + r * 9, x: ARVORE_ESQ,
                   giro: r * 6 })
    } else if (r < 0.66) {
      saida.push({ peca: 'arvore', metro: m + r * 9, x: ARVORE_DIR,
                   giro: r * 6 })
    } else if (r < 0.88) {
      saida.push({ peca: 'arbusto', metro: m + r * 7, x: BORDA_DIR - 3.4 })
    }
  }
  return saida
}


/**
 * Quantas cópias de cada peça podem estar na tela ao mesmo tempo.
 *
 * Mora AQUI, do lado de `paisagem`, e não em `Via.tsx`: os dois números são a
 * mesma decisão vista de dois lados, e mantidos em arquivos diferentes saem
 * de sincronia na primeira vez que a densidade muda. O auto-teste abaixo
 * compara este mapa com o pico real.
 *
 * Os valores são o pico medido mais folga. Pool menor que o pico faz a
 * fileira sumir no meio — foi o defeito que a primeira versão desta rodada
 * tinha em quatro peças de uma vez.
 */
/**
 * E É COMPLETO, não parcial: `Via.tsx` desenha uma fileira por chave daqui.
 *
 * Era `Partial`, e a lista de fileiras morava em `Via.tsx` escrita à mão. As
 * duas saíram de sincronia exatamente como o comentário acima temia, só que
 * no sentido pior: `carro` tinha marcos (6 no pátio, desde sempre), tinha
 * pico medido e NÃO estava na lista — os seis carros eram calculados a cada
 * quadro e jogados fora. O auto-teste ficava verde porque conferia teto de
 * cópias, e teto de cópias de uma peça que ninguém desenha cabe sempre.
 *
 * Agora peça sem fileira é impossível por construção, e o auto-teste ainda
 * reclama se `paisagem` emitir uma peça que não esteja aqui.
 */
export const POOL: Record<Marco['peca'], number> = {
  poste: 12, cabos: 12,
  casa: 24, casa_b: 18, casa_c: 15,
  escola: 33,
  // uma por trajeto: e a entrada, nao o muro
  escola_portao: 2,
  // duas fileiras, uma a cada 10 m, nos dois lados do pátio
  muro_patio: 30,
  arvore: 31,
  arbusto: 34,
  // frota parada do pátio
  carro: 10,
  onibus: 10,
  // peças de evento: uma de cada no trajeto inteiro
  placa: 10, lombada: 10, faixa_pedestre: 10, semaforo: 10, cruzamento: 4,
  // 1 e não 10: o ciclista saiu da fileira e ganhou componente próprio em
  // `Via.tsx`, porque REAGE a quem passa colado. A entrada fica para o molde
  // continuar sendo procurado por `FILEIRAS`; as cópias não são usadas.
  ciclista: 1,
}

/** As fileiras que `Via.tsx` monta, na ordem. Fonte única com o POOL. */
export const FILEIRAS = Object.keys(POOL) as Marco['peca'][]

/**
 * Auto-teste: roda com `node --experimental-strip-types src/cena/paisagem.ts`.
 *
 * Mede o que importa — quantas peças de cada tipo ficam visíveis ao mesmo
 * tempo. É esse número que o pool de cópias em `Via.tsx` tem de cobrir: pool
 * menor que o pico e a fileira some no meio, que foi exatamente o defeito.
 */
export function picoVisivel(total = 1340) {
  const marcos = paisagem(total)
  const pico: Record<string, number> = {}
  for (let d = 0; d <= total; d += 20) {
    const conta: Record<string, number> = {}
    for (const m of marcos) {
      const z = m.metro - d
      if (z < -TRECHO || z > ALCANCE) continue
      conta[m.peca] = (conta[m.peca] ?? 0) + 1
    }
    for (const [k, v] of Object.entries(conta)) {
      if (v > (pico[k] ?? 0)) pico[k] = v
    }
  }
  return pico
}

// `globalThis.process` em vez de `process`: o arquivo também é empacotado
// para o navegador, e tipar `process` aqui exigiria @types/node no projeto
// inteiro por causa de um auto-teste.
const nodejs = (globalThis as {
  process?: { env?: Record<string, string | undefined>; exit?: (n: number) => void }
}).process

if (nodejs?.env?.PAISAGEM_TESTE) {
  const pico = picoVisivel()
  const pool = POOL as Record<string, number>
  let erros = 0
  for (const [peca, n] of Object.entries(pico)) {
    const teto = pool[peca] ?? 10
    const ok = n <= teto
    if (!ok) erros++
    console.log(`${ok ? 'ok  ' : 'FALHA'} ${peca}: pico ${n}, pool ${teto}`)
  }
  if (!pico.escola) { console.log('FALHA escola: nenhuma no trajeto'); erros++ }
  // peça emitida sem fileira para desenhá-la: foi o defeito do `carro`
  for (const peca of Object.keys(pico)) {
    if (peca in POOL) continue
    console.log(`FALHA ${peca}: tem marcos e não tem fileira (falta no POOL)`)
    erros++
  }
  if (erros) {
    console.error(`${erros} peça(s) com pool menor que o pico`)
    nodejs.exit?.(1)
  } else {
    console.log('paisagem: todos os picos cabem no pool')
  }
}

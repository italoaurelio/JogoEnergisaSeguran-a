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

/** Uma peça colocada em algum ponto do trajeto. */
export type Marco = {
  peca: 'poste' | 'cabos' | 'arvore' | 'arbusto' | 'casa' | 'placa'
    | 'carro' | 'lombada' | 'faixa_pedestre' | 'semaforo' | 'onibus'
    | 'ciclista' | 'escola' | 'muro_patio'
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
      saida.push({ peca: 'muro_patio', metro: m, x: BORDA_DIR - 4.2 })
      saida.push({ peca: 'muro_patio', metro: m, x: BORDA_ESQ + 4.2,
                   giro: Math.PI })
      // frota estacionada, alternando os lados para o olho ter o que seguir
      if (passo % 2 === 0) {
        saida.push({ peca: 'carro', metro: m + 1.5, x: BORDA_DIR - 2.7,
                     giro: Math.PI / 2 })
      } else {
        saida.push({ peca: 'onibus', metro: m + 2, x: BORDA_ESQ + 2.9,
                     giro: -Math.PI / 2 })
      }
      if (r < 0.5) {
        saida.push({ peca: 'arbusto', metro: m + r * 6, x: BORDA_DIR - 3.6 })
      }
      continue
    }

    if (zona === 'escola') {
      // o muro corre pela esquerda inteira; a frontaria de casa fica só na
      // direita, senão as duas somam objeto demais no mesmo trecho
      saida.push({ peca: 'escola', metro: m, x: BORDA_ESQ + 7.6 })
      if (casaAqui) {
        saida.push({ peca: 'casa', metro: m + 4, x: BORDA_DIR - 9.0 - r * 1.6 })
      }
      if (r < 0.55) {
        saida.push({ peca: 'arvore', metro: m + r * 9, x: BORDA_DIR - 3.0,
                     giro: r * 6 })
      }
      continue
    }

    // bairro: frontaria dos dois lados
    if (casaAqui) {
      saida.push({ peca: 'casa', metro: m, x: BORDA_ESQ + 8.2 + r * 1.6,
                   giro: Math.PI })
      saida.push({ peca: 'casa', metro: m + 6 + r * 3, x: BORDA_DIR - 9.0 - r * 1.6 })
    }

    // arborização de calçada, alternando o lado para não virar corredor
    if (r < 0.34) {
      saida.push({ peca: 'arvore', metro: m + r * 9, x: BORDA_ESQ + 3.4,
                   giro: r * 6 })
    } else if (r < 0.66) {
      saida.push({ peca: 'arvore', metro: m + r * 9, x: BORDA_DIR - 3.2,
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
export const POOL: Partial<Record<Marco['peca'], number>> = {
  poste: 12, cabos: 12,
  casa: 40,
  escola: 33,
  // duas fileiras, uma a cada 10 m, nos dois lados do pátio
  muro_patio: 30,
  arvore: 31,
  arbusto: 34,
}

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
  if (erros) {
    console.error(`${erros} peça(s) com pool menor que o pico`)
    nodejs.exit?.(1)
  } else {
    console.log('paisagem: todos os picos cabem no pool')
  }
}

/**
 * Auto-teste: a tela não pode entregar o gabarito.
 *
 * Roda com `npm run gabarito`. Simula o jogador que **sempre clica a primeira
 * alternativa**, sem ler nada, e exige que ele REPROVE.
 *
 * Existe porque numa partida completa em 06/10/2026 esse jogador tirou 164 de
 * 164 na ocorrência. Os catálogos são escritos com a resposta certa em
 * primeiro — é assim que se lê um catálogo — e a tela mostrava na ordem do
 * arquivo. O vestiário tinha o certo em primeiro em 6 das 7 etapas, a chegada
 * nas 3 decisões, e o reparo nos 9 passos, que são os que mais valem ponto.
 *
 * O teste é sobre a TELA, não sobre a nota: se um dia alguém listar opção
 * direto do catálogo em vez de usar `pecasDaVaga` / `opcoesNaTela` /
 * `passosNaTela`, isto falha.
 */
import { PECAS, VAGAS, pecasDaVaga, type Vaga } from './epi.ts'
import { CHEGADA, PASSOS, opcoesNaTela, passosNaTela } from './ocorrencia.ts'

const ORDEM_VAGAS: Vaga[] = [
  'cabeca', 'face', 'corpo', 'maos', 'pes', 'cintura', 'adorno',
]

/** Quanto tira, e quanto vale, quem clica sempre o primeiro botão. */
export function sempreOPrimeiro() {
  let feito = 0
  let maximo = 0

  for (const v of ORDEM_VAGAS) {
    const todas = PECAS.filter((p) => p.vaga === v)
    maximo += todas.reduce((m, p) => Math.max(m, p.pontos), 0)
    feito += pecasDaVaga(v)[0]?.pontos ?? 0
  }

  for (const d of CHEGADA) {
    maximo += d.pontos
    if (opcoesNaTela(d)[0]?.certa) feito += d.pontos
  }

  // reparo: pega sempre o primeiro dos que sobraram
  const escolhidos: string[] = []
  while (escolhidos.length < PASSOS.length) {
    const p = passosNaTela().find((x) => !escolhidos.includes(x.id))
    if (!p) break
    escolhidos.push(p.id)
  }
  PASSOS.forEach((esperado, i) => {
    maximo += 6
    if (escolhidos[i] === esperado.id) feito += 6
  })

  return { feito, maximo, porcento: Math.round((feito / maximo) * 100) }
}

const nodejs = (globalThis as {
  process?: { env?: Record<string, string | undefined>; exit?: (n: number) => void }
}).process

if (nodejs?.env?.GABARITO_TESTE) {
  const CORTE = 70
  const r = sempreOPrimeiro()
  console.log(`clicando sempre o primeiro: ${r.feito}/${r.maximo} = ${r.porcento}%`)

  // Onde o certo ainda encabeça a lista. Um ou outro é aceitável — com sete
  // vagas e três decisões, zero seria suspeito de não estar embaralhando.
  const primeiros: string[] = []
  for (const v of ORDEM_VAGAS) {
    if (pecasDaVaga(v)[0]?.veredito === 'correta') primeiros.push(VAGAS[v].nome)
  }
  for (const d of CHEGADA) {
    if (opcoesNaTela(d)[0]?.certa) primeiros.push(d.nome)
  }
  if (passosNaTela()[0]?.id === PASSOS[0].id) primeiros.push('reparo (1º passo)')
  console.log(`certo em primeiro em ${primeiros.length} lista(s): ${primeiros.join(', ') || '—'}`)

  if (r.porcento >= CORTE) {
    console.error(`FALHA: quem não lê nada passa (corte é ${CORTE}%). A tela está entregando o gabarito.`)
    nodejs.exit?.(1)
  } else {
    console.log(`ok: quem não lê nada reprova (corte ${CORTE}%)`)
  }
}

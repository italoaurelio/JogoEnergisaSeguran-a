/**
 * Pontuação do treinamento inteiro.
 *
 * Cumulativa nas três fases, com um corte único no fim — decisão travada com o
 * cliente. Não existe reprovação instantânea: errar não interrompe o jogador no
 * meio da fase, porque o objetivo é ele chegar ao relatório e ver tudo junto.
 */

export type Fase = 'vestiario' | 'cabine' | 'trajeto' | 'ocorrencia'

export const NOME_FASE: Record<Fase, string> = {
  vestiario: 'Vestiário',
  cabine: 'Conferência do veículo',
  trajeto: 'Trajeto',
  ocorrencia: 'Ocorrência',
}

/** Uma decisão tomada pelo jogador, do jeito que vai sair no relatório. */
export type Registro = {
  fase: Fase
  id: string
  titulo: string
  veredito: 'correta' | 'incompleta' | 'incorreta'
  pontos: number
  porque: string
  norma: string
}

/** Abaixo disso o treinamento é reprovado. */
export const CORTE = 0.7

export type Resultado = {
  pontos: number
  maximo: number
  fracao: number
  aprovado: boolean
}

export function somar(registros: Registro[], maximo: number): Resultado {
  const pontos = registros.reduce((t, r) => t + r.pontos, 0)
  // o piso em zero evita nota negativa, que confunde sem informar nada: o
  // relatório já mostra cada erro em separado
  const fracao = maximo > 0 ? Math.max(0, pontos) / maximo : 0
  return { pontos, maximo, fracao, aprovado: fracao >= CORTE }
}

export function porFase(registros: Registro[]): Record<Fase, Registro[]> {
  const saida = {
    vestiario: [], cabine: [], trajeto: [], ocorrencia: [],
  } as Record<Fase, Registro[]>
  for (const r of registros) saida[r.fase].push(r)
  return saida
}

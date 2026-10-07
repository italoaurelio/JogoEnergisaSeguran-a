/**
 * Ordem de APRESENTAÇÃO das alternativas.
 *
 * Os catálogos são escritos com a resposta certa em primeiro lugar, porque é
 * assim que se lê um catálogo: o item correto encabeça e os distratores vêm
 * depois. Só que a tela mostra na mesma ordem do arquivo — e aí o jogo inteiro
 * se ganha clicando sempre no primeiro botão.
 *
 * Medido numa partida completa em 06/10/2026: primeiro item certo em 6 das 7
 * etapas do vestiário, nas 3 decisões de chegada da ocorrência, e nos 9 passos
 * do reparo — que são justamente os que mais valem ponto, porque a ordem do
 * procedimento é o que mata quando invertida. Resultado: 164 de 164 na fase 3
 * clicando o primeiro nove vezes seguidas.
 *
 * O embaralhamento é DETERMINÍSTICO, por hash do identificador: dois
 * colaboradores têm de fazer exatamente a mesma prova, senão a nota não é
 * comparável — a mesma regra que vale para o cenário do trajeto. E é estável
 * entre partidas, então o relatório de um pode ser discutido com o outro.
 *
 * Mexer no `id` de uma peça muda a posição dela na tela. Isso é de propósito:
 * `id` é identidade, não rótulo, e já existe um teste que falha se o
 * embaralhamento voltar a deixar o certo em primeiro.
 */

/** Hash estável de string (djb2 reduzido). Mesmo valor em qualquer máquina. */
function cod(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0
  return h
}

/**
 * Embaralha de forma determinística, por hash da chave.
 *
 * `sal` separa listas que compartilham identificadores — sem ele, duas listas
 * com os mesmos ids sairiam na mesma ordem relativa.
 */
export function embaralhar<T>(itens: T[], chave: (t: T) => string, sal = ''): T[] {
  return [...itens].sort((a, b) => cod(sal + chave(a)) - cod(sal + chave(b)))
}

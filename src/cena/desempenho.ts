/**
 * Um lugar só para decidir se a máquina aguenta o acabamento de imagem.
 *
 * O jogo nasceu para o totem e para o .exe, onde há GPU de desktop. No
 * navegador do tablet Android a mesma cena fica injogável — e o gargalo não é
 * a geometria, é o que roda DEPOIS dela: oclusão ambiente, bloom e
 * antisserrilhado, todos em tela cheia e a 1,5 pixel por pixel.
 *
 * Nada aqui é automático demais para ser conferido: `?leve=1` força o modo
 * leve numa máquina forte e `?leve=0` força o pesado no tablet, que é como se
 * compara os dois no MESMO aparelho. Sem esse par, a única medida possível
 * seria "achei que melhorou".
 */

function detectar(): boolean {
  const busca = new URLSearchParams(window.location.search)
  if (busca.has('leve')) return busca.get('leve') !== '0'
  // Toque grosso: tablet e celular. O Electron do totem e o desktop têm
  // ponteiro fino e seguem no caminho pesado.
  return window.matchMedia('(pointer: coarse)').matches
}

export const LEVE = detectar()

/** `?fps=1` liga o contador de quadros — é com ele que se mede no aparelho. */
export const MOSTRAR_FPS =
  new URLSearchParams(window.location.search).has('fps')

/**
 * Pixels de desenho por pixel de CSS. Em `1.5` o tablet desenhava 2,25 vezes
 * mais pixels do que a tela mostra — a conta mais cara da lista.
 *
 * Abaixo de 1 a cena 3D é desenhada menor e esticada. Dá para ir longe sem
 * feiura porque o HUD É HTML: texto, botões e cartas continuam na resolução
 * da tela, e só a imagem da cena amolece. `?dpr=1` volta ao tamanho cheio,
 * `?dpr=0.6` aperta mais — é o botão de volume do desempenho, e o único
 * jeito de achar o ponto certo no aparelho de verdade.
 */
function dprPedido(): number {
  const v = Number(new URLSearchParams(window.location.search).get('dpr'))
  return v > 0 && v <= 2 ? v : 0.8
}

export const DPR: number | [number, number] = LEVE ? dprPedido() : [1, 1.5]

/**
 * Mapas de sombra. Constantes de módulo, e não calculadas na renderização:
 * trocar o ARRAY faz o three jogar fora o mapa e assar outro.
 */
export const SOMBRA_ALTA: [number, number] = LEVE ? [1024, 1024] : [4096, 4096]
export const SOMBRA_MEDIA: [number, number] = LEVE ? [1024, 1024] : [2048, 2048]

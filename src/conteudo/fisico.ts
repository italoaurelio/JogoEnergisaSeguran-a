/**
 * Montagem física do personagem.
 *
 * O corpo sai do Blender num físico só, com o mapa da pele assado num tom
 * NEUTRO. A altura é escala em tempo de execução e o tom é a cor do material
 * multiplicando o mapa — por isso as opções de tom são multiplicadores, não
 * cores absolutas.
 *
 * PORTE (magro/médio/forte) não entra, e agora está medido e não suposto: o
 * `.glb` publicado tem ZERO malhas com morph target (conferido no jogo
 * varrendo `morphTargetInfluences`). Porte exigiria o morph no corpo E em
 * cada uma das 19 peças de roupa, porque elas são recortadas da superfície
 * dele — sem isso a roupa não acompanha e atravessa a pele.
 *
 * O que o modelo PERMITE variar em tempo real é escala e cor de material. Por
 * isso as escolhas são altura (escala), tom de pele (cor sobre o mapa assado)
 * e cor de cabelo — o cabelo é nó próprio, com material próprio, e sai de
 * graça.
 */

export type OpcaoAltura = { id: string; nome: string; metros: number }

export const ALTURAS: OpcaoAltura[] = [
  { id: 'a1', nome: '1,60 m', metros: 1.60 },
  { id: 'a2', nome: '1,68 m', metros: 1.68 },
  { id: 'a3', nome: '1,75 m', metros: 1.75 },
  { id: 'a4', nome: '1,82 m', metros: 1.82 },
  { id: 'a5', nome: '1,90 m', metros: 1.90 },
]

export type OpcaoTom = {
  id: string
  nome: string
  /** Multiplicador linear sobre o mapa assado. */
  tom: [number, number, number]
  /** Amostra para o botão da interface. */
  amostra: string
}

// O mapa da pele e assado no tom neutro (0.30, 0.215, 0.165), que ja e um
// tom de pele real — por isso os multiplicadores giram em torno de 1.0.
// Se TOM_NEUTRO mudar em arte/blender/exportar_personagem.py, esta tabela
// muda junto.
export const TONS: OpcaoTom[] = [
  { id: 't1', nome: 'Tom 1', tom: [1.78, 1.90, 1.96], amostra: '#f3d7ba' },
  { id: 't2', nome: 'Tom 2', tom: [1.52, 1.58, 1.62], amostra: '#e4bf9b' },
  { id: 't3', nome: 'Tom 3', tom: [1.26, 1.28, 1.30], amostra: '#cfa47c' },
  { id: 't4', nome: 'Tom 4', tom: [1.08, 1.06, 1.04], amostra: '#b98a5f' },
  { id: 't5', nome: 'Tom 5', tom: [1.00, 1.00, 1.00], amostra: '#ab7c53' },
  { id: 't6', nome: 'Tom 6', tom: [0.80, 0.76, 0.72], amostra: '#946844' },
  { id: 't7', nome: 'Tom 7', tom: [0.62, 0.58, 0.54], amostra: '#78553a' },
  { id: 't8', nome: 'Tom 8', tom: [0.40, 0.36, 0.32], amostra: '#593b24' },
]

export type OpcaoCabelo = {
  id: string
  nome: string
  /** Cor absoluta do material `cabelo`. */
  cor: [number, number, number]
  amostra: string
}

/**
 * Cor do cabelo. O corte é um só — raspado, recortado do grupo `scalp` — e
 * trocar o CORTE exigiria uma malha por opção. A cor é o material, então é a
 * única variação que o modelo publicado permite sem reexportar.
 */
export const CABELOS: OpcaoCabelo[] = [
  { id: 'c1', nome: 'Preto', cor: [0.014, 0.010, 0.008], amostra: '#1b1512' },
  { id: 'c2', nome: 'Castanho escuro', cor: [0.030, 0.019, 0.012], amostra: '#33241a' },
  { id: 'c3', nome: 'Castanho', cor: [0.062, 0.038, 0.021], amostra: '#4e3826' },
  { id: 'c4', nome: 'Ruivo', cor: [0.098, 0.040, 0.016], amostra: '#6b3a22' },
  { id: 'c5', nome: 'Grisalho', cor: [0.115, 0.112, 0.108], amostra: '#6e6b67' },
]

export const FISICO_INICIAL = {
  altura: ALTURAS[2].metros,
  tom: TONS[4].tom,
  cabelo: CABELOS[0].cor,
}

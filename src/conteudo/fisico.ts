/**
 * Montagem física do personagem.
 *
 * O corpo sai do Blender num físico só, com o mapa da pele assado num tom
 * NEUTRO. A altura é escala em tempo de execução e o tom é a cor do material
 * multiplicando o mapa — por isso as opções de tom são multiplicadores, não
 * cores absolutas.
 *
 * Porte (magro/médio/forte) ainda não entra aqui: exige morph target no .glb,
 * presente no corpo E em cada peça de roupa, senão a roupa não acompanha.
 */

export type OpcaoAltura = { id: string; nome: string; metros: number }

export const ALTURAS: OpcaoAltura[] = [
  { id: 'baixa', nome: '1,65 m', metros: 1.65 },
  { id: 'media', nome: '1,75 m', metros: 1.75 },
  { id: 'alta', nome: '1,86 m', metros: 1.86 },
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
  { id: 't1', nome: 'Tom 1', tom: [1.62, 1.72, 1.80], amostra: '#eccaa8' },
  { id: 't2', nome: 'Tom 2', tom: [1.26, 1.28, 1.30], amostra: '#cfa47c' },
  { id: 't3', nome: 'Tom 3', tom: [1.00, 1.00, 1.00], amostra: '#ab7c53' },
  { id: 't4', nome: 'Tom 4', tom: [0.68, 0.64, 0.60], amostra: '#835b3a' },
  { id: 't5', nome: 'Tom 5', tom: [0.42, 0.38, 0.34], amostra: '#5c3d26' },
]

export const FISICO_INICIAL = {
  altura: ALTURAS[1].metros,
  tom: TONS[2].tom,
}

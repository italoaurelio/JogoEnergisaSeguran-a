/**
 * Partida de exemplo, só para conferir o RELATÓRIO sem jogar as duas fases.
 *
 * O relatório é o material que o instrutor leva para a conversa depois, e era
 * a única tela do jogo que não dava para abrir e olhar: ela só existe depois
 * de oito a quinze minutos de partida. Sem isto, mexer no desenho dela custa
 * uma sessão inteira por tentativa.
 *
 * A cabine e o trajeto saíram do exemplo junto com as fases (20/10): um
 * relatório de exemplo com fase que o jogador não joga mais atrapalha em vez
 * de ajudar, porque é justamente nele que se confere o desenho da tela.
 *
 * Só em desenvolvimento.
 */
import type { Registro } from './pontuacao'

const REGISTROS: Registro[] = [
  {
    fase: 'vestiario', id: 'cabeca', titulo: 'Proteção da cabeça',
    veredito: 'correta', pontos: 12,
    porque: 'Capacete classe B com jugular, que é o exigido para trabalho com risco elétrico.',
    norma: 'NR-6 e NR-10 — capacete classe B para risco elétrico',
  },
  {
    fase: 'vestiario', id: 'maos', titulo: 'Proteção das mãos',
    veredito: 'incompleta', pontos: 6,
    porque: 'A luva isolante está certa, mas foi vestida sem a luva de cobertura. A isolante é de borracha e fura no primeiro contato com ferragem — a de cobertura existe para protegê-la.',
    norma: 'NR-10 — luva isolante com cobertura de vaqueta',
  },
  {
    fase: 'ocorrencia', id: 'sequencia', titulo: 'Sequência do reparo',
    veredito: 'incorreta', pontos: 0,
    porque: 'O aterramento temporário foi instalado antes de testar a ausência de tensão. Aterrar um circuito ainda energizado fecha o curto pela sua ferramenta.',
    norma: 'NR-10, 10.5.1 — desenergização: as etapas na ordem',
  },
  {
    fase: 'ocorrencia', id: 'sinalizacao', titulo: 'Sinalização da área',
    veredito: 'correta', pontos: 22,
    porque: 'Cones recuados na distância correta e área delimitada antes de qualquer serviço.',
    norma: 'NR-10 e NR-18 — sinalização e isolamento da área de trabalho',
  },
]

export const REGISTROS_EXEMPLO: Registro[] = REGISTROS

/** Os máximos das duas fases, para a nota de exemplo fechar com a real. */
export const MAXIMO_EXEMPLO = 72 + 164

/** Quanto cada fase valia, para o placar por fase do relatório de exemplo. */
export const MAXIMO_POR_FASE_EXEMPLO = {
  vestiario: 72,
  ocorrencia: 164,
}

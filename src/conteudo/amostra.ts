/**
 * Partida de exemplo, só para conferir o RELATÓRIO sem jogar as quatro fases.
 *
 * O relatório é o material que o instrutor leva para a conversa depois, e era
 * a única tela do jogo que não dava para abrir e olhar: ela só existe depois
 * de oito a quinze minutos de partida. Sem isto, mexer no desenho dela custa
 * uma sessão inteira por tentativa.
 *
 * As faltas do trajeto vêm do catálogo DE VERDADE, passando pela mesma
 * `montarRegistros` que a fase usa — se o texto de uma norma mudar, muda aqui
 * junto. Só as outras três fases são escritas à mão.
 *
 * Só em desenvolvimento.
 */
import { montarRegistros } from '../fases/Trajeto'
import { MAXIMO_TRAJETO } from './trajeto'
import type { Registro } from './pontuacao'

/** Um trajeto com três faltas: excesso, semáforo e ciclista. */
const TRAJETO_EXEMPLO = montarRegistros({
  excesso: 9.4, semaforo: 1, ciclista: 1,
})

const OUTRAS: Registro[] = [
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
    fase: 'cabine', id: 'cinto', titulo: 'Cinto de segurança',
    veredito: 'correta', pontos: 10,
    porque: 'Cinto afivelado antes da partida.',
    norma: 'CTB art. 65 — uso obrigatório do cinto',
  },
  {
    fase: 'cabine', id: 'carga', titulo: 'Carga na caçamba',
    veredito: 'incorreta', pontos: 0,
    porque: 'A carga saiu solta. Em frenagem de emergência a ferramenta vira projétil, e o que está atrás da cabine chega na cabine.',
    norma: 'CTB art. 235 — transportar carga sem o devido acondicionamento',
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

export const REGISTROS_EXEMPLO: Registro[] = [...OUTRAS, ...TRAJETO_EXEMPLO]

/** Os máximos das outras fases, para a nota de exemplo fechar com a real. */
export const MAXIMO_EXEMPLO = 72 + 58 + MAXIMO_TRAJETO + 164

/** Quanto cada fase valia, para o placar por fase do relatório de exemplo. */
export const MAXIMO_POR_FASE_EXEMPLO = {
  vestiario: 72,
  cabine: 58,
  trajeto: MAXIMO_TRAJETO,
  ocorrencia: 164,
}

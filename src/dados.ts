/**
 * Conteúdo do cenário 1 — "Manutenção em poste na via pública".
 *
 * Cada risco corresponde a um dos 8 comportamentos inseguros levantados pela
 * segurança do trabalho. `alvo` é o nome da malha no .glb; `marcador` é o ponto
 * onde o selo de encontrado aparece (vem de riscos.json, em coordenadas do jogo).
 */

export type Risco = {
  alvo: string
  item: number
  titulo: string
  oQueEsta: string
  porQue: string
  correto: string
  norma: string
}

export const RISCOS: Risco[] = [
  {
    alvo: 'risco_cone',
    item: 1,
    titulo: 'Área de trabalho sem sinalização',
    oQueEsta: 'O cone está tombado e a área do serviço não está isolada, com a equipe trabalhando na faixa de rolamento.',
    porQue: 'Sem isolamento e sinalização, o veículo que se aproxima só percebe a equipe em cima da hora. Atropelamento em serviço na via é uma das maiores causas de acidente grave na distribuição.',
    correto: 'Isolar a área com cones e placas antes de iniciar qualquer atividade, posicionando a sinalização na distância adequada à velocidade da via.',
    norma: 'NR-10 — isolamento e sinalização da área de trabalho',
  },
  {
    alvo: 'risco_apr',
    item: 2,
    titulo: 'Análise de risco não preenchida',
    oQueEsta: 'A prancheta está com a APR em branco. A equipe começou o serviço sem analisar os riscos da atividade.',
    porQue: 'A APR é o momento em que a equipe olha para o serviço específico daquele poste e enxerga o que pode dar errado. Pular essa etapa é começar o trabalho sem saber do que se proteger.',
    correto: 'Preencher a análise preliminar de risco com toda a equipe antes de iniciar, revisando a cada mudança de condição.',
    norma: 'NR-10 e NR-35 — análise de risco e autorização de trabalho',
  },
  {
    alvo: 'risco_isolador',
    item: 3,
    titulo: 'Isolador danificado não identificado',
    oQueEsta: 'O isolador de pino está solto e deslocado sobre a cruzeta — uma falha na instalação que passou despercebida na inspeção.',
    porQue: 'Isolador comprometido significa isolação comprometida. A falha pode evoluir para fuga de corrente pela cruzeta e para contato com quem sobe no poste.',
    correto: 'Inspecionar a estrutura antes de subir e registrar toda falha encontrada, substituindo o componente antes de prosseguir com o serviço.',
    norma: 'NR-10 — inspeção e manutenção das instalações elétricas',
  },
  {
    alvo: 'risco_capacete',
    item: 4,
    titulo: 'Capacete fora da cabeça',
    oQueEsta: 'O capacete está largado no chão, junto da caixa de ferramentas, enquanto o serviço acontece embaixo da rede.',
    porQue: 'Debaixo de um poste em manutenção, qualquer ferramenta ou componente que escapa lá de cima chega ao solo com energia suficiente para matar. O capacete só protege se estiver na cabeça.',
    correto: 'Usar o capacete com jugular ajustada durante toda a permanência na área de trabalho, sem exceção para quem está no solo.',
    norma: 'NR-6 e NR-35 — uso obrigatório de EPI na área',
  },
  {
    alvo: 'risco_luva',
    item: 5,
    titulo: 'Luva isolante usada de forma errada',
    oQueEsta: 'A luva isolante está jogada no chão, exposta ao sol e à sujeira, fora do estojo de proteção.',
    porQue: 'A borracha da luva isolante perde rigidez dielétrica com sol, óleo e perfuração. Uma luva guardada de qualquer jeito deixa de proteger sem dar nenhum sinal visível disso.',
    correto: 'Guardar a luva no estojo próprio, fazer o teste de estanqueidade antes de cada uso e respeitar a validade do ensaio elétrico.',
    norma: 'NR-6 e NR-10 — conservação e ensaio de EPI isolante',
  },
  {
    alvo: 'risco_ferramenta',
    item: 6,
    titulo: 'Ferramenta improvisada',
    oQueEsta: 'Uma chave de grifo está sendo usada como alavanca, função para a qual ela não foi projetada.',
    porQue: 'Ferramenta usada fora da função escapa, quebra ou espana sob esforço. O acidente típico é a mão do operador indo contra a estrutura no momento em que a peça cede.',
    correto: 'Usar a ferramenta certa para cada atividade e retirar de circulação toda ferramenta danificada ou adaptada.',
    norma: 'NR-12 — uso de ferramentas conforme a finalidade',
  },
  {
    alvo: 'risco_escada',
    item: 6,
    titulo: 'Escada mal posicionada',
    oQueEsta: 'A escada está com ângulo aberto demais e com o pé apoiado na pista, sem amarração no topo e sem calço na base.',
    porQue: 'Ângulo aberto faz a base escorregar sob o peso de quem sobe. Com o pé na faixa de rolamento, ainda soma o risco de ser atingida por um veículo.',
    correto: 'Apoiar a escada em torno de 75° com a base travada, amarrar o topo na estrutura e manter o pé fora da área de circulação de veículos.',
    norma: 'NR-35 — trabalho em altura com escada',
  },
  {
    alvo: 'risco_carga',
    item: 7,
    titulo: 'Carga solta na caçamba',
    oQueEsta: 'Caixa, rolo de cabo e barras estão soltos na caçamba, sem amarração nem travamento.',
    porQue: 'Em uma frenagem ou curva, a carga solta vira projétil — contra a cabine, contra quem está atrás do veículo ou contra a via.',
    correto: 'Amarrar e travar todo material e ferramental antes de sair, distribuindo o peso e respeitando a capacidade do veículo.',
    norma: 'NR-11 — transporte e movimentação de materiais',
  },
  {
    alvo: 'risco_ferramental',
    item: 8,
    titulo: 'Ambiente de trabalho desorganizado',
    oQueEsta: 'Ferramental espalhado pelo chão da calçada, no caminho de circulação da equipe e dos pedestres.',
    porQue: 'Ferramenta no chão é tropeço para quem trabalha e para quem passa. E ferramenta espalhada é ferramenta que some — inclusive a que deveria estar amarrada antes de subir.',
    correto: 'Manter o ferramental organizado na caixa, recolhendo cada peça logo após o uso e deixando a área de circulação livre.',
    norma: 'NR-12 — ordem e limpeza no ambiente de trabalho',
  },
]

export const ITENS_BRIEFING: Record<number, string> = {
  1: 'Conduzir os veículos de forma inadequada, sem observar as regras',
  2: 'Deixar de analisar os riscos envolvidos para cada atividade',
  3: 'Não identificar falhas no sistema elétrico de forma correta',
  4: 'Não utilizar os EPIs necessários para a atividade',
  5: 'Utilizar de forma errada os EPIs',
  6: 'Utilizar de forma errada ou improvisada as ferramentas',
  7: 'Transportar de forma inadequada material e ferramental no veículo',
  8: 'Manter desorganizado o ambiente de trabalho',
}

/** Pontos de observação. Coordenadas já no sistema do jogo (Y para cima). */
export type Ponto = {
  id: string
  nome: string
  posicao: [number, number, number]
  alvo: [number, number, number]
  /** Abertura da lente. Menor = mais perto, para olhar detalhe no alto da rede. */
  campo?: number
}

export const PONTOS: Ponto[] = [
  {
    id: 'chegada',
    nome: 'Chegada',
    posicao: [-4.6, 1.68, 6.4],
    alvo: [1.0, 2.0, 1.4],
  },
  {
    id: 'calcada',
    nome: 'Calçada',
    posicao: [-1.9, 1.6, 3.0],
    alvo: [-0.85, 0.3, 0.45],
  },
  {
    id: 'cacamba',
    nome: 'Caçamba',
    posicao: [4.1, 1.85, 4.4],
    alvo: [5.2, 1.35, 2.9],
  },
  {
    id: 'rede',
    nome: 'Olhar a rede',
    posicao: [3.4, 1.62, 4.8],
    alvo: [0.97, 8.95, -0.09],
    campo: 22,
  },
]

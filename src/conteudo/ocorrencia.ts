/**
 * Fase 3 — a ocorrência.
 *
 * REVISÃO PENDENTE, E AQUI MAIS DO QUE EM QUALQUER OUTRO LUGAR (Cristiano /
 * segurança do trabalho): a falha escolhida, o kit de ferramental que a
 * Energisa manda levar para ela e a sequência exata do procedimento. O que
 * está abaixo foi escrito a partir da NR-10 (as dez medidas de controle, a
 * ordem de desenergização e de reenergização) e da prática de manutenção em
 * rede aérea de distribuição. Quem é da área percebe qualquer desvio.
 *
 * Três etapas: chegar e isolar a área, separar o equipamento, e executar o
 * reparo na ordem certa. A ordem é a parte que mata quando invertida — é por
 * isso que ela vale mais pontos do que o resto da fase somado.
 */

/** A falha do dia. Sai no briefing e define o kit correto. */
export const OCORRENCIA = {
  titulo: 'Falta de energia em ramal monofásico',
  endereco: 'Rua das Acácias, 480 — poste com transformador',
  relato:
    'Três casas sem energia desde a madrugada. A vizinhança do outro lado da rua está normal.',
  diagnostico:
    'A chave fusível do transformador está aberta: o elo fusível queimou. O serviço é substituir o elo e religar.',
}

// --------------------------------------------------------------- 3a chegada

export type DecisaoChegada = {
  id: string
  nome: string
  pergunta: string
  opcoes: {
    id: string
    texto: string
    certa: boolean
    porque: string
  }[]
  norma: string
  pontos: number
  camera: { de: [number, number, number]; para: [number, number, number]; lente?: number }
}

export const CHEGADA: DecisaoChegada[] = [
  {
    id: 'posicao_veiculo',
    nome: 'Posição do veículo',
    pergunta: 'Onde parar o caminhão?',
    opcoes: [
      {
        id: 'protegendo',
        texto: 'Antes da área de trabalho, na faixa, servindo de barreira para a equipe',
        certa: true,
        porque:
          'O veículo estacionado antes da frente de serviço é a primeira barreira física: quem vem distraído bate nele, não na equipe. É também o que dá visibilidade à ocorrência de longe.',
      },
      {
        id: 'depois',
        texto: 'Depois da área, para não atrapalhar o trânsito',
        certa: false,
        porque:
          'Deixa a equipe exposta ao fluxo, sem nada entre ela e o veículo que se aproxima. O trânsito atrapalhado é o problema pequeno; a equipe sem barreira é o grande.',
      },
      {
        id: 'calcada',
        texto: 'Em cima da calçada, liberando a pista inteira',
        certa: false,
        porque:
          'Tira a barreira e ainda joga o pedestre para a pista, que é onde ele não deveria estar. Calçada é caminho de pedestre, inclusive de cadeirante e de quem empurra carrinho.',
      },
    ],
    norma: 'NR-10 e NR-18 — sinalização e isolamento da área de trabalho',
    pontos: 12,
    camera: { de: [-21, 6.5, 13], para: [-5, 2.0, 1.2], lente: 32 },
  },
  {
    id: 'distancia_sinalizacao',
    nome: 'Distância da sinalização',
    pergunta: 'A que distância posicionar os cones e o cavalete, antes da área?',
    opcoes: [
      {
        id: 'compativel',
        texto: 'Recuado, numa distância compatível com a velocidade da via',
        certa: true,
        porque:
          'A sinalização precisa aparecer com antecedência suficiente para o motorista perceber, decidir e frear. Numa via de 60 km/h isso é dezenas de metros, não dois passos.',
      },
      {
        id: 'colado',
        texto: 'Logo atrás do veículo, marcando onde a equipe está',
        certa: false,
        porque:
          'Cone colado no veículo avisa tarde demais: quando o motorista enxerga, já não tem distância para parar. Ele marca o obstáculo, não antecipa nada.',
      },
      {
        id: 'nada',
        texto: 'O serviço é rápido, o pisca-alerta resolve',
        certa: false,
        porque:
          'Serviço rápido é onde mais se morre, justamente porque se pula a preparação. O pisca-alerta indica um veículo parado; não indica gente trabalhando na pista.',
      },
    ],
    norma: 'NR-10 — sinalização na distância adequada à velocidade da via',
    pontos: 14,
    // DE DENTRO DO CARRO QUE VEM CHEGANDO, e não de cima.
    //
    // Esta câmera já foi corrigida uma vez, de teleobjetiva para grande
    // angular alta, e continuava errada pelo mesmo motivo de fundo: a
    // resposta certa espalha cavalete e cones de x=−27 a x=−14, e tudo
    // isso ficava ATRÁS do ponto de vista — quem escolhia "recuado" via
    // dois cones no canto e nenhum cavalete. O acerto parecia igual ao
    // erro, que é o pior defeito que uma pergunta sobre distância pode ter.
    //
    // Aqui o olho está na pista, a 2,6 m do chão e 35 m antes do poste,
    // olhando no sentido do trânsito: é a vista de quem dirige e vai
    // encontrar a equipe. O cavalete recuado chega grande no primeiro
    // plano, os cones afunilam ao longe e o caminhão aparece no fim. Com
    // "colado", o mesmo olho não vê nada até estar em cima do serviço —
    // que é exatamente o que a opção custa na vida real.
    camera: { de: [-34.5, 2.6, 6.2], para: [1.0, 2.2, 1.0], lente: 30 },
  },
  {
    id: 'area_trabalho',
    nome: 'Delimitação da área',
    pergunta: 'Como delimitar a área embaixo do poste?',
    opcoes: [
      {
        id: 'cercada',
        texto: 'Cercar com cones e fita, incluindo a projeção do poste no chão',
        certa: true,
        porque:
          'A área de risco não é só onde a equipe pisa: é tudo que pode receber uma ferramenta ou uma peça que caia lá de cima. A projeção do poste no chão faz parte dela.',
      },
      {
        id: 'so_cones',
        texto: 'Dois cones ao lado do poste',
        certa: false,
        porque:
          'Cone solto não delimita nada: o pedestre passa entre eles sem entender que está entrando numa área com risco de queda de material.',
      },
      {
        id: 'nenhuma',
        texto: 'Não precisa, a equipe fica atenta a quem passa',
        certa: false,
        porque:
          'Quem está trabalhando em altura não tem como vigiar o chão. A delimitação existe para funcionar sem ninguém olhando.',
      },
    ],
    norma: 'NR-10 — isolamento da área e proteção contra queda de materiais',
    pontos: 12,
    camera: { de: [7.5, 3.6, 6.5], para: [0, 2.2, 0.3], lente: 30 },
  },
]

export const MAXIMO_CHEGADA = CHEGADA.reduce((t, d) => t + d.pontos, 0)

// ----------------------------------------------------- 3b separar o equipamento

export type Ferramenta = {
  id: string
  nome: string
  descricao: string
  /** `true` se faz parte do kit correto para ESTA falha. */
  necessaria: boolean
  porque: string
  norma: string
  pontos: number
}

export const FERRAMENTAL: Ferramenta[] = [
  {
    id: 'vara_manobra',
    nome: 'Vara de manobra isolante',
    descricao: 'Bastão de fibra com cabeça de manobra, ensaio em dia',
    necessaria: true,
    porque:
      'É com ela que se abre e se fecha a chave fusível sem aproximar o corpo da parte energizada. O ensaio em dia é o que garante que a fibra ainda isola.',
    norma: 'NR-10 — ferramenta isolante com ensaio válido',
    pontos: 10,
  },
  {
    id: 'vara_trincada',
    nome: 'Vara de manobra com trinca',
    descricao: 'Mesma vara, com uma trinca longitudinal perto da cabeça',
    necessaria: false,
    porque:
      'Trinca na fibra acumula umidade e sujeira, e é por ali que a corrente encontra caminho. Vara danificada sai de circulação — não vai para o serviço "só desta vez".',
    norma: 'NR-10 — retirada de uso de ferramenta danificada',
    pontos: -12,
  },
  {
    id: 'detector_at',
    nome: 'Detector de tensão para alta',
    descricao: 'Detector com a faixa de tensão da rede, e a fonte de teste',
    necessaria: true,
    porque:
      'Constatar ausência de tensão não é olhar: é medir, com instrumento da faixa certa, testando o próprio detector antes e depois da medição.',
    norma: 'NR-10 — constatação da ausência de tensão',
    pontos: 12,
  },
  {
    id: 'multimetro',
    nome: 'Multímetro comum',
    descricao: 'Multímetro de bancada, categoria de baixa tensão',
    necessaria: false,
    porque:
      'Instrumento de baixa tensão em rede de distribuição explode na mão. A categoria do instrumento tem de ser compatível com a energia do ponto em que se mede.',
    norma: 'NR-10 — instrumento compatível com a instalação',
    pontos: -12,
  },
  {
    id: 'aterramento',
    nome: 'Conjunto de aterramento temporário',
    descricao: 'Cabos de cobre nu com grampos e bastão de aplicação',
    necessaria: true,
    porque:
      'É o aterramento que transforma "desligado" em "seguro": se alguém religar por engano, ou se a rede induzir tensão, a corrente vai para a terra e não para quem está no poste.',
    norma: 'NR-10 — instalação de aterramento temporário',
    pontos: 14,
  },
  {
    id: 'elo_certo',
    nome: 'Elo fusível de reposição',
    descricao: 'Do valor indicado no projeto do ramal',
    necessaria: true,
    porque:
      'O elo é dimensionado para abrir antes que o transformador queime. Ele é a peça do serviço — e o valor dele não é escolha de campo.',
    norma: 'Procedimento de distribuição — dimensionamento do elo fusível',
    pontos: 8,
  },
  {
    id: 'elo_maior',
    nome: 'Elo fusível de valor maior',
    descricao: 'O que tem na caixa, de amperagem acima da do projeto',
    necessaria: false,
    porque:
      'Elo maior não abre quando deveria: deixa passar a falta e entrega o defeito ao transformador. É a gambiarra que resolve o chamado de hoje e queima o equipamento no mês que vem.',
    norma: 'Procedimento de distribuição — é vedado substituir por valor diverso',
    pontos: -10,
  },
  {
    id: 'escada_fibra',
    nome: 'Escada de fibra de vidro',
    descricao: 'Escada extensível isolante, com sapatas e amarração',
    necessaria: true,
    porque:
      'Escada isolante é o que impede o corpo de virar caminho para a terra quando se trabalha perto de parte energizada.',
    norma: 'NR-10 e NR-35 — escada isolante em trabalho com eletricidade',
    pontos: 12,
  },
  {
    id: 'escada_aluminio',
    nome: 'Escada de alumínio',
    descricao: 'Mais leve e já está na caçamba',
    necessaria: false,
    porque:
      'Alumínio conduz. Uma escada de alumínio encostada perto da rede é um condutor de quatro metros com uma pessoa em cima.',
    norma: 'NR-10 — é vedado o uso de escada condutiva',
    pontos: -14,
  },
  {
    id: 'alicate_isolado',
    nome: 'Alicate isolado 1000 V',
    descricao: 'Cabo com isolação ensaiada e marcação do duplo triângulo',
    necessaria: true,
    porque:
      'A isolação ensaiada da ferramenta é a última barreira quando tudo mais falha. A marcação do duplo triângulo é o que diz que ela foi ensaiada.',
    norma: 'NR-10 — ferramental isolado para trabalho em instalação elétrica',
    pontos: 8,
  },
  {
    id: 'alicate_comum',
    nome: 'Alicate comum',
    descricao: 'Cabo emborrachado de fábrica, sem ensaio',
    necessaria: false,
    porque:
      'Borracha de conforto não é isolação ensaiada. Ela existe para a mão não escorregar, não para segurar tensão.',
    norma: 'NR-10 — ferramenta sem isolação ensaiada',
    pontos: -10,
  },
  {
    id: 'corda_icamento',
    nome: 'Corda de içamento com bolsa',
    descricao: 'Para subir e descer ferramenta sem carregar na mão',
    necessaria: true,
    porque:
      'Ninguém sobe com ferramenta na mão nem no bolso: a mão é para se segurar, e o que cai de nove metros mata quem está embaixo.',
    norma: 'NR-35 — içamento de materiais em trabalho em altura',
    pontos: 8,
  },
]

export const MAXIMO_FERRAMENTAL = FERRAMENTAL
  .filter((f) => f.necessaria)
  .reduce((t, f) => t + f.pontos, 0)

// ------------------------------------------------------------- 3c o reparo

export type Passo = {
  id: string
  texto: string
  /**
   * O mesmo passo em três ou quatro palavras, para a ordem de serviço.
   *
   * `texto` é a frase do relatório, onde há espaço e onde ela precisa ser
   * completa. Na checklist da fase ela vira duas linhas, e nove passos de
   * duas linhas não cabem no painel — o jogador passa a rolar a tela a cada
   * ação para achar onde parou.
   */
  curto: string
  porque: string
  norma: string
}

/**
 * A sequência, na ordem. São as medidas de controle da NR-10 para
 * desenergizar, executar e reenergizar.
 *
 * A ordem é o conteúdo: cada passo fora de lugar é um acidente conhecido.
 * Aterrar antes de constatar a ausência de tensão, por exemplo, é encostar um
 * cabo de cobre numa rede que pode estar viva.
 */
import { embaralhar } from './ordem.ts'

/**
 * Os passos NA ORDEM EM QUE A TELA MOSTRA — que não pode ser a ordem certa.
 *
 * `PASSOS` está na sequência da NR-10, que é o gabarito; mostrar nessa ordem
 * entregava a resposta da parte que mais vale ponto da fase.
 */
export function passosNaTela(): Passo[] {
  return embaralhar(PASSOS, (p) => p.id, 'passo')
}

/** As alternativas de uma decisão de chegada, na ordem em que a tela mostra. */
export function opcoesNaTela(d: DecisaoChegada) {
  return embaralhar(d.opcoes, (o) => o.id, d.id)
}

export const PASSOS: Passo[] = [
  {
    id: 'desligamento',
    curto: 'Pedir desligamento ao Centro',
    texto: 'Solicitar o desligamento do trecho ao Centro de Operação',
    porque:
      'Quem manda desligar é quem enxerga a rede inteira. Manobra combinada por rádio, com confirmação, e não por iniciativa da equipe em campo.',
    norma: 'NR-10 — seccionamento mediante autorização',
  },
  {
    id: 'seccionar',
    curto: 'Abrir a chave',
    texto: 'Abrir a chave e seccionar o trecho',
    porque:
      'Abrir a chave é o ato que separa fisicamente o trecho da fonte. Sem abertura visível não há desenergização — há apenas um disjuntor que alguém pode religar.',
    norma: 'NR-10 — seccionamento',
  },
  {
    id: 'bloquear',
    curto: 'Bloquear e etiquetar',
    texto: 'Impedir a reenergização: bloquear e etiquetar',
    porque:
      'O bloqueio impede o religamento físico; a etiqueta diz quem bloqueou e por quê. Sem os dois, alguém religa de boa-fé com a equipe no poste.',
    norma: 'NR-10 — impedimento de reenergização',
  },
  {
    id: 'constatar',
    curto: 'Constatar ausência de tensão',
    texto: 'Constatar a ausência de tensão, testando o detector antes e depois',
    porque:
      'Testar o detector antes e depois é o que separa "não acusou tensão" de "o detector está quebrado". Os dois testes fazem parte da medição, não são zelo extra.',
    norma: 'NR-10 — constatação da ausência de tensão',
  },
  {
    id: 'aterrar',
    curto: 'Aterrar o trecho',
    texto: 'Instalar o aterramento temporário',
    porque:
      'O aterramento é o que protege contra religamento indevido e contra tensão induzida pela rede vizinha. Ele entra DEPOIS da constatação — nunca antes.',
    norma: 'NR-10 — aterramento dos condutores',
  },
  {
    id: 'delimitar',
    curto: 'Cobrir a rede vizinha',
    texto: 'Proteger o que ficou energizado por perto e delimitar a zona',
    porque:
      'O trecho desligado quase nunca é o único que existe no poste. O que continua vivo precisa de cobertura, e a zona de trabalho precisa de limite visível.',
    norma: 'NR-10 — proteção dos elementos energizados na vizinhança',
  },
  {
    id: 'executar',
    curto: 'Trocar o elo fusível',
    texto: 'Substituir o elo fusível',
    porque:
      'É o serviço em si — e ele é o passo sete, não o passo um. Tudo que veio antes existe para que esta parte seja rotina.',
    norma: 'Procedimento de distribuição — substituição de elo fusível',
  },
  {
    id: 'retirar_aterramento',
    curto: 'Retirar o aterramento',
    texto: 'Retirar o aterramento temporário',
    porque:
      'A reenergização desfaz as barreiras na ordem inversa. Religar com o aterramento instalado é provocar um curto franco na própria rede.',
    norma: 'NR-10 — reenergização',
  },
  {
    id: 'desbloquear',
    curto: 'Retirar bloqueio e comunicar',
    texto: 'Retirar o bloqueio e a etiqueta, e comunicar o Centro de Operação',
    porque:
      'Quem bloqueou é quem desbloqueia, e só depois de conferir que a equipe e as ferramentas saíram da zona. O religamento é do Centro, não do campo.',
    norma: 'NR-10 — reenergização mediante comunicação',
  },
]

export const MAXIMO_REPARO = PASSOS.length * 6

export const MAXIMO_OCORRENCIA =
  MAXIMO_CHEGADA + MAXIMO_FERRAMENTAL + MAXIMO_REPARO

/**
 * Fase 2b — o trajeto até a ocorrência.
 *
 * REVISÃO PENDENTE (Cristiano / segurança do trabalho): os limites de cada
 * trecho e a política da Energisa para condução em serviço. Escrito a partir
 * do CTB e da prática de direção defensiva.
 *
 * O jogador NÃO dirige: o veículo segue o traçado sozinho e ele controla só
 * acelerador e freio. A decisão travada com o cliente foi "dirigir de verdade,
 * mas o mais facilitado possível" — quem joga pode ter 60 anos e nunca ter
 * pegado num jogo, e o que se está avaliando é conduta, não habilidade com
 * controle.
 *
 * Andar devagar demais também conta. Sem isso o jogador descobre em trinta
 * segundos que rastejar a 5 km/h gabarita a fase, e o exercício vira piada —
 * além de que transitar a menos de metade da máxima é infração de verdade.
 */

export type Evento =
  | { tipo: 'placa'; limite: number }
  | { tipo: 'lombada' }
  | { tipo: 'faixa'; comPedestre: boolean }
  | { tipo: 'carro'; velocidade: number }
  | { tipo: 'semaforo' }
  | { tipo: 'onibus' }
  | { tipo: 'ciclista' }
  | { tipo: 'celular' }
  | { tipo: 'garagem' }

export type Trecho = {
  id: string
  nome: string
  /** Comprimento em metros. */
  metros: number
  /** Velocidade máxima da via, em km/h. */
  limite: number
  /** Aparece no alto da tela quando o veículo entra no trecho. */
  aviso: string
  /** Onde os eventos acontecem, medido do início do trecho. */
  eventos?: ({ em: number } & Evento)[]
  /** Como a via dobra neste trecho. -1 é esquerda fechada, +1 direita. */
  curva?: number
  /** Relevo: positivo sobe, negativo desce. */
  colina?: number
}

export const TRAJETO: Trecho[] = [
  {
    id: 'patio',
    nome: 'Saída do pátio',
    metros: 100,
    limite: 20,
    aviso: 'colegas a pé entre os veículos — alguém pode sair de trás de uma caçamba',
    curva: 0,
    colina: 0,
  },
  {
    id: 'avenida',
    nome: 'Avenida',
    metros: 200,
    limite: 60,
    aviso: 'Avenida · 60 km/h',
    curva: 0.55,
    colina: 0.35,
    eventos: [{ em: 70, tipo: 'placa', limite: 60 }],
  },
  {
    id: 'semaforo',
    nome: 'Cruzamento com semáforo',
    metros: 170,
    limite: 60,
    aviso: 'Cruzamento à frente · semáforo',
    curva: -0.2,
    colina: -0.45,
    eventos: [{ em: 115, tipo: 'semaforo' }],
  },
  {
    id: 'escola',
    nome: 'Trecho escolar',
    metros: 170,
    limite: 30,
    aviso: 'Escola à frente · 30 km/h · ônibus em embarque',
    curva: -0.75,
    colina: 0,
    eventos: [
      { em: 25, tipo: 'placa', limite: 30 },
      { em: 110, tipo: 'onibus' },
    ],
  },
  {
    id: 'faixa',
    nome: 'Faixa de pedestre',
    metros: 130,
    limite: 30,
    aviso: 'Faixa de pedestre · pare e deixe atravessar',
    curva: 0,
    colina: 0.3,
    eventos: [{ em: 70, tipo: 'faixa', comPedestre: true }],
  },
  {
    id: 'residencial',
    nome: 'Rua residencial',
    metros: 220,
    limite: 40,
    aviso: 'Rua residencial · 40 km/h · lombada e saída de garagem',
    curva: 0.8,
    colina: -0.35,
    // 40 m de folga entre uma decisão e a seguinte: empilhadas, o jogador
    // não chega a decidir nada — reage ao que estiver mais perto e descobre
    // o resto no relatório.
    eventos: [
      { em: 50, tipo: 'lombada' },
      { em: 120, tipo: 'garagem' },
      { em: 185, tipo: 'celular' },
    ],
  },
  {
    id: 'fluxo',
    nome: 'Veículo à frente',
    metros: 190,
    limite: 60,
    aviso: 'Veículo à frente · mantenha distância de seguimento',
    curva: 0.15,
    colina: 0.4,
    eventos: [{ em: 60, tipo: 'carro', velocidade: 38 }],
  },
  {
    id: 'vicinal',
    nome: 'Estrada vicinal',
    metros: 160,
    limite: 60,
    aviso: 'Estrada vicinal · ciclista na pista · ultrapasse com 1,5 m',
    curva: -0.6,
    colina: -0.25,
    eventos: [{ em: 70, tipo: 'ciclista' }],
  },
]

export const DISTANCIA_TOTAL = TRAJETO.reduce((t, s) => t + s.metros, 0)

/** Física do veículo. Valores de caminhão carregado, arredondados. */
export const VEICULO = {
  aceleracao: 2.0,        // m/s²
  freio: 5.2,             // m/s²
  arrasto: 0.7,           // m/s² com o pé fora dos dois pedais
  maxima: 25,             // m/s ≈ 90 km/h
}

/** Limites de conduta usados na pontuação. */
export const CONDUTA = {
  /** Acima disso do limite, conta como excesso. Tolerância de velocímetro. */
  toleranciaKmh: 5,
  /** Abaixo dessa fração do limite, sem motivo, conta como obstrução. */
  fracaoMinima: 0.5,
  /** Velocidade máxima segura sobre a lombada, em km/h. */
  lombadaKmh: 20,
  /** Na faixa com pedestre, tem de estar parado. */
  paradoKmh: 3,
  /** Passando pelo carro que sai da garagem, no máximo isto. */
  garagemKmh: 18,
  /** Distância de seguimento: 2 segundos à velocidade atual. */
  segundosDeSeguimento: 2,
  /** Passando por ônibus escolar em embarque, no máximo isto. */
  onibusKmh: 20,
  /** Passando pelo ciclista, no máximo isto — não há 1,5 m de folga na pista. */
  ciclistaKmh: 30,
  /** A quantos metros do cruzamento o sinal abre o amarelo. */
  amareloEm: 58,
  /** Quanto o amarelo dura, em segundos. */
  amareloSegundos: 2.4,
}

export type FaltaTrajeto = {
  id: string
  /** Como a falta aparece quando foi COMETIDA. */
  titulo: string
  /**
   * Como aparece quando NÃO foi cometida.
   *
   * Sem este campo o relatório listava "Não parou na faixa de pedestre" e
   * "Atendeu o celular dirigindo" debaixo de "o que você acertou" — dizendo
   * ao colaborador o contrário do que ele fez, no documento que o instrutor
   * leva para a conversa depois.
   */
  acerto: string
  porque: string
  norma: string
  /** Quanto tira da nota da fase. */
  peso: number
}

export const FALTAS: Record<string, FaltaTrajeto> = {
  excesso: {
    id: 'excesso',
    acerto: 'Velocidade compatível com a via',
    titulo: 'Acima do limite da via',
    porque:
      'Velocidade é o que transforma um susto em acidente: ela decide a distância que o veículo ainda percorre depois que o pé sai do acelerador, e decide a energia do impacto. Em veículo de serviço, carregado e com ferramenta na caçamba, a distância de parada é maior que a do carro de passeio.',
    norma: 'CTB art. 218 — transitar acima da velocidade máxima permitida',
    peso: 16,
  },
  lento: {
    id: 'lento',
    acerto: 'Andou no ritmo da via',
    titulo: 'Muito abaixo do fluxo, sem motivo',
    porque:
      'Andar muito abaixo do limite sem necessidade obriga quem vem atrás a ultrapassar, e a ultrapassagem é a manobra mais perigosa da via. Conduzir com segurança não é andar devagar: é andar compatível.',
    norma: 'CTB art. 219 — transitar a velocidade inferior à metade da máxima',
    peso: 8,
  },
  lombada: {
    id: 'lombada',
    acerto: 'Reduziu na lombada',
    titulo: 'Lombada em velocidade',
    porque:
      'Passar rápido na lombada arremessa a carga da caçamba, castiga a suspensão e tira o controle justamente onde há travessia de pedestre — a lombada está ali porque alguém já foi atropelado naquele ponto.',
    norma: 'CTB art. 220 — velocidade incompatível com a segurança do local',
    peso: 12,
  },
  pedestre: {
    id: 'pedestre',
    acerto: 'Parou na faixa de pedestre',
    titulo: 'Não parou na faixa de pedestre',
    porque:
      'Na faixa, a preferência é de quem está a pé, sempre. O pedestre que já iniciou a travessia não tem como recuar, e o veículo de serviço é o mais alto e o mais pesado da via.',
    norma: 'CTB art. 214 — deixar de dar preferência ao pedestre na faixa',
    peso: 20,
  },
  seguimento: {
    id: 'seguimento',
    acerto: 'Manteve a distância de seguimento',
    titulo: 'Distância de seguimento curta',
    porque:
      'A regra dos dois segundos existe porque o tempo de reação já come metade da distância de parada. Colado no veículo da frente, não há distância nenhuma para reagir ao que ele fizer.',
    norma: 'CTB art. 192 — deixar de guardar distância de segurança',
    peso: 14,
  },
}

Object.assign(FALTAS, {
  semaforo: {
    id: 'semaforo',
    acerto: 'Respeitou o sinal',
    titulo: 'Avançou o sinal vermelho',
    porque:
      'O amarelo não é "apresse-se": é o aviso de que o vermelho vem, e quem tem distância para parar com segurança para. No cruzamento, quem avança o vermelho encontra quem já recebeu o verde — é o tipo de colisão lateral que o cinto protege menos.',
    norma: 'CTB art. 208 — avançar o sinal vermelho do semáforo',
    peso: 18,
  },
  onibus: {
    id: 'onibus',
    acerto: 'Reduziu ao passar pelo ônibus escolar',
    titulo: 'Passou rápido pelo ônibus escolar',
    porque:
      'Ônibus escolar parado significa criança descendo, e criança atravessa por trás do ônibus, onde não dá para vê-la. Reduzir ali não é cortesia: é a única forma de ainda conseguir parar quando ela aparecer.',
    norma: 'CTB art. 220, XI — deixar de reduzir ao ultrapassar ciclista ou ônibus escolar em embarque',
    peso: 16,
  },
  ciclista: {
    id: 'ciclista',
    acerto: 'Deu folga ao ciclista',
    titulo: 'Passou colado no ciclista',
    porque:
      'A lei pede um metro e meio de folga lateral. Quando a pista não dá essa folga, a ultrapassagem não é feita: espera-se. O deslocamento de ar de um veículo alto e carregado derruba quem está de bicicleta sem nem encostar nele.',
    norma: 'CTB art. 201 — ultrapassar ciclista a menos de 1,5 m',
    peso: 14,
  },
  garagem: {
    id: 'garagem',
    acerto: 'Esperou o veículo sair da garagem',
    titulo: 'Não cedeu ao veículo saindo da garagem',
    porque:
      'Quem sai da garagem enxerga menos que você: o muro corta a visão dele até o carro já estar meio na pista. Em rua residencial é de onde o veículo aparece — e na mesma rua é de onde a criança aparece, pelo mesmo motivo.',
    norma: 'CTB art. 34 e 38 — iniciar manobra só com segurança, e dar preferência a quem já está na via',
    peso: 14,
  },
  celular: {
    id: 'celular',
    acerto: 'Deixou o celular tocar',
    titulo: 'Atendeu o celular dirigindo',
    porque:
      'A ligação pode esperar; o trânsito não. Nos poucos segundos em que a atenção vai para o telefone o veículo percorre o quarteirão inteiro às cegas — e em serviço, quem liga sabe que você está na rua e volta a ligar depois.',
    norma: 'CTB art. 252, V — dirigir manuseando telefone celular',
    peso: 14,
  },
} satisfies Record<string, FaltaTrajeto>)

export const MAXIMO_TRAJETO = Object.values(FALTAS).reduce((t, f) => t + f.peso, 0)

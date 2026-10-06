/**
 * Fase 2a — conferência do veículo, com ele desligado.
 *
 * REVISÃO PENDENTE (Cristiano / segurança do trabalho): a lista de itens do
 * check diário do veículo e o que a Energisa exige em cada um. Escrito a partir
 * de NR-11, NR-12, do CTB e da prática de checklist de frota.
 *
 * A mecânica não é caçar o erro escondido: é a conferência de verdade, item por
 * item, com a câmera indo até cada um. Para cada um o jogador decide se está
 * como tem de estar ou se precisa ser corrigido antes de dar a partida — que é
 * exatamente a decisão que ele toma no pátio todo dia de manhã.
 */

export type ItemCabine = {
  id: string
  nome: string
  /** Pergunta que aparece junto da imagem. */
  pergunta: string
  /** O estado em que o item está quando o jogador chega nele. */
  comoEsta: string
  /** `true` se o estado inicial já está correto — nem tudo está errado. */
  correto: boolean
  /** O que o jogador vê depois de mandar corrigir. */
  depoisDeCorrigir?: string
  porque: string
  norma: string
  pontos: number
  /**
   * Ponto de observação, em coordenadas do JOGO (Y para cima), que é o que o
   * .glb usa. O Blender trabalha com Z para cima: (x, y, z) de lá vira
   * (x, z, −y) aqui.
   */
  camera: { de: [number, number, number]; para: [number, number, number]; lente?: number }
  /**
   * Estados no .glb: o errado e o certo. São as chaves de `estados()` em
   * `arte/blender/veiculo.py` — SEM o prefixo `est_`, que o exportador põe no
   * nome do nó e o jogo tira de volta na comparação.
   */
  no?: { errado: string; certo: string }
}

export const ITENS_CABINE: ItemCabine[] = [
  {
    id: 'cinto',
    nome: 'Cinto de segurança',
    pergunta: 'O cinto está como precisa estar para dar a partida?',
    comoEsta: 'O cinto está solto, recolhido junto à coluna.',
    correto: false,
    depoisDeCorrigir: 'Cinto afivelado, faixa diagonal cruzando o peito e faixa baixa sobre o quadril.',
    porque:
      'É o equipamento que mais salva vida em veículo, e o mais fácil de esquecer em deslocamento curto dentro do pátio ou da obra. A maior parte das mortes em serviço na distribuição acontece no trânsito, não na rede.',
    norma: 'CTB art. 65 e NR-11 — uso obrigatório do cinto por todos os ocupantes',
    pontos: 14,
    camera: { de: [0.10, 1.18, -0.10], para: [-0.72, 0.70, -0.36], lente: 26 },
    no: { errado: 'cinto_solto', certo: 'cinto_afivelado' },
  },
  {
    id: 'retrovisores',
    nome: 'Retrovisores',
    pergunta: 'Os retrovisores estão regulados para quem vai dirigir?',
    comoEsta: 'Os dois externos estão virados para dentro, mostrando a lateral do próprio veículo.',
    correto: false,
    depoisDeCorrigir: 'Espelhos abertos, cobrindo a faixa ao lado e reduzindo o ponto cego.',
    porque:
      'Espelho virado para dentro mostra o que o motorista já sabe — a lataria — e esconde o que ele precisa ver. Em serviço na via, é por ali que aparece a moto que vem pela direita.',
    norma: 'CTB art. 103 e checklist de frota — campo de visão indireto',
    pontos: 10,
    // Enquadra o espelho DO MOTORISTA, do lado dele.
    //
    // A câmera antiga ficava em x=-0,45 olhando o espelho em x=-0,92 — os
    // dois do lado do PASSAGEIRO. O motorista senta em x=+0,38, então a
    // pergunta "os retrovisores estão regulados para quem vai dirigir?"
    // aparecia com a câmera no banco errado, apertada contra a porta, e o
    // espelho saía cortado na borda com o vidro branco ocupando a tela. Numa
    // fase cujo exercício é olhar e julgar, isso é a pergunta sem a imagem.
    // Recuada para a porta e um pouco mais alta do que o olho: enquadrando
    // da altura exata do olho, o antebraço do motorista entra no terço
    // esquerdo do quadro — e ele está NU ali, porque a manga do uniforme foi
    // modelada na pose T e o motorista está sentado e posado, então o braço
    // atravessa a peça. É defeito de arte, anotado no plano; aqui a câmera
    // só evita exibi-lo.
    camera: { de: [0.70, 1.25, 0.14], para: [0.95, 1.02, 0.56], lente: 44 },
    no: { errado: 'retro_desregulado', certo: 'retro_ok' },
  },
  {
    id: 'apoio_cabeca',
    nome: 'Apoio de cabeça',
    pergunta: 'O apoio de cabeça está na altura certa?',
    comoEsta: 'O apoio está no batente de baixo, na altura da nuca.',
    correto: false,
    depoisDeCorrigir: 'Apoio levantado, com o topo na altura do alto da cabeça.',
    porque:
      'Apoio baixo não é apoio: numa colisão traseira ele vira o ponto de apoio sobre o qual o pescoço dobra para trás. O topo tem de ficar na altura do alto da cabeça, não da nuca.',
    norma: 'CONTRAN e checklist de frota — regulagem do apoio de cabeça',
    pontos: 8,
    // Três quartos do banco do passageiro, olhando o apoio DO MOTORISTA.
    //
    // A câmera antiga mirava x=-0,38 — o encosto do passageiro — numa
    // pergunta sobre o apoio de quem vai dirigir (x=+0,38). Daqui aparecem a
    // cabeça do motorista E o apoio atrás dela, que é exatamente a
    // comparação que o item pede: o topo tem de ficar na altura do alto da
    // cabeça, não da nuca.
    camera: { de: [-0.30, 1.32, -0.06], para: [0.38, 1.12, -0.46], lente: 38 },
    no: { errado: 'apoio_baixo', certo: 'apoio_alto' },
  },
  {
    id: 'freio_mao',
    nome: 'Freio de estacionamento',
    pergunta: 'O freio de estacionamento está como deveria, com o veículo parado?',
    comoEsta: 'O freio está puxado.',
    correto: true,
    porque:
      'Com o veículo parado e a equipe trabalhando em volta, o freio puxado é o que impede o deslocamento involuntário. Está certo — e reconhecer o que já está certo faz parte da conferência.',
    norma: 'NR-11 — imobilização do veículo durante o serviço',
    pontos: 8,
    // Do olho do motorista, olhando para baixo — a vista que ele tem da
    // própria alavanca.
    //
    // A câmera antiga ficava em x=-0,30 (lado do passageiro) olhando para
    // +x: o motorista sentado em x=+0,38 virava o FUNDO do quadro, e o que
    // se via era um corpo, não um freio de mão. Era composição feita quando
    // o banco ainda estava vazio.
    // Quase a prumo sobre o console.
    //
    // A alavanca fica ENTRE os bancos, então qualquer vista lateral põe um
    // corpo ou um banco no fundo — foi o que estragou as duas tentativas
    // anteriores (do lado do passageiro, o motorista virava o fundo; do olho
    // do motorista, a coxa dele tapava a alavanca). Olhando de cima o fundo
    // é o assoalho, e o que resta em quadro é o freio.
    camera: { de: [0.04, 1.06, 0.20], para: [-0.07, 0.30, -0.06], lente: 30 },
  },
  {
    id: 'celular',
    nome: 'Celular no painel',
    pergunta: 'Tem alguma coisa solta no painel que não deveria estar?',
    comoEsta: 'Um celular está apoiado solto no painel, sem suporte.',
    correto: false,
    depoisDeCorrigir: 'Celular guardado. Em serviço, ele fica fora do alcance da mão.',
    porque:
      'Objeto solto no painel vira projétil numa frenagem e, muito antes disso, vira desvio de atenção. Celular na mão em deslocamento é infração e é a causa mais comum de colisão traseira na frota.',
    norma: 'CTB art. 252 — dirigir manuseando telefone',
    pontos: 10,
    camera: { de: [-0.38, 1.18, -0.15], para: [0.10, 0.91, 0.46], lente: 30 },
    no: { errado: 'celular', certo: 'celular_guardado' },
  },
  {
    id: 'checklist',
    nome: 'Checklist do veículo',
    pergunta: 'O checklist diário do veículo está resolvido?',
    comoEsta: 'A prancheta está no banco do passageiro com o checklist em branco.',
    correto: false,
    depoisDeCorrigir: 'Checklist preenchido antes de sair, com pneus, luzes, fluidos e carga conferidos.',
    porque:
      'O checklist é o que transforma "achei que estava bom" em "conferi". Também é o registro que mostra que a falha já existia antes do serviço — e não foi a equipe que causou.',
    norma: 'NR-11 e procedimento de frota — inspeção prévia do veículo',
    pontos: 8,
    // Olha a prancheta no banco do PASSAGEIRO (x=-0,40), com a câmera à
    // esquerda do motorista para ele ficar ATRÁS dela.
    //
    // A câmera antiga mirava x=+0,40 — o banco do motorista — e enchia o
    // quadro com o torso dele. O item pergunta por uma prancheta que está do
    // outro lado da cabine: era a quarta das seis vistas compostas quando o
    // banco ainda estava vazio.
    camera: { de: [0.15, 1.15, 0.12], para: [-0.40, 0.52, -0.28], lente: 34 },
    no: { errado: 'checklist_branco', certo: 'checklist_feito' },
  },
]

export const MAXIMO_CABINE = ITENS_CABINE.reduce((t, i) => t + i.pontos, 0)

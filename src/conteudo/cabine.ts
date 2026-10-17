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
  /**
   * O gesto, no infinitivo: o que o dedo faz com a peça.
   *
   * A fase deixou de ser pergunta-e-dois-botões e virou conferência de
   * pátio: clica-se NA PEÇA. Isto é o rótulo da ação, e precisa dizer o que
   * acontece com o objeto — "afivelar o cinto", não "corrigir".
   */
  gesto: string
  /** O mesmo gesto desfeito, para quem clicar duas vezes. */
  desfazer: string
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
    gesto: 'Afivelar o cinto',
    desfazer: 'Soltar o cinto de novo',
    nome: 'Cinto de segurança',
    pergunta: 'O cinto está como precisa estar para dar a partida?',
    comoEsta: 'O cinto está solto, recolhido junto à coluna.',
    correto: false,
    depoisDeCorrigir: 'Cinto afivelado, faixa diagonal cruzando o peito e faixa baixa sobre o quadril.',
    porque:
      'É o equipamento que mais salva vida em veículo, e o mais fácil de esquecer em deslocamento curto dentro do pátio ou da obra. A maior parte das mortes em serviço na distribuição acontece no trânsito, não na rede.',
    norma: 'CTB art. 65 e NR-11 — uso obrigatório do cinto por todos os ocupantes',
    pontos: 14,
    // Refeita em 06/10. A antiga olhava para x -0,72 — o lado do PASSAGEIRO —
    // e o cinto está em x 0,70-0,78, do lado do motorista: a pergunta "o cinto
    // está como precisa estar?" aparecia SEM O CINTO em quadro. Confirmado no
    // render, não deduzido.
    //
    // Três coisas restringem esta câmera, e por isso ela está onde está:
    // tem de passar por cima do volante (z até 1,00), por cima do encosto
    // (z até 1,02), e ficar INBOARD — a fita olha para dentro da cabine, e
    // de perto do pilar ela é vista de fio e vira um risco.
    camera: { de: [-0.12, 1.22, 0.84], para: [0.48, 0.72, -0.22], lente: 32 },
    no: { errado: 'cinto_solto', certo: 'cinto_afivelado' },
  },
  {
    id: 'retrovisores',
    gesto: 'Abrir os retrovisores',
    desfazer: 'Virar os espelhos para dentro',
    nome: 'Retrovisores',
    pergunta: 'Os retrovisores estão regulados para quem vai dirigir?',
    comoEsta: 'Os dois externos estão virados para dentro, mostrando a lateral do próprio veículo.',
    correto: false,
    depoisDeCorrigir: 'Espelhos abertos, cobrindo a faixa ao lado e reduzindo o ponto cego.',
    porque:
      'Espelho virado para dentro mostra o que o motorista já sabe — a lataria — e esconde o que ele precisa ver. Em serviço na via, é por ali que aparece a moto que vem pela direita.',
    norma: 'CTB art. 103 e checklist de frota — campo de visão indireto',
    pontos: 10,
    // Enquadra o espelho DO MOTORISTA, de dentro da cabine, com a cabeça
    // dele ATRÁS da câmera.
    //
    // Ficava no olho de quem dirige, que é de onde a pergunta é feita — e
    // era defensável enquanto o banco estava vazio. Com o motorista sentado
    // (e 18 cm à frente, desde que `Y_BANCO` mudou para ele alcançar o
    // volante) a câmera nascia DENTRO DA CABEÇA: na tela saíam dois globos
    // oculares brancos ocupando meia tela, vistos por dentro.
    //
    // Daqui, entre os bancos e um palmo à frente dele, o espelho do lado do
    // motorista aparece limpo e a cabeça fica fora de quadro.
    //
    // A câmera de antes ficava em x=-0,45 olhando o espelho em x=-0,92: os
    // dois do lado do PASSAGEIRO, numa pergunta sobre o equipamento do
    // motorista, que senta em x=+0,38.
    //
    // (A nota antiga sobre o antebraço nu do motorista saiu: aquele defeito
    // era o recorte da manga seguir a pose do corpo, e foi corrigido em
    // 06/10 — ver "Item 2" no PLANO.md.)
    camera: { de: [1.85, 1.42, 1.70], para: [0.95, 1.06, 0.52], lente: 38 },
    no: { errado: 'retro_desregulado', certo: 'retro_ok' },
  },
  {
    id: 'apoio_cabeca',
    gesto: 'Levantar o apoio',
    desfazer: 'Baixar o apoio de novo',
    nome: 'Apoio de cabeça',
    pergunta: 'O apoio de cabeça está na altura certa?',
    comoEsta: 'O apoio está no batente de baixo, na altura da nuca.',
    correto: false,
    depoisDeCorrigir: 'Apoio levantado, com o topo na altura do alto da cabeça.',
    porque:
      'Apoio baixo não é apoio: numa colisão traseira ele vira o ponto de apoio sobre o qual o pescoço dobra para trás. O topo tem de ficar na altura do alto da cabeça, não da nuca.',
    norma: 'CONTRAN e checklist de frota — regulagem do apoio de cabeça',
    pontos: 8,
    // DE DENTRO DA CABINE, por cima do ombro, atrás dos dois bancos.
    //
    // A tentativa anterior era um perfil pela janela do motorista, e na tela
    // dava um borrão azul: a câmera ficava a meio metro do alvo com a CABEÇA
    // DELE no meio do caminho. Pior, de perfil o apoio quase não aparece —
    // o forro da porta sobe até z 0,95 e o apoio na posição baixa tem o topo
    // em 1,03, então sobrava uma tira de 8 cm acima do peitoril, justamente
    // no item que pergunta se o apoio está baixo demais.
    //
    // Daqui o apoio aparece inteiro, contra a cabeça, e a diferença entre o
    // batente de baixo e o de cima é visível de longe. Os limites da cabine:
    // parede traseira em z -1,06 (câmera em -0,92 e nem um dedo mais) e
    // forro em y 1,42.
    camera: { de: [-0.25, 1.33, -0.92], para: [0.42, 1.07, -0.30], lente: 46 },
    no: { errado: 'apoio_baixo', certo: 'apoio_alto' },
  },
  {
    id: 'freio_mao',
    gesto: 'Soltar o freio',
    desfazer: 'Puxar o freio de novo',
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
    // Quase a prumo e DE PERTO. Toda vista lateral põe um banco atrás da
    // alavanca, porque ela fica entre os dois; e de longe ela some no
    // assoalho preto. A alavanca também clareou (albedo 0,024 → 0,105): com
    // preto sobre preto, a pergunta não tem resposta na imagem.
    camera: { de: [-0.52, 1.12, 0.36], para: [-0.09, 0.44, -0.10], lente: 30 },
    no: { errado: 'freio_puxado', certo: 'freio_solto' },
  },
  {
    id: 'celular',
    gesto: 'Guardar o celular',
    desfazer: 'Deixar o celular no painel',
    nome: 'Celular no painel',
    pergunta: 'Tem alguma coisa solta no painel que não deveria estar?',
    comoEsta: 'Um celular está apoiado solto no painel, sem suporte.',
    correto: false,
    depoisDeCorrigir: 'Celular guardado. Em serviço, ele fica fora do alcance da mão.',
    porque:
      'Objeto solto no painel vira projétil numa frenagem e, muito antes disso, vira desvio de atenção. Celular na mão em deslocamento é infração e é a causa mais comum de colisão traseira na frota.',
    norma: 'CTB art. 252 — dirigir manuseando telefone',
    pontos: 10,
    camera: { de: [0.20, 1.21, 0.21], para: [-0.10, 0.91, 0.64], lente: 40 },
    no: { errado: 'celular', certo: 'celular_guardado' },
  },
  {
    id: 'checklist',
    gesto: 'Preencher o checklist',
    desfazer: 'Deixar o checklist em branco',
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
    camera: { de: [0.10, 1.16, 0.44], para: [-0.40, 0.41, -0.02], lente: 34 },
    no: { errado: 'checklist_branco', certo: 'checklist_feito' },
  },
]

export const MAXIMO_CABINE = ITENS_CABINE.reduce((t, i) => t + i.pontos, 0)

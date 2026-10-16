/**
 * Som do jogo, sintetizado no Web Audio — sem arquivo e sem biblioteca.
 *
 * Por que sintetizar em vez de tocar .mp3: são seis efeitos curtos e um bafo
 * de motor que precisa acompanhar a velocidade continuamente. Em arquivo, o
 * motor exigiria loop com pitch shift (que o <audio> não faz) e sete downloads
 * com licença para rastrear. Em oscilador cabe num arquivo e o motor sai de
 * graça, porque a frequência é um parâmetro.
 *
 * O navegador só deixa tocar depois de um gesto do usuário, então o contexto
 * nasce no primeiro toque na tela e não na carga da página.
 */

const CHAVE_MUDO = 'jogoSeguranca.mudo'

let ctx: AudioContext | null = null
let mestre: GainNode | null = null
/*
  NASCE COM SOM, e isso é uma reversão deliberada.

  A regra antiga era nascer mudo, e a razão escrita era "som que começa
  sozinho incomoda em sala de treinamento e em totem". Para a sala, continua
  verdade. Para o TOTEM DE FEIRA é o contrário: tela muda não para ninguém,
  e são 659 linhas de áudio sintetizado — motor com marchas, Doppler nas
  passagens, pátio de escola, chave fusível — que ninguém jamais ouviu,
  porque o botão de ligar é um ícone de 36 px num canto.

  A escolha do operador continua valendo: ele clica uma vez e fica guardada
  no `localStorage`. E `?mudo=1` nasce mudo, para o atalho da sala de aula.

  Isto não faz som tocar na carga da página: o navegador só libera o
  `AudioContext` depois de um gesto, e o primeiro gesto do jogo é o botão da
  tela de abertura.
*/
const PEDIU_MUDO = new URLSearchParams(window.location.search).has('mudo')
const GUARDADO = localStorage.getItem(CHAVE_MUDO)
let mudo = PEDIU_MUDO || GUARDADO === '1'

/** Ruído branco de 2 s, reaproveitado por todo efeito que precisa de chiado. */
let ruido: AudioBuffer | null = null
/** Só em desenvolvimento, para medir que há sinal saindo (ver __som.nivel). */
let analise: AnalyserNode | null = null

function ligar(): AudioContext | null {
  if (ctx) {
    // o contexto suspende sozinho quando a aba perde o foco
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }
  const C = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!C) return null
  ctx = new C()
  mestre = ctx.createGain()
  mestre.gain.value = mudo ? 0 : 0.6
  mestre.connect(ctx.destination)

  const n = ctx.sampleRate * 2
  ruido = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = ruido.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1
  return ctx
}

/** Envelope percussivo num ganho: ataque imediato, queda exponencial. */
function bater(g: GainNode, pico: number, queda: number, t: number) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(pico, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + queda)
}

function tom(freq: number, pico: number, queda: number, forma: OscillatorType = 'sine', atraso = 0) {
  const c = ligar()
  if (!c || !mestre) return
  const t = c.currentTime + atraso
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = forma
  o.frequency.setValueAtTime(freq, t)
  bater(g, pico, queda, t)
  o.connect(g).connect(mestre)
  o.start(t)
  o.stop(t + queda + 0.05)
}

/** Estalo: ruído curto passado por um filtro estreito. É o que dá "material". */
function estalo(centro: number, pico: number, queda: number, atraso = 0) {
  const c = ligar()
  if (!c || !mestre || !ruido) return
  const t = c.currentTime + atraso
  const f = c.createBufferSource()
  f.buffer = ruido
  f.loop = true
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = centro
  bp.Q.value = 1.4
  const g = c.createGain()
  bater(g, pico, queda, t)
  f.connect(bp).connect(g).connect(mestre)
  f.start(t)
  f.stop(t + queda + 0.05)
}

/**
 * Onda de um diesel: o que o ouvido lê como diesel não é o timbre, é a BATIDA.
 * Cada volta do virabrequim tem duas explosões, e elas não saem iguais nem no
 * mesmo intervalo — é essa torção que separa diesel de serra elétrica.
 *
 * Em vez de somar osciladores por cilindro (caro e desafinado), o pulso de
 * combustão vira uma onda periódica montada UMA vez: um oscilador só passa a
 * tocar o trem de pulsos inteiro, e a rotação é a frequência dele.
 */
let ondaDiesel: PeriodicWave | null = null
function pulsos(c: AudioContext) {
  if (ondaDiesel) return ondaDiesel
  const N = 64
  const re = new Float32Array(N)
  const im = new Float32Array(N)
  // fase de cada explosão dentro da volta, e o peso dela. 0,47 em vez de 0,50
  // e 0,82 em vez de 1,00: é o mancar que faz soar motor de caminhão parado
  const fogo: [number, number][] = [[0, 1], [0.47, 0.82]]
  for (let n = 1; n < N; n++) {
    // pulso estreito = muitos harmônicos; é daqui que sai a batida seca
    const largura = Math.exp(-n * n * 0.0015)
    for (const [fase, peso] of fogo) {
      re[n] += peso * largura * Math.cos(2 * Math.PI * n * fase)
      im[n] -= peso * largura * Math.sin(2 * Math.PI * n * fase)
    }
  }
  ondaDiesel = c.createPeriodicWave(re, im)
  return ondaDiesel
}

/**
 * Fonte de ruído em laço. O buffer é de 2 s só; em som contínuo o ouvido pega
 * o padrão voltando. Mudar a leitura de velocidade e começar em outro ponto
 * desalinha os laços de graça, sem buffer novo.
 */
function chiado(c: AudioContext, velocidade = 1, inicio = 0) {
  const f = c.createBufferSource()
  f.buffer = ruido
  f.loop = true
  f.playbackRate.value = velocidade
  f.start(c.currentTime, inicio)
  return f
}

// ---------------------------------------------------------------- efeitos

export const som = {
  /** Toque num botão qualquer da interface. */
  clique() { estalo(2200, 0.09, 0.045) },

  /** Escolha travada: dois tons subindo. Não diz se acertou — só que pegou. */
  confirmar() {
    tom(520, 0.1, 0.1, 'triangle')
    tom(780, 0.09, 0.14, 'triangle', 0.075)
  },

  /** Veredito do vestiário. Sóbrio: nem fanfarra, nem buzina de erro. */
  veredito(correta: boolean) {
    if (correta) {
      tom(660, 0.1, 0.12, 'triangle')
      tom(880, 0.09, 0.2, 'triangle', 0.09)
    } else {
      tom(300, 0.11, 0.16, 'triangle')
      tom(225, 0.1, 0.3, 'triangle', 0.1)
    }
  },

  /** Buzina de caminhão: dois quadrados batidos, uma terça abaixo da de carro. */
  buzina() {
    const c = ligar()
    if (!c || !mestre) return
    const t = c.currentTime
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02)
    g.gain.setValueAtTime(0.16, t + 0.45)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800
    for (const f of [310, 372]) {
      const o = c.createOscillator()
      o.type = 'square'
      o.frequency.value = f
      o.connect(lp)
      o.start(t)
      o.stop(t + 0.7)
    }
    lp.connect(g).connect(mestre)
  },

  /** Chave fusível / disjuntor: o estalo seco e o baque da haste. */
  chave() {
    estalo(3400, 0.2, 0.05)
    tom(95, 0.16, 0.18, 'square', 0.03)
  },

  /** Celular tocando no painel. Um toque; o chamador repete se quiser. */
  telefone() {
    for (let i = 0; i < 2; i++) {
      tom(1180, 0.07, 0.09, 'sine', i * 0.16)
      tom(1480, 0.06, 0.09, 'sine', i * 0.16 + 0.04)
    }
  },

  /**
   * Motor, chamado todo quadro com a velocidade em m/s. Sobe de frequência e
   * de volume com a velocidade; em `null` desliga e solta os nós.
   */
  motor: (() => {
    type Nos = {
      osc: OscillatorNode; sub: OscillatorNode; lfo: OscillatorNode
      fonte: AudioBufferSourceNode
      g: GainNode; lata: GainNode; ar: GainNode; vento: BiquadFilterNode
      ultimo: number
    }
    let nos: Nos | null = null
    return (velocidade: number | null) => {
      const c = velocidade === null ? ctx : ligar()
      if (!c || !mestre) return
      if (velocidade === null) {
        if (nos) {
          nos.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.08)
          nos.lata.gain.setTargetAtTime(0.0001, c.currentTime, 0.08)
          nos.ar.gain.setTargetAtTime(0.0001, c.currentTime, 0.08)
          nos.osc.stop(c.currentTime + 0.5)
          nos.sub.stop(c.currentTime + 0.5)
          nos.lfo.stop(c.currentTime + 0.5)
          // a fonte de ruído também: fonte em laço que ninguém para fica viva
          // para sempre, e a Ocorrência liga e desliga o motor quadro a quadro
          nos.fonte.stop(c.currentTime + 0.5)
          nos = null
        }
        return
      }
      if (!nos && ruido) {
        const g = c.createGain()
        g.gain.value = 0.0001
        g.connect(mestre)

        // o trem de pulsos cru é agressivo; quem o transforma em motor é o
        // escapamento, que é um tubo ressonante — um passa-baixa com Q
        const corpo = c.createBiquadFilter()
        corpo.type = 'lowpass'
        corpo.frequency.value = 340
        corpo.Q.value = 3.2
        const osc = c.createOscillator()
        osc.setPeriodicWave(pulsos(c))
        osc.connect(corpo).connect(g)

        // a lata: a batida do bico injetor que escapa por cima do escapamento.
        // é o mesmo oscilador, filtrado no agudo — custa dois nós, não um motor
        const alto = c.createBiquadFilter()
        alto.type = 'bandpass'
        alto.frequency.value = 1900
        alto.Q.value = 0.9
        const lata = c.createGain()
        lata.gain.value = 0.0001
        osc.connect(alto).connect(lata).connect(mestre)

        // o sub pega a frequência de combustão (duas por volta): é o que o
        // alto-falante de notebook não reproduz e o de totem sim
        const sub = c.createOscillator()
        sub.type = 'sine'
        sub.connect(g)

        // marcha lenta não é estável: a rotação balança. Sem isto o motor
        // parado soa como nota segurada, que é o som que ninguém tem no pátio
        const lfo = c.createOscillator()
        lfo.type = 'sine'
        lfo.frequency.value = 1.7
        const balanco = c.createGain()
        balanco.gain.value = 0.45
        lfo.connect(balanco).connect(osc.frequency)

        // chiado de rolagem, separado para subir mais rápido que o motor
        const vento = c.createBiquadFilter()
        vento.type = 'highpass'
        vento.frequency.value = 700
        const ar = c.createGain()
        ar.gain.value = 0.0001
        const fonte = chiado(c, 0.83, 0.4)
        fonte.connect(vento).connect(ar).connect(mestre)

        osc.start(); sub.start(); lfo.start()
        nos = { osc, sub, lfo, fonte, g, lata, ar, vento, ultimo: NaN }
      }
      if (!nos) return
      const kmh = velocidade * 3.6
      // o quadro custa 6 automações; parado ou em velocidade de cruzeiro elas
      // não mudam nada, então não vale pagá-las
      if (Math.abs(kmh - nos.ultimo) < 0.15) return
      nos.ultimo = kmh
      const t = c.currentTime
      // marcha fictícia: a rotação sobe dentro da marcha e volta ao trocar,
      // senão o motor vira uma sirene subindo sem parar até 60 km/h
      const marcha = Math.min(3, Math.floor(kmh / 20))
      const dentro = (kmh - marcha * 20) / 20
      // 700 rpm em marcha lenta, 2200 no fim da marcha: a frequência do
      // oscilador É a volta do virabrequim, rpm/60
      const volta = 11.7 + dentro * 25
      const carga = Math.min(kmh, 60) / 60
      nos.osc.frequency.setTargetAtTime(volta, t, 0.12)
      nos.sub.frequency.setTargetAtTime(volta * 2, t, 0.12)
      // os ganhos são baixos porque o trem de pulsos tem muito mais energia que
      // o dente de serra que havia aqui: a régua é a buzina, que precisa passar
      // por cima do motor para continuar servindo de aviso
      nos.g.gain.setTargetAtTime(0.055 + carga * 0.07, t, 0.15)
      nos.lata.gain.setTargetAtTime(0.005 + dentro * 0.011, t, 0.15)
      nos.ar.gain.setTargetAtTime(carga * 0.02, t, 0.2)
      nos.vento.frequency.setTargetAtTime(620 + carga * 900, t, 0.3)
    }
  })(),

  /**
   * Fundo de rua. Um bafo grave sozinho soa como fita velha, porque silêncio de
   * cidade não é liso: é um zumbido que vai e volta, um chiado de ar bem acima
   * dele e, de vez em quando, alguém passando longe.
   *
   * As três camadas são contínuas e nascem uma vez; o veículo ocasional é a
   * própria `passagem`, com `lateral` grande — longe, chato e surdo.
   */
  ambiente: (() => {
    let g: GainNode | null = null
    let fontes: AudioScheduledSourceNode[] = []
    let timer: number | null = null
    return (ligado: boolean) => {
      const c = ligado ? ligar() : ctx
      if (!c || !mestre || !ruido) return
      if (!ligado) {
        if (g) {
          g.gain.setTargetAtTime(0.0001, c.currentTime, 0.4)
          // baixar o ganho não para nada: fonte em laço que ninguém para fica
          // viva para sempre, e cada entrada na fase criava outra
          for (const f of fontes) f.stop(c.currentTime + 2)
          fontes = []
          g = null
        }
        if (timer) { clearTimeout(timer); timer = null }
        return
      }
      if (g) return
      g = c.createGain()
      g.gain.value = 0.0001
      g.gain.setTargetAtTime(1, c.currentTime, 1.2)
      g.connect(mestre)

      // 1. o zumbido: tudo que roda longe, somado e sem agudo nenhum
      const grave = c.createBiquadFilter()
      grave.type = 'lowpass'
      grave.frequency.value = 180
      grave.Q.value = 0.9
      const gz = c.createGain()
      gz.gain.value = 0.052
      const rolo = chiado(c, 1, 0)
      rolo.connect(grave).connect(gz).connect(g)

      // 2. e ele respira: o trânsito longe aperta e afrouxa num ciclo de ~17 s.
      // é a variação lenta que faz o ouvido parar de notar o laço do ruído
      const mare = c.createOscillator()
      mare.type = 'sine'
      mare.frequency.value = 0.058
      const amplitude = c.createGain()
      amplitude.gain.value = 0.026
      mare.connect(amplitude).connect(gz.gain)
      mare.start()

      // 3. o chiado do ar — quase nada, mas sem ele a cena fica abafada
      const agudo = c.createBiquadFilter()
      agudo.type = 'bandpass'
      agudo.frequency.value = 1250
      agudo.Q.value = 0.4
      const ga = c.createGain()
      ga.gain.value = 0.012
      const sopro = chiado(c, 0.79, 0.9)
      sopro.connect(agudo).connect(ga).connect(g)
      fontes = [rolo, mare, sopro]

      // 4. um veículo de tempo em tempo, nunca no mesmo compasso
      const carro = () => {
        som.passagem(0.3 + Math.random() * 0.3, 14 + Math.random() * 16)
        timer = window.setTimeout(carro, 5000 + Math.random() * 9000)
      }
      timer = window.setTimeout(carro, 3500 + Math.random() * 5000)
    }
  })(),

  /**
   * Veículo cruzando em sentido contrário: o "fiuu" que sobe e desce.
   *
   * O PannerNode com velocidade (o Doppler da especificação) foi retirado e os
   * navegadores ignoram, então a passagem é traçada na mão — mas com a geometria
   * certa em vez de duas rampas: a distância até um ponto que passa a `lateral`
   * metros de você decide as três curvas de uma vez.
   *
   *   volume  = (lateral/distância)^1.5  — sobe devagar e desaba, que é o que o
   *             ouvido lê como "passou por mim"
   *   altura  = 343/(343 + velocidade radial) — Doppler de verdade, inclinado
   *             onde o veículo está mais perto e chato nas pontas
   *   estéreo = o seno do ângulo: entra por um lado e sai pelo outro
   *
   * `lateral` grande é um veículo longe: mais chato, mais surdo, mais centrado.
   * Tudo é agendado de uma vez em curvas de 48 pontos — nada por quadro.
   */
  passagem(forte = 1, lateral = 4) {
    const c = ligar()
    if (!c || !mestre || !ruido) return
    const t = c.currentTime
    // de frente, a velocidade que conta é a soma das duas
    const vel = 26 + Math.random() * 14
    const dur = 1.2 + lateral * 0.05
    const N = 48
    const amp = new Float32Array(N)
    const pan = new Float32Array(N)
    const pneu = new Float32Array(N)
    const ronco = new Float32Array(N)
    const base = 760 + Math.random() * 400
    const motor = 68 + Math.random() * 40
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1)
      const x = (u - 0.5) * dur * vel
      const d = Math.hypot(x, lateral)
      // sem fechar as pontas o som começa e termina com um estalo
      const janela = Math.pow(Math.sin(Math.PI * u), 0.35)
      amp[i] = Math.max(0.0001, Math.pow(lateral / d, 1.5) * janela * 0.26 * forte)
      pan[i] = (-x / d) * 0.92
      const dop = 343 / (343 + (x / d) * vel)
      // perto também é mais brilhante: longe o ar come o agudo
      pneu[i] = base * dop * (0.55 + 0.45 * Math.pow(lateral / d, 0.5))
      ronco[i] = motor * dop
    }
    const pan2 = c.createStereoPanner()
    pan2.pan.setValueCurveAtTime(pan, t, dur)
    const g = c.createGain()
    g.gain.setValueCurveAtTime(amp, t, dur)
    g.connect(pan2).connect(mestre)

    // o pneu no asfalto é o que mais se ouve de uma passagem; o motor é o
    // grave que vem junto e some primeiro
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.8
    bp.frequency.setValueCurveAtTime(pneu, t, dur)
    const f = chiado(c, 1, Math.random() * 1.5)
    f.connect(bp).connect(g)
    f.stop(t + dur + 0.05)

    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueCurveAtTime(ronco, t, dur)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 420
    lp.Q.value = 1.6
    const gm = c.createGain()
    gm.gain.value = 0.5
    o.connect(lp).connect(gm).connect(g)
    o.start(t)
    o.stop(t + dur + 0.05)
  },

  /**
   * Pneu travado no asfalto. O que vira guincho não é o ruído, são duas
   * ressonâncias estreitas dele escorregando para baixo enquanto a roda perde
   * giro — e o grave embaixo é o carro afundando na dianteira.
   */
  freada(forte = 1) {
    const c = ligar()
    if (!c || !mestre || !ruido) return
    const t = c.currentTime
    const dur = 0.5 + 0.4 * forte
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.14 * forte, t + 0.07)
    g.gain.exponentialRampToValueAtTime(0.095 * forte, t + dur * 0.75)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    g.connect(mestre)
    const f = chiado(c, 1, Math.random() * 1.5)
    for (const [de, ate, q, peso] of [[1780, 1150, 13, 1], [1170, 840, 9, 0.7], [160, 120, 1, 0.35]]) {
      const bp = c.createBiquadFilter()
      bp.type = q > 2 ? 'bandpass' : 'lowpass'
      bp.frequency.setValueAtTime(de, t)
      bp.frequency.exponentialRampToValueAtTime(ate, t + dur)
      bp.Q.value = q
      const a = c.createGain()
      a.gain.value = peso * 9
      f.connect(bp).connect(a).connect(g)
    }
    f.stop(t + dur + 0.05)
  },

  /** Pisca-alerta: o relê batendo. A batida de ligar é mais seca que a de soltar. */
  pisca: (() => {
    let timer: number | null = null
    return (ligado: boolean) => {
      if (!ligado) {
        if (timer) { clearInterval(timer); timer = null }
        return
      }
      if (timer) return
      const ciclo = () => { estalo(2000, 0.16, 0.022); estalo(1150, 0.1, 0.038, 0.36) }
      ciclo()
      timer = window.setInterval(ciclo, 780)
    }
  })(),

  /** Buzina de carro — mais aguda que a do caminhão, e mais curta. */
  buzinaCarro() {
    const c = ligar()
    if (!c || !mestre) return
    const t = c.currentTime
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.10, t + 0.02)
    g.gain.setValueAtTime(0.10, t + 0.22)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2600
    for (const f of [440, 554]) {
      const o = c.createOscillator()
      o.type = 'square'
      o.frequency.value = f
      o.connect(lp)
      o.start(t)
      o.stop(t + 0.4)
    }
    lp.connect(g).connect(mestre)
  },

  /**
   * Pátio de escola: vozes agudas, sem palavra nenhuma.
   *
   * Som de criança é o que diz "escola" antes da placa e antes do muro — e
   * tem função na fase, porque é o aviso de que ali se reduz. Formantes
   * altos sobre ruído filtrado: a 40 m ninguém distingue palavra, só registra
   * que são crianças.
   */
  criancas: (() => {
    let g: GainNode | null = null
    let timer: number | null = null
    return (ligado: boolean, forte = 1) => {
      const c = ligado ? ligar() : ctx
      if (!c || !mestre || !ruido) return
      if (!ligado) {
        if (g) { g.gain.setTargetAtTime(0.0001, c.currentTime, 0.5); g = null }
        if (timer) { clearInterval(timer); timer = null }
        return
      }
      if (!g) {
        const f = c.createBufferSource()
        f.buffer = ruido
        f.loop = true
        const bp = c.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 1750
        bp.Q.value = 1.1
        g = c.createGain()
        g.gain.value = 0.0001
        f.connect(bp).connect(g).connect(mestre)
        f.start()
        // gritinhos esparsos por cima do bafo: é a irregularidade que separa
        // pátio de escola de chiado de rádio
        timer = window.setInterval(() => {
          if (!ctx || !g) return
          const t = ctx.currentTime + Math.random() * 0.6
          const o = ctx.createOscillator()
          const gg = ctx.createGain()
          o.type = 'sine'
          const base = 620 + Math.random() * 520
          o.frequency.setValueAtTime(base, t)
          o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random()), t + 0.22)
          bater(gg, 0.016, 0.3, t)
          o.connect(gg).connect(mestre!)
          o.start(t)
          o.stop(t + 0.4)
        }, 1500)
      }
      g.gain.setTargetAtTime(0.030 * forte, c.currentTime, 0.6)
    }
  })(),

  /**
   * Fala sem palavra: sílabas com contorno de altura, tipo simlish.
   *
   * Por que inventar a língua em vez de gravar: voz gravada traria arquivo,
   * sotaque e licença num jogo que vira `.exe` offline — e, pior, fixaria um
   * timbre de pessoa num personagem que o jogador acabou de montar. Sílaba
   * sintética entrega a INTENÇÃO (quem fala, com que ânimo) e deixa o sentido
   * para a legenda, que é onde ele tem de estar mesmo num treinamento.
   *
   * O que faz soar humano não é o timbre, são dois formantes se movendo
   * junto com a fundamental. Uma onda só soa como apito de micro-ondas.
   */
  fala(silabas = 6, grave = 1) {
    const c = ligar()
    if (!c || !mestre) return
    let t = c.currentTime + 0.05
    const base = 128 / grave
    for (let i = 0; i < silabas; i++) {
      const dur = 0.13 + Math.random() * 0.1
      // a frase cai no fim, que é o que faz soar afirmação e não pergunta
      const queda = i / Math.max(1, silabas - 1)
      const f0 = base * (1.06 - queda * 0.22) * (0.94 + Math.random() * 0.13)
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(f0, t)
      o.frequency.linearRampToValueAtTime(f0 * (0.9 + Math.random() * 0.2), t + dur)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.085, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      // dois formantes: é o par deles que o ouvido lê como vogal
      const vogais: [number, number][] = [
        [730, 1090], [530, 1840], [390, 1990], [570, 840], [300, 870],
      ]
      const [f1, f2] = vogais[Math.floor(Math.random() * vogais.length)]
      let fim: AudioNode = o
      for (const [fr, q, gg] of [[f1, 7, 1.0], [f2, 9, 0.6]] as const) {
        const bp = c.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = fr
        bp.Q.value = q
        const amp = c.createGain()
        amp.gain.value = gg
        fim.connect(bp).connect(amp)
        fim = amp
      }
      fim.connect(g).connect(mestre)
      o.start(t)
      o.stop(t + dur + 0.02)
      t += dur + 0.045 + Math.random() * 0.05
    }
    return t - c.currentTime
  },

  get mudo() { return mudo },

  alternarMudo() {
    mudo = !mudo
    localStorage.setItem(CHAVE_MUDO, mudo ? '1' : '0')
    if (mestre && ctx) mestre.gain.setTargetAtTime(mudo ? 0 : 0.6, ctx.currentTime, 0.05)
    return mudo
  },
}

/**
 * Um ouvinte só, na captura, dá som a todo botão do jogo — inclusive os que
 * ainda não existem. A alternativa era um onClick em cada um dos ~40.
 */
export function ligarCliqueGlobal() {
  // mesmo padrão de `window.__trajeto`: sem isto não há como conferir áudio
  // automaticamente, porque o resultado é som e não pixel
  if (import.meta.env.DEV) {
    ;(window as unknown as Record<string, unknown>).__som = {
      som,
      estado: () => ctx?.state ?? 'sem contexto',
      ganho: () => mestre?.gain.value,
      /** Energia que está realmente saindo. Sem isto, "tem som" é suposição. */
      nivel: () => {
        if (!ctx || !mestre) return null
        if (!analise) { analise = ctx.createAnalyser(); mestre.connect(analise) }
        const v = new Float32Array(analise.fftSize)
        analise.getFloatTimeDomainData(v)
        return +Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length).toFixed(4)
      },
    }
  }
  document.addEventListener('pointerdown', (e) => {
    const alvo = (e.target as Element | null)?.closest?.('button')
    if (alvo && !alvo.disabled) som.clique()
  }, { capture: true })
}

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
// Nasce MUDO. Som que começa sozinho incomoda em sala de treinamento e em
// totem; quem quiser liga no botão, e a escolha fica guardada.
let mudo = localStorage.getItem(CHAVE_MUDO) !== '0'

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
    let nos: { osc: OscillatorNode; sub: OscillatorNode; g: GainNode; ar: GainNode } | null = null
    return (velocidade: number | null) => {
      const c = velocidade === null ? ctx : ligar()
      if (!c || !mestre) return
      if (velocidade === null) {
        if (nos) {
          nos.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.08)
          nos.osc.stop(c.currentTime + 0.5)
          nos.sub.stop(c.currentTime + 0.5)
          nos = null
        }
        return
      }
      if (!nos && ruido) {
        const lp = c.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 420
        const g = c.createGain()
        g.gain.value = 0.0001
        // o diesel é o dente de serra grave; o sub dá o corpo que o alto-falante
        // de notebook não reproduz mas o de totem sim
        const osc = c.createOscillator()
        osc.type = 'sawtooth'
        const sub = c.createOscillator()
        sub.type = 'sine'
        // chiado de rolagem, separado para subir mais rápido que o motor
        const f = c.createBufferSource()
        f.buffer = ruido
        f.loop = true
        const bp = c.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 900
        const ar = c.createGain()
        ar.gain.value = 0.0001
        osc.connect(lp); sub.connect(lp); lp.connect(g).connect(mestre)
        f.connect(bp).connect(ar).connect(mestre)
        osc.start(); sub.start(); f.start()
        nos = { osc, sub, g, ar }
      }
      if (!nos) return
      const t = c.currentTime
      const kmh = velocidade * 3.6
      // marcha fictícia: a frequência sobe dentro da marcha e volta ao trocar,
      // senão o motor vira uma sirene subindo sem parar até 60 km/h
      const marcha = Math.min(3, Math.floor(kmh / 20))
      const dentro = (kmh - marcha * 20) / 20
      nos.osc.frequency.setTargetAtTime(52 + dentro * 46, t, 0.12)
      nos.sub.frequency.setTargetAtTime(26 + dentro * 23, t, 0.12)
      nos.g.gain.setTargetAtTime(0.05 + Math.min(kmh, 60) / 60 * 0.07, t, 0.15)
      nos.ar.gain.setTargetAtTime(Math.min(kmh, 60) / 60 * 0.035, t, 0.2)
    }
  })(),

  /** Fundo de rua: um bafo grave quase inaudível, só para a cena não ficar surda. */
  ambiente: (() => {
    let g: GainNode | null = null
    return (ligado: boolean) => {
      const c = ligado ? ligar() : ctx
      if (!c || !mestre || !ruido) return
      if (!ligado) {
        if (g) { g.gain.setTargetAtTime(0.0001, c.currentTime, 0.4); g = null }
        return
      }
      if (g) return
      const f = c.createBufferSource()
      f.buffer = ruido
      f.loop = true
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 260
      g = c.createGain()
      g.gain.value = 0.0001
      g.gain.setTargetAtTime(0.055, c.currentTime, 1.2)
      f.connect(lp).connect(g).connect(mestre)
      f.start()
    }
  })(),

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

// Sonidos del sorteo, generados con la Web Audio API: no hay archivos de audio
// que cargar ni licencias que revisar. Código de navegador.
//
// Los navegadores no dejan sonar nada hasta que la persona toca la página una
// vez. Los sonidos se disparan siempre después de un toque (el botón "Revelar"
// o la inscripción); si no hubo ninguno, simplemente no suenan.
//
// La persona puede silenciarlos: la preferencia se guarda en este navegador.

const STORAGE_KEY = 'giveaway-sound'

let context = null
let master = null
let muted = null // se lee del almacenamiento la primera vez que se necesita
const listeners = new Set()

function readMuted() {
  if (muted === null) {
    try {
      muted = localStorage.getItem(STORAGE_KEY) === 'off'
    } catch {
      muted = false
    }
  }
  return muted
}

export function isSoundMuted() {
  return readMuted()
}

export function setSoundMuted(value) {
  muted = Boolean(value)
  try {
    localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on')
  } catch {
    // Sin almacenamiento: vale solo mientras la página siga abierta.
  }
  listeners.forEach(listener => listener())
}

// Para useSyncExternalStore: avisa cuando cambia el silencio.
export function subscribeSound(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getContext() {
  if (typeof window === 'undefined') return null
  if (!context) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return null
    try {
      context = new AudioCtx()
      master = context.createGain()
      master.gain.value = 0.55
      master.connect(context.destination)
    } catch {
      context = null
      return null
    }
  }
  return context
}

/** Habilita el audio. Llamarla dentro de un toque (click) de la persona. */
export function unlockAudio() {
  const ctx = getContext()
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
}

// Contexto listo para sonar, o null si está silenciado o no hay audio.
function ready() {
  if (readMuted()) return null
  const ctx = getContext()
  if (!ctx) return null
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// Una nota: oscilador con ataque corto y caída exponencial.
function tone(ctx, { freq, at = 0, dur = 0.25, type = 'sine', gain = 0.2, to = null }) {
  const t0 = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const amp = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(amp)
  amp.connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

// Ruido filtrado (viento, redoble, chispas). `from` y `to` son la frecuencia del
// filtro al principio y al final.
function noise(ctx, { at = 0, dur = 0.4, gain = 0.1, from = 400, to = 4000, type = 'bandpass', q = 0.9 }) {
  const t0 = ctx.currentTime + at
  const length = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1

  const source = ctx.createBufferSource()
  source.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.Q.value = q
  filter.frequency.setValueAtTime(from, t0)
  filter.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  const amp = ctx.createGain()
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.08, dur / 3))
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  source.connect(filter)
  filter.connect(amp)
  amp.connect(master)
  source.start(t0)
  return { source, amp }
}

/** Clic seco, como el de una ruleta o un contador que va frenando. */
export function playTick(strength = 1) {
  const ctx = ready()
  if (!ctx) return
  tone(ctx, { freq: 1700, to: 800, dur: 0.035, type: 'square', gain: 0.035 * strength })
}

/** Una esfera que cae a la urna: golpe grave y un "tin" agudo. */
export function playDrop() {
  const ctx = ready()
  if (!ctx) return
  tone(ctx, { freq: 520, to: 240, dur: 0.2, gain: 0.16 })
  tone(ctx, { freq: 1320, at: 0.17, dur: 0.22, type: 'triangle', gain: 0.07 })
  tone(ctx, { freq: 1760, at: 0.24, dur: 0.3, type: 'sine', gain: 0.045 })
}

/** Una oportunidad que se confirma: dos notas ascendentes. */
export function playConfirm() {
  const ctx = ready()
  if (!ctx) return
  tone(ctx, { freq: 659.25, dur: 0.2, type: 'triangle', gain: 0.13 })
  tone(ctx, { freq: 987.77, at: 0.11, dur: 0.38, type: 'triangle', gain: 0.13 })
}

/**
 * Redoble de la urna mezclando: ruido grave que sube durante `ms`. Devuelve
 * una función que lo corta (por ejemplo, al saltar la animación).
 */
export function playRumble(ms = 3000) {
  const ctx = ready()
  if (!ctx) return () => {}
  const { source, amp } = noise(ctx, { dur: ms / 1000, gain: 0.07, from: 140, to: 520, type: 'lowpass', q: 0.7 })
  return () => {
    try {
      const now = ctx.currentTime
      amp.gain.cancelScheduledValues(now)
      amp.gain.setTargetAtTime(0.0001, now, 0.04)
      source.stop(now + 0.25)
    } catch {
      // Ya había terminado.
    }
  }
}

/**
 * Revelación del ganador: soplido, arpegio ascendente en do mayor, acorde
 * sostenido y chispas agudas.
 */
export function playWinner() {
  const ctx = ready()
  if (!ctx) return

  noise(ctx, { dur: 0.55, gain: 0.09, from: 500, to: 5200 })

  const arpeggio = [523.25, 659.25, 783.99, 1046.5]
  arpeggio.forEach((freq, i) => {
    tone(ctx, { freq, at: 0.08 + i * 0.1, dur: 0.55, type: 'triangle', gain: 0.15 })
  })

  // Acorde final sostenido.
  const chordAt = 0.08 + arpeggio.length * 0.1
  ;[523.25, 659.25, 783.99, 1046.5].forEach(freq => {
    tone(ctx, { freq, at: chordAt, dur: 1.5, type: 'sine', gain: 0.08 })
  })
  tone(ctx, { freq: 261.63, at: chordAt, dur: 1.5, type: 'triangle', gain: 0.1 })

  // Chispas.
  ;[1568, 2093, 2637, 2093].forEach((freq, i) => {
    tone(ctx, { freq, at: chordAt + 0.1 + i * 0.12, dur: 0.35, type: 'sine', gain: 0.05 })
  })
}

/**
 * Programa clics que se van espaciando (como una ruleta que frena).
 * `delays` son las pausas entre clics en milisegundos. Devuelve una función
 * que cancela los que falten.
 */
export function scheduleTicks(delays, strength = 1) {
  const timers = []
  let at = 0
  for (const delay of delays) {
    at += delay
    timers.push(setTimeout(() => playTick(strength), at))
  }
  return () => timers.forEach(clearTimeout)
}

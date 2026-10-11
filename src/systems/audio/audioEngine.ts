/**
 * Motor de sonido procedural (Web Audio, sin archivos ni librerías).
 * Todo se sintetiza: viento y lluvia con ruido filtrado, crepitar del fuego,
 * grillos, pasos, golpes y pitidos. Pesa 0 KB en descargas y funciona offline.
 *
 * El navegador solo permite sonar tras un gesto del usuario: `unlockAudio()`
 * se llama en el primer toque o tecla.
 */

const MUTE_KEY = 'exploradord-muted'

type Loop = { gain: GainNode; filter: BiquadFilterNode }

type Engine = {
  ctx: AudioContext
  master: GainNode
  noise: AudioBuffer
  wind: Loop
  rain: Loop
  fire: { gain: GainNode }
  crickets: { gain: GainNode }
}

let engine: Engine | null = null
let muted = readMuted()
const listeners = new Set<(m: boolean) => void>()

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export const isMuted = () => muted

export function setMuted(value: boolean) {
  muted = value
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    /* sin almacenamiento: solo esta sesión */
  }
  if (engine) engine.master.gain.setTargetAtTime(value ? 0 : 1, engine.ctx.currentTime, 0.1)
  listeners.forEach((l) => l(value))
}

export function onMuteChange(fn: (m: boolean) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

function createNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  // Ruido "marrón" suavizado: más grave y natural que el blanco para el viento.
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.04 * white) / 1.04
    data[i] = last * 3.5 * 0.6 + white * 0.4 * 0.35
  }
  return buffer
}

function noiseLoop(e: Pick<Engine, 'ctx' | 'master' | 'noise'>, type: BiquadFilterType, freq: number, q = 0.7): Loop {
  const src = e.ctx.createBufferSource()
  src.buffer = e.noise
  src.loop = true
  // Desfase aleatorio para que dos bucles con el mismo ruido no suenen iguales.
  const filter = e.ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  filter.Q.value = q
  const gain = e.ctx.createGain()
  gain.gain.value = 0
  src.connect(filter).connect(gain).connect(e.master)
  src.start(0, Math.random() * 2)
  return { gain, filter }
}

/** Crea el contexto de audio (en el primer gesto del usuario). */
export function unlockAudio() {
  if (engine) {
    if (engine.ctx.state === 'suspended') void engine.ctx.resume()
    return
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return
  const ctx = new Ctor()
  const master = ctx.createGain()
  master.gain.value = muted ? 0 : 1
  master.connect(ctx.destination)
  const base = { ctx, master, noise: createNoise(ctx) }
  const wind = noiseLoop(base, 'bandpass', 500, 0.6)
  const rain = noiseLoop(base, 'highpass', 1800, 0.5)
  const fire = { gain: ctx.createGain() }
  fire.gain.gain.value = 0
  fire.gain.connect(master)
  const crickets = { gain: ctx.createGain() }
  crickets.gain.gain.value = 0
  crickets.gain.connect(master)
  engine = { ...base, wind, rain, fire, crickets }
}

export const audioReady = () => !!engine && engine.ctx.state === 'running'

/** Niveles de los ambientes en bucle (se llama cada frame; suavizado interno). */
export function setAmbience(levels: { wind: number; windPitch: number; rain: number; fire: number; crickets: number }) {
  if (!engine) return
  const t = engine.ctx.currentTime
  engine.wind.gain.gain.setTargetAtTime(levels.wind * 0.5, t, 0.3)
  engine.wind.filter.frequency.setTargetAtTime(300 + levels.windPitch * 900, t, 0.4)
  engine.rain.gain.gain.setTargetAtTime(levels.rain * 0.35, t, 0.5)
  engine.fire.gain.gain.setTargetAtTime(levels.fire * 0.6, t, 0.3)
  engine.crickets.gain.gain.setTargetAtTime(levels.crickets * 0.12, t, 1)
}

/** Ráfaga corta de ruido filtrado (base de pasos, golpes y chasquidos). */
function burst(dest: AudioNode, opts: { freq: number; type?: BiquadFilterType; dur: number; vol: number; q?: number; at?: number }) {
  if (!engine) return
  const { ctx, noise } = engine
  const t = opts.at ?? ctx.currentTime
  const src = ctx.createBufferSource()
  src.buffer = noise
  const f = ctx.createBiquadFilter()
  f.type = opts.type ?? 'bandpass'
  f.frequency.value = opts.freq
  f.Q.value = opts.q ?? 1
  const g = ctx.createGain()
  g.gain.setValueAtTime(opts.vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + opts.dur)
  src.connect(f).connect(g).connect(dest)
  src.start(t, Math.random() * 1.5, opts.dur + 0.05)
}

function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', endFreq?: number, at?: number) {
  if (!engine) return
  const { ctx, master } = engine
  const t = at ?? ctx.currentTime
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** Paso metálico sobre arena: "chof" grave + un leve tintineo de la articulación. */
export function playFootstep(volume = 1) {
  if (!engine) return
  burst(engine.master, { freq: 380 + Math.random() * 120, dur: 0.12, vol: 0.18 * volume, q: 0.8 })
  if (Math.random() < 0.35) tone(1800 + Math.random() * 400, 0.05, 0.015 * volume, 'triangle')
}

/** Golpe al recolectar: madera, piedra o metal. */
export function playHit(material: 'wood' | 'stone' | 'metal' | 'plant') {
  if (!engine) return
  switch (material) {
    case 'wood':
      burst(engine.master, { freq: 600, dur: 0.15, vol: 0.35, q: 2 })
      tone(180, 0.12, 0.2, 'triangle', 90)
      break
    case 'stone':
      burst(engine.master, { freq: 1600, dur: 0.18, vol: 0.3, q: 3 })
      tone(120, 0.1, 0.2, 'square', 60)
      break
    case 'metal':
      tone(620, 0.35, 0.12, 'triangle', 540)
      tone(1490, 0.25, 0.06, 'sine')
      burst(engine.master, { freq: 3000, dur: 0.08, vol: 0.15, q: 4 })
      break
    case 'plant':
      burst(engine.master, { freq: 2500, type: 'highpass', dur: 0.2, vol: 0.18 })
      break
  }
}

/** Recurso conseguido: dos notas ascendentes. */
export function playPickup() {
  if (!engine) return
  const t = engine.ctx.currentTime
  tone(660, 0.12, 0.08, 'sine', undefined, t)
  tone(990, 0.16, 0.08, 'sine', undefined, t + 0.08)
}

/** Pitido de batería baja. */
export function playLowBattery() {
  if (!engine) return
  const t = engine.ctx.currentTime
  tone(880, 0.09, 0.07, 'square', undefined, t)
  tone(660, 0.12, 0.07, 'square', undefined, t + 0.14)
}

/** Clic suave de interfaz. */
export function playClick() {
  tone(1200, 0.04, 0.04, 'triangle')
}

/** Chasquidos del fuego (llamar con frecuencia aleatoria). */
export function crackle() {
  if (!engine) return
  burst(engine.fire.gain, { freq: 1500 + Math.random() * 2500, dur: 0.03 + Math.random() * 0.05, vol: 0.4 + Math.random() * 0.5, q: 2 })
  if (Math.random() < 0.3) burst(engine.fire.gain, { freq: 200, dur: 0.3, vol: 0.25, type: 'lowpass' })
}

/** Un canto de grillo: tres pulsos agudos muy rápidos. */
export function chirp() {
  if (!engine) return
  const { ctx, crickets } = engine
  const t = ctx.currentTime
  const pitch = 4200 + Math.random() * 600
  for (let i = 0; i < 3; i++) {
    const o = ctx.createOscillator()
    o.frequency.value = pitch
    const g = ctx.createGain()
    const at = t + i * 0.055
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(0.5, at + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04)
    o.connect(g).connect(crickets.gain)
    o.start(at)
    o.stop(at + 0.05)
  }
}

/**
 * Trueno: retumbo grave que crece y se apaga. `near` 0..1 = rayo cercano
 * (más fuerte, con chasquido agudo); `delay` en segundos (la luz llega antes).
 */
export function thunder(near = 0, delay = 0) {
  if (!engine) return
  const { ctx, master } = engine
  const t = ctx.currentTime + delay
  const src = ctx.createBufferSource()
  src.buffer = engine.noise
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 160 + near * 500
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.9 + near * 0.6, t + 0.25 - near * 0.2)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5 + near)
  src.connect(f).connect(g).connect(master)
  src.start(t, Math.random(), 4.6)
  if (near > 0.5) {
    // Chasquido seco del rayo al caer cerca.
    const c = ctx.createBufferSource()
    c.buffer = engine.noise
    const hf = ctx.createBiquadFilter()
    hf.type = 'highpass'
    hf.frequency.value = 1200
    const cg = ctx.createGain()
    cg.gain.setValueAtTime(0.0001, t)
    cg.gain.exponentialRampToValueAtTime(0.7 * near, t + 0.01)
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    c.connect(hf).connect(cg).connect(master)
    c.start(t, Math.random(), 0.4)
  }
}

/**
 * Tiny Web Audio "ding" used to flag that a player earned a message tile
 * (The Messengers). Generated programmatically so there's no asset to bundle —
 * keeps the PWA small and works offline.
 */

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

/** Resume the shared AudioContext. Safe to call from any user gesture. */
export function unlockAudio(): void {
  const c = getCtx()
  if (c && c.state === 'suspended') void c.resume()
}

/** A short two-note chime (A5 → E6) signalling an earned message. */
export function playMessageChime(): void {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  const now = c.currentTime
  const notes = [
    { freq: 880, start: 0, dur: 0.12 }, // A5
    { freq: 1318.51, start: 0.1, dur: 0.2 }, // E6
  ]
  for (const n of notes) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = n.freq
    gain.gain.setValueAtTime(0.0001, now + n.start)
    gain.gain.exponentialRampToValueAtTime(0.18, now + n.start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur)
    osc.connect(gain).connect(c.destination)
    osc.start(now + n.start)
    osc.stop(now + n.start + n.dur + 0.02)
  }
}

// Unlock the AudioContext on the first user interaction so the chime can play
// later from inside an effect (browsers block audio until a gesture occurs).
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockAudio()
    window.removeEventListener('pointerdown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
}

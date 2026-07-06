type TurnChimeState = {
  wasYourTurn: boolean
  isYourTurn: boolean
  isPlaying: boolean
  isEliminated: boolean
}

const TURN_SOUND_STORAGE_KEY = 'deduction-game.turnSoundEnabled'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export function shouldPlayTurnChime({
  wasYourTurn,
  isYourTurn,
  isPlaying,
  isEliminated,
}: TurnChimeState) {
  return isPlaying && isYourTurn && !wasYourTurn && !isEliminated
}

export function readTurnSoundPreference(storage: StorageLike | null = getLocalStorage()) {
  try {
    return storage?.getItem(TURN_SOUND_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function saveTurnSoundPreference(
  enabled: boolean,
  storage: StorageLike | null = getLocalStorage(),
) {
  try {
    storage?.setItem(TURN_SOUND_STORAGE_KEY, enabled ? 'true' : 'false')
  } catch {
    // Private browsing or blocked storage should not break gameplay.
  }
}

export function playGentleTurnChime() {
  if (typeof window === 'undefined') return

  const AudioContextConstructor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext

  if (!AudioContextConstructor) return

  try {
    const audioContext = new AudioContextConstructor()
    const now = audioContext.currentTime
    const masterGain = audioContext.createGain()

    masterGain.gain.setValueAtTime(0.0001, now)
    masterGain.gain.exponentialRampToValueAtTime(0.075, now + 0.05)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05)
    masterGain.connect(audioContext.destination)

    ;[
      { frequency: 523.25, delay: 0 },
      { frequency: 659.25, delay: 0.08 },
      { frequency: 783.99, delay: 0.16 },
    ].forEach(({ frequency, delay }) => {
      const oscillator = audioContext.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, now + delay)
      oscillator.connect(masterGain)
      oscillator.start(now + delay)
      oscillator.stop(now + delay + 0.65)
    })

    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch(() => undefined)
    }

    window.setTimeout(() => {
      void audioContext.close().catch(() => undefined)
    }, 1300)
  } catch {
    // Autoplay restrictions or unavailable audio hardware should never block play.
  }
}

function getLocalStorage() {
  if (typeof window === 'undefined') return null

  return window.localStorage
}

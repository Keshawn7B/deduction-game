import { describe, expect, it } from 'vitest'
import { shouldPlayTurnChime } from './turnSound'

describe('turn sound cues', () => {
  it('plays only when the local player newly becomes the active player', () => {
    expect(
      shouldPlayTurnChime({
        wasYourTurn: false,
        isYourTurn: true,
        isPlaying: true,
        isEliminated: false,
      }),
    ).toBe(true)
  })

  it('does not repeat while the local player remains the active player', () => {
    expect(
      shouldPlayTurnChime({
        wasYourTurn: true,
        isYourTurn: true,
        isPlaying: true,
        isEliminated: false,
      }),
    ).toBe(false)
  })

  it('stays silent outside playable turn states', () => {
    expect(
      shouldPlayTurnChime({
        wasYourTurn: false,
        isYourTurn: true,
        isPlaying: false,
        isEliminated: false,
      }),
    ).toBe(false)

    expect(
      shouldPlayTurnChime({
        wasYourTurn: false,
        isYourTurn: true,
        isPlaying: true,
        isEliminated: true,
      }),
    ).toBe(false)

    expect(
      shouldPlayTurnChime({
        wasYourTurn: false,
        isYourTurn: false,
        isPlaying: true,
        isEliminated: false,
      }),
    ).toBe(false)
  })
})

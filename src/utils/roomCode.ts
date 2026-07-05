const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function createRoomCode(length = 4): string {
  let code = ''

  for (let index = 0; index < length; index += 1) {
    const charIndex = Math.floor(Math.random() * ROOM_CODE_CHARS.length)
    code += ROOM_CODE_CHARS[charIndex]
  }

  return code
}

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

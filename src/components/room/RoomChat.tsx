import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { listenToRoomChat, sendRoomChatMessage } from '../../firebase/rooms'
import type { RoomChatMessage } from '../../types/chat'

type RoomChatProps = {
  roomCode: string
  userId?: string
  canChat: boolean
  compact?: boolean
}

export function RoomChat({ roomCode, userId, canChat, compact = false }: RoomChatProps) {
  const [messages, setMessages] = useState<RoomChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!roomCode) return

    return listenToRoomChat(roomCode, setMessages)
  }, [roomCode])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!userId || !canChat || sending) return

    const message = draft.trim()

    if (!message) return

    setSending(true)
    setError('')

    try {
      await sendRoomChatMessage({ roomCode, playerId: userId, message })
      setDraft('')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not send message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-slate-950/20">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Room chat</p>
          <h2 className="mt-1 font-black text-slate-100">Table talk</h2>
        </div>
        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-slate-400">
          {messages.length}
        </span>
      </div>

      <div
        className={`mt-3 space-y-2 overflow-y-auto rounded-xl bg-slate-900/70 p-3 ${
          compact ? 'max-h-40' : 'max-h-52'
        }`}
      >
        {messages.map((chatMessage) => {
          const isMine = chatMessage.playerId === userId

          return (
            <div
              key={chatMessage.id}
              className={`rounded-xl px-3 py-2 text-sm ${
                isMine
                  ? 'ml-6 bg-cyan-950/70 text-cyan-50'
                  : 'mr-6 bg-slate-950 text-slate-200'
              }`}
            >
              <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-500">
                {chatMessage.playerName}
              </p>
              <p className="mt-1 break-words leading-snug">{chatMessage.message}</p>
            </div>
          )
        })}

        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet.</p>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, 240))}
          disabled={!canChat || !userId || sending}
          placeholder="message"
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300 disabled:opacity-60"
          maxLength={240}
        />
        <button
          type="submit"
          disabled={!canChat || !userId || sending || draft.trim().length === 0}
          className="rounded-xl border border-cyan-400/50 bg-cyan-950/70 px-3 py-2 text-sm font-black text-cyan-100 transition hover:border-cyan-200 disabled:border-slate-700 disabled:bg-slate-950 disabled:text-slate-600"
        >
          {sending ? '...' : 'Send'}
        </button>
      </form>

      {error ? <p className="mt-2 text-xs font-semibold text-rose-300">{error}</p> : null}
    </section>
  )
}

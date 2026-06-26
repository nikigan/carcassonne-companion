import type { ClientMessage, ServerMessage } from './protocol'

export type RoomStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

export interface RoomHandlers {
  onSnapshot: (msg: Extract<ServerMessage, { type: 'snapshot' }>) => void
  onAction: (msg: Extract<ServerMessage, { type: 'action' }>) => void
  onError?: (msg: Extract<ServerMessage, { type: 'error' }>) => void
  onStatus: (status: RoomStatus) => void
}

function wsUrl(code: string): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/api/room/${code}/ws`
}

export class RoomConnection {
  private ws: WebSocket | null = null
  private closed = false
  private backoff = 500
  private outbox: ClientMessage[] = []
  private code: string
  private handlers: RoomHandlers

  constructor(code: string, handlers: RoomHandlers) {
    this.code = code
    this.handlers = handlers
    this.handlers.onStatus('connecting')
    this.connect()
  }

  private connect() {
    if (this.closed) return
    const ws = new WebSocket(wsUrl(this.code))
    this.ws = ws
    ws.onopen = () => {
      this.backoff = 500
      this.handlers.onStatus('open')
      // Resend anything queued while disconnected; server dedupes by actionId.
      const pending = this.outbox
      this.outbox = []
      for (const m of pending) ws.send(JSON.stringify(m))
    }
    ws.onmessage = (e) => {
      let msg: ServerMessage
      try { msg = JSON.parse(e.data as string) as ServerMessage } catch { return }
      if (msg.type === 'snapshot') this.handlers.onSnapshot(msg)
      else if (msg.type === 'action') this.handlers.onAction(msg)
      else if (msg.type === 'error') this.handlers.onError?.(msg)
    }
    ws.onclose = () => {
      if (this.closed) return
      this.handlers.onStatus('reconnecting')
      setTimeout(() => this.connect(), this.backoff)
      this.backoff = Math.min(this.backoff * 2, 10000)
    }
    ws.onerror = () => ws.close()
  }

  /** Send now if open; otherwise queue for the next (re)connect. */
  send(msg: ClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg))
    else this.outbox.push(msg)
  }

  /**
   * Drop the current socket without setting `closed`, so `onclose` schedules
   * a reconnect (which requests a fresh snapshot from the server).
   */
  forceReconnect(): void {
    if (!this.closed) this.ws?.close()
  }

  close() {
    this.closed = true
    this.handlers.onStatus('closed')
    this.ws?.close()
  }
}

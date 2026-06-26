import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useI18n } from '../i18n'
import { roomPath } from '../game/protocol'

export function RoomPanel({ code, onClose, onLeave }: { code: string; onClose: () => void; onLeave: () => void }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const url = `${location.origin}${roomPath(code)}`

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-scrim/60 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-surface px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t.roomTitle}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-fg/50 hover:bg-overlay/10" aria-label={t.close}>✕</button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG value={url} size={180} level="M" marginSize={1} />
          </div>
          <p className="text-xs text-fg/50">{t.scanToJoin}</p>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-fg/50">{t.roomCode}</span>
            <div className="text-2xl font-mono font-bold tracking-widest">{code}</div>
          </div>
          <button onClick={copy} className="w-full rounded-xl bg-overlay/10 py-3 font-medium hover:bg-overlay/15">
            {copied ? t.linkCopied : t.copyLink}
          </button>
          <button
            onClick={() => { if (!window.confirm(t.confirmLeaveRoom)) return; onLeave() }}
            className="w-full rounded-xl py-3 font-medium text-red-400 hover:bg-overlay/10"
          >
            {t.leaveRoom}
          </button>
        </div>
      </div>
    </div>
  )
}

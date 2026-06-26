import { useEffect, useRef, useState } from 'react'
import QrScanner from 'qr-scanner'
import { roomCodeFromPath } from '../game/protocol'
import { useI18n } from '../i18n'

interface Props {
  /** Fired once with a validated 6-char room code. */
  onResult: (code: string) => void
  /** Close the sheet (cancel button, or after a successful result). */
  onClose: () => void
}

/**
 * Parse a scanned QR payload into a validated room code, or null.
 * Accepts a full URL (`https://host/r/ABC123`), a relative path (`/r/ABC123`),
 * or a bare code (`ABC123`) — all validated through `roomCodeFromPath`.
 */
function codeFromScan(value: string): string | null {
  const raw = value.trim()
  try {
    const fromUrl = roomCodeFromPath(new URL(raw).pathname)
    if (fromUrl) return fromUrl
  } catch {
    // not a URL — fall through to path/bare-code handling
  }
  return roomCodeFromPath(raw.startsWith('/') ? raw : `/r/${raw}`)
}

type ScanError = 'denied' | 'noCamera'

/**
 * Full-screen camera sheet that decodes a room QR and hands back the room code.
 * Owns the entire camera lifecycle; the stream is always stopped on unmount.
 */
export function QrScanModal({ onResult, onClose }: Props) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<ScanError | null>(null)
  const [sawInvalid, setSawInvalid] = useState(false)

  // Keep the latest callbacks in refs so the camera effect can run once and
  // never restarts when the parent passes fresh inline handlers.
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let scanner: QrScanner | null = null
    let cancelled = false
    let handled = false

    QrScanner.hasCamera()
      .then((has) => {
        if (cancelled) return
        if (!has) {
          setError('noCamera')
          return
        }
        scanner = new QrScanner(
          video,
          (result) => {
            if (handled) return
            const code = codeFromScan(result.data)
            if (!code) {
              setSawInvalid(true)
              return
            }
            handled = true
            scanner?.stop()
            onResultRef.current(code)
            onCloseRef.current()
          },
          {
            preferredCamera: 'environment',
            highlightScanRegion: true,
            maxScansPerSecond: 5,
            returnDetailedScanResult: true,
            onDecodeError: () => {
              // Frames without a QR fire this constantly; ignore them.
            },
          },
        )
        scanner.start().catch(() => {
          if (!cancelled) setError('denied')
        })
      })
      .catch(() => {
        if (!cancelled) setError('noCamera')
      })

    return () => {
      cancelled = true
      scanner?.destroy()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        playsInline
        muted
      />

      {/* Top bar: close button, honoring the safe-area inset. */}
      <div className="absolute inset-x-0 top-0 flex justify-end p-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-black/50 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-black/70"
        >
          {t.close}
        </button>
      </div>

      {/* Bottom hint / error, honoring the safe-area inset. */}
      <div className="absolute inset-x-0 bottom-0 p-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md rounded-xl bg-black/60 px-4 py-3 text-center text-sm font-medium text-white backdrop-blur">
          {error === 'denied' && t.scanCameraDenied}
          {error === 'noCamera' && t.scanNoCamera}
          {!error && (sawInvalid ? t.scanInvalidQr : t.scanQrHint)}
        </div>
      </div>
    </div>
  )
}

import { updateSnippet } from '@/lib/api'
import { API_BASE } from '@/lib/api'

type Pending = { content: string; kind?: string }

class SaveQueue {
  private pending: Map<string, Pending> = new Map()
  private timer: ReturnType<typeof setTimeout> | null = null
  private inFlight = false

  queue(id: string, content: string, kind?: string) {
    this.pending.set(id, { content, kind })
    this.schedule()
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.flush(), 400)
  }

  async flush(opts?: { keepalive?: boolean }) {
    if (this.inFlight) return
    this.inFlight = true
    try {
      const entries = Array.from(this.pending.entries())
      this.pending.clear()
      for (const [id, { content, kind }] of entries) {
        // Attempt keepalive fetch first for unload-safe delivery
        if (opts?.keepalive && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
          try {
            const url = `${API_BASE}/api/snippets/${encodeURIComponent(id)}`
            const blob = new Blob([JSON.stringify({ content, kind })], { type: 'application/json' })
            const ok = (navigator as any).sendBeacon(url, blob)
            if (ok) continue
          } catch {
            // fall through to fetch/axios
          }
        }
        if (opts?.keepalive) {
          try {
            await fetch(`${API_BASE}/api/snippets/${encodeURIComponent(id)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content, kind }),
              keepalive: true,
              mode: 'cors',
              credentials: 'omit',
            })
            continue
          } catch {
            // fall through to axios
          }
        }
        await updateSnippet(id, { content, kind })
      }
    } finally {
      this.inFlight = false
    }
  }
}

export const saveQueue = new SaveQueue()


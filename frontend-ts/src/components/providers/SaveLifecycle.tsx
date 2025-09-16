'use client'

import { useEffect } from 'react'
import { saveQueue } from '@/lib/saveQueue'

export function SaveLifecycle() {
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void saveQueue.flush({ keepalive: true })
      }
    }
    const onPageHide = () => {
      void saveQueue.flush({ keepalive: true })
    }
    const onBeforeUnload = () => {
      void saveQueue.flush({ keepalive: true })
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])
  return null
}


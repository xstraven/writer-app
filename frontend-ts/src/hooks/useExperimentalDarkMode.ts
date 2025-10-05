'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'

export function useExperimentalDarkMode() {
  const darkModeEnabled = useAppStore((state) => state.experimental?.dark_mode)

  useEffect(() => {
    const root = typeof document !== 'undefined' ? document.documentElement : null
    if (!root) return
    if (darkModeEnabled) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [darkModeEnabled])
}

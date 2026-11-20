import { useEffect } from 'react'

const scrollKeys = new Set([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'])

/** Smooths intentional in-page navigation while leaving wheel and touch scrolling native. */
export function useAnchorScroll() {
  useEffect(() => {
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motionPreference.matches) return

    let frame = 0
    let originalScrollBehavior = ''
    let usingCustomScroll = false
    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame)
      frame = 0
      if (usingCustomScroll) {
        document.documentElement.style.scrollBehavior = originalScrollBehavior
        usingCustomScroll = false
      }
    }

    const interrupt = () => stop()
    const onKeyDown = (event: KeyboardEvent) => {
      if (scrollKeys.has(event.key)) stop()
    }

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest<HTMLAnchorElement>('a[href^="#"]')
      if (!anchor || anchor.target === '_blank') return
      const id = decodeURIComponent(anchor.hash.slice(1))
      const destination = document.getElementById(id)
      if (!destination) return

      event.preventDefault()
      stop()
      if (window.location.hash !== anchor.hash) window.history.pushState(null, '', anchor.hash)

      if (event.detail === 0) {
        const hadTabIndex = destination.hasAttribute('tabindex')
        if (!hadTabIndex) destination.setAttribute('tabindex', '-1')
        destination.focus({ preventScroll: true })
        if (!hadTabIndex) destination.addEventListener('blur', () => destination.removeAttribute('tabindex'), { once: true })
      }

      const startY = window.scrollY
      const endY = id === 'top' ? 0 : Math.max(0, destination.getBoundingClientRect().top + startY)
      const distance = endY - startY
      const duration = Math.min(1250, Math.max(620, Math.abs(distance) * 0.38))
      originalScrollBehavior = document.documentElement.style.scrollBehavior
      document.documentElement.style.scrollBehavior = 'auto'
      usingCustomScroll = true
      let startTime = 0

      const step = (time: number) => {
        if (!startTime) startTime = time
        const progress = Math.min(1, (time - startTime) / duration)
        const eased = progress < 0.5
          ? 16 * progress ** 5
          : 1 - ((-2 * progress + 2) ** 5) / 2
        window.scrollTo(0, startY + distance * eased)
        if (progress < 1) frame = window.requestAnimationFrame(step)
        else stop()
      }

      frame = window.requestAnimationFrame(step)
    }

    document.addEventListener('click', onClick)
    window.addEventListener('wheel', interrupt, { passive: true })
    window.addEventListener('touchstart', interrupt, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      stop()
      document.removeEventListener('click', onClick)
      window.removeEventListener('wheel', interrupt)
      window.removeEventListener('touchstart', interrupt)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])
}

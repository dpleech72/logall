import { useState, useEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'

const THRESHOLD = 80 // px of pull needed to trigger refresh

export default function PullToRefresh() {
  const [pullY, setPullY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const startY = useRef(0)
  const distRef = useRef(0)
  const active = useRef(false)

  useEffect(() => {
    function scrollTop() {
      const main = document.querySelector('main')
      return main ? main.scrollTop : window.scrollY
    }

    function onTouchStart(e) {
      if (scrollTop() > 0) return
      startY.current = e.touches[0].clientY
      active.current = true
    }

    function onTouchMove(e) {
      if (!active.current) return
      if (scrollTop() > 0) {
        active.current = false
        distRef.current = 0
        setPullY(0)
        return
      }
      const dist = Math.max(0, e.touches[0].clientY - startY.current)
      distRef.current = dist
      // Dampen the pull so it feels springy
      setPullY(Math.min(dist * 0.5, THRESHOLD * 0.8))
      if (dist > 8) e.preventDefault()
    }

    function onTouchEnd() {
      if (!active.current) return
      active.current = false
      if (distRef.current >= THRESHOLD) {
        setRefreshing(true)
        setPullY(36)
        setTimeout(() => window.location.reload(), 500)
      } else {
        setPullY(0)
      }
      distRef.current = 0
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  if (pullY === 0 && !refreshing) return null

  const ready = distRef.current >= THRESHOLD || refreshing

  return (
    <div
      className="fixed left-0 right-0 top-0 z-50 flex justify-center pointer-events-none"
      style={{
        transform: `translateY(${pullY - 8}px)`,
        transition: refreshing ? 'none' : 'transform 0.1s ease-out',
      }}
    >
      <div className={`w-9 h-9 bg-white rounded-full shadow-lg flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
        <RefreshCw
          size={16}
          className={ready ? 'text-green-600' : 'text-gray-400'}
          style={refreshing ? {} : { transform: `rotate(${Math.min((distRef.current / THRESHOLD) * 360, 360)}deg)` }}
        />
      </div>
    </div>
  )
}

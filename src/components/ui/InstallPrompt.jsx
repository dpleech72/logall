import { useState, useEffect } from 'react'
import { X, Share } from 'lucide-react'

function isInstalled() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function wasDismissedRecently() {
  const stored = localStorage.getItem('logall_install_dismissed')
  if (!stored) return false
  const days = (Date.now() - new Date(stored).getTime()) / (1000 * 60 * 60 * 24)
  return days < 7
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showAndroid, setShowAndroid] = useState(false)
  const [showIOS, setShowIOS] = useState(false)

  useEffect(() => {
    if (isInstalled() || wasDismissedRecently()) return

    // Android / Chrome — capture the browser's install prompt
    const onBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowAndroid(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    const onInstalled = () => { setShowAndroid(false); setDeferredPrompt(null) }
    window.addEventListener('appinstalled', onInstalled)

    // iOS Safari — no beforeinstallprompt, show manual instructions
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    if (isIOS && isSafari && !window.navigator.standalone) {
      const t = setTimeout(() => setShowIOS(true), 4000)
      return () => {
        clearTimeout(t)
        window.removeEventListener('beforeinstallprompt', onBeforeInstall)
        window.removeEventListener('appinstalled', onInstalled)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  function dismiss() {
    setShowAndroid(false)
    setShowIOS(false)
    localStorage.setItem('logall_install_dismissed', new Date().toISOString())
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShowAndroid(false)
    setDeferredPrompt(null)
  }

  if (!showAndroid && !showIOS) return null

  return (
    <div
      className="fixed left-4 right-4 z-40 bg-gray-900 text-white rounded-2xl p-4 shadow-2xl"
      style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
    >
      {showAndroid && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white dark:bg-gray-800 border-2 border-green-600 rounded-xl flex items-center justify-center flex-shrink-0 text-green-600 font-bold text-sm">
            LA
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Install LogAll</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Add to your home screen for quick access</p>
          </div>
          <button
            onClick={handleInstall}
            className="bg-green-600 text-white font-semibold px-3 py-1.5 rounded-lg text-xs active:bg-green-700 flex-shrink-0"
          >
            Install
          </button>
          <button onClick={dismiss} className="text-gray-400 dark:text-gray-500 active:text-white flex-shrink-0 p-1">
            <X size={16} />
          </button>
        </div>
      )}

      {showIOS && (
        <>
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                L
              </div>
              <p className="font-semibold text-sm">Install LogAll</p>
            </div>
            <button onClick={dismiss} className="text-gray-400 dark:text-gray-500 active:text-white p-1 -mt-0.5">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            Tap the{' '}
            <span className="inline-flex items-center gap-1 bg-gray-700 px-1.5 py-0.5 rounded font-medium mx-0.5">
              <Share size={10} />
              Share
            </span>
            {' '}button then tap{' '}
            <span className="font-semibold text-white">Add to Home Screen</span>
            {' '}to install LogAll as an app.
          </p>
        </>
      )}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { Camera, X, ExternalLink, Loader2 } from 'lucide-react'
import { compressImage, formatBytes } from '../../lib/imageCompress'
import { uploadToGoogleDrive } from '../../lib/cloudStorage'

/**
 * ReceiptUpload
 *
 * Props:
 *   value       {string|null}   – current receipt URL (if already uploaded)
 *   onChange    {fn(url|null)}  – called with the uploaded URL or null on remove
 */
export default function ReceiptUpload({ value, onChange }) {
  const fileInputRef = useRef(null)
  const [phase, setPhase]             = useState('idle')
  const [preview, setPreview]         = useState(null)
  const [compressed, setCompressed]   = useState(null)
  const [uploadedUrl, setUploadedUrl] = useState(value || null)
  const [error, setError]             = useState('')

  // Sync when an existing receipt_url is loaded into the form (e.g. editing an expense)
  useEffect(() => {
    if (value && value !== uploadedUrl) {
      setUploadedUrl(value)
      setPhase('idle')
    }
  }, [value])

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setPhase('compressing')

    try {
      const originalSize = file.size
      const blob = await compressImage(file)
      const objectUrl = URL.createObjectURL(blob)
      setPreview(objectUrl)
      setCompressed({ blob, originalSize, compressedSize: blob.size })
      setPhase('uploading')

      const filename = `receipt_${Date.now()}.jpg`
      const url = await uploadToGoogleDrive(blob, filename)
      setUploadedUrl(url)
      setPhase('done')
      onChange(url)
    } catch (err) {
      setError(err.message)
      setPhase('idle')
    }

    e.target.value = ''
  }

  function handleRemove() {
    if (preview) { URL.revokeObjectURL(preview); setPreview(null) }
    setCompressed(null)
    setUploadedUrl(null)
    setPhase('idle')
    setError('')
    onChange(null)
  }

  // ── Already uploaded ─────────────────────────────────────────
  if (uploadedUrl && (phase === 'done' || phase === 'idle')) {
    return (
      <div className="rounded-xl border-2 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 p-3 space-y-2">
        <div className="flex items-center gap-3">
          {preview ? (
            <img src={preview} alt="Receipt" className="w-12 h-12 object-cover rounded-lg flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-800 flex items-center justify-center flex-shrink-0 text-xl">🧾</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800 dark:text-green-200">Receipt saved</p>
            <p className="text-xs text-green-600 dark:text-green-400">Google Drive</p>
          </div>
          <button type="button" onClick={handleRemove} className="p-2 text-gray-400 active:opacity-70 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
        <a
          href={uploadedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 text-xs font-semibold active:opacity-70"
        >
          <ExternalLink size={13} />
          View receipt in Google Drive
        </a>
      </div>
    )
  }

  // ── Compressing / uploading spinner ──────────────────────────
  if (phase === 'compressing' || phase === 'uploading') {
    return (
      <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 flex items-center gap-3">
        <Loader2 size={20} className="animate-spin text-blue-400 flex-shrink-0" />
        <div>
          <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
            {phase === 'compressing' ? 'Compressing image…' : 'Uploading to Google Drive…'}
          </p>
          {phase === 'uploading' && compressed && (
            <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">
              {formatBytes(compressed.compressedSize)} · {Math.round((1 - compressed.compressedSize / compressed.originalSize) * 100)}% smaller
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Idle ──────────────────────────────────────────────────────
  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-green-400 hover:text-green-600 active:bg-gray-50 transition-colors text-sm font-medium"
      >
        <Camera size={17} />
        Add receipt photo
      </button>
      {error && (
        <p className="mt-1.5 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">{error}</p>
      )}
    </div>
  )
}

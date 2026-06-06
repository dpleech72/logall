/**
 * Compress an image File/Blob using the Canvas API.
 *
 * @param {File|Blob} file       - The source image.
 * @param {object}    [options]
 * @param {number}    [options.maxDimension=1200] - Largest side in pixels.
 * @param {number}    [options.quality=0.72]      - JPEG quality 0–1.
 * @returns {Promise<Blob>} Compressed JPEG blob.
 */
export async function compressImage(file, { maxDimension = 1200, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      // Calculate scaled dimensions, preserving aspect ratio
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
      const w = Math.round(img.width  * scale)
      const h = Math.round(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h

      const ctx = canvas.getContext('2d')
      // White background so transparent PNGs compress well as JPEG
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)

      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null')),
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image for compression'))
    }

    img.src = objectUrl
  })
}

/** Human-readable file size, e.g. "142 KB" */
export function formatBytes(bytes) {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

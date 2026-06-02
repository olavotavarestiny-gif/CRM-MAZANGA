/**
 * Returns a browser-safe URL for a blob.
 * Private Vercel Blob URLs (*.private.blob.vercel-storage.com) cannot be loaded
 * directly in <img> tags — they need the Authorization header which browsers
 * never send. This function routes them through the /api/blob proxy.
 */
export function blobSrc(url: string | undefined | null): string {
  if (!url) return '';
  if (url.includes('.private.blob.vercel-storage.com')) {
    return `/api/blob?url=${encodeURIComponent(url)}`;
  }
  return url;
}

/**
 * Formats a byte count into a human-readable string.
 * Example: 1536000 → "1.5 MB"
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[i]}`;
}

/**
 * Returns the lowercase extension of a filename (without the dot).
 * Example: "documento.PDF" → "pdf"
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Returns true if the MIME type is an image.
 */
export function isImageFile(contentType: string): boolean {
  return contentType.startsWith('image/');
}

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;

/**
 * Compresses an image File using the Canvas API.
 * - Tries ALL image/* types including HEIC/HEIF (supported on Safari + Chrome 117+).
 * - Falls back silently to the original if the browser cannot decode the format.
 * - Resizes so the longest side is at most MAX_DIMENSION px.
 * - Re-encodes as JPEG at JPEG_QUALITY.
 * - Returns the original file if compression yields a larger result or fails.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Already tiny — skip re-encoding overhead
      if (width <= MAX_DIMENSION && height <= MAX_DIMENSION && file.size < 300 * 1024) {
        resolve(file);
        return;
      }

      if (width > height && width > MAX_DIMENSION) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      } else if (height >= width && height > MAX_DIMENSION) {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const compressed = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
          resolve(compressed.size < file.size ? compressed : file);
        },
        'image/jpeg',
        JPEG_QUALITY,
      );
    };

    // Browser cannot decode this format (e.g. HEIC on Firefox) — upload as-is
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/**
 * Removes dangerous characters from a filename.
 * Spaces and hyphens become underscores; only alphanumeric, dots, and underscores are kept.
 * Example: "Meu Ficheiro (1).pdf" → "Meu_Ficheiro_1_.pdf"
 */
export function sanitizeFilename(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  const name = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.slice(lastDot) : '';
  const sanitized = name
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '');
  return sanitized + ext.toLowerCase();
}

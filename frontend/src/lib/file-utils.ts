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

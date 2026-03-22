import { put, del, list } from '@vercel/blob';
import { sanitizeFilename } from './file-utils';

export type UploadFolder = 'avatars' | 'attachments' | 'invoices';

export interface UploadResult {
  url: string;
  pathname: string;
  size: number;
  contentType: string;
}

export interface StoredFile {
  url: string;
  size: number;
  uploadedAt: Date;
}

/**
 * Uploads a File to Vercel Blob under the given folder.
 * Generates a unique name: {folder}/{timestamp}-{sanitizedFilename}
 */
export async function uploadFile(
  file: File,
  folder: UploadFolder
): Promise<UploadResult> {
  const sanitized = sanitizeFilename(file.name);
  const pathname = `${folder}/${Date.now()}-${sanitized}`;

  const blob = await put(pathname, file, {
    access: 'public',
    contentType: file.type,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    size: file.size,
    contentType: file.type,
  };
}

/**
 * Deletes a file from Vercel Blob by its URL.
 * Returns true on success, false if the deletion fails.
 */
export async function deleteFile(url: string): Promise<boolean> {
  try {
    await del(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lists all files stored under a given folder prefix.
 */
export async function listFiles(folder: UploadFolder): Promise<StoredFile[]> {
  const { blobs } = await list({ prefix: `${folder}/` });
  return blobs.map((b) => ({
    url: b.url,
    size: b.size,
    uploadedAt: new Date(b.uploadedAt),
  }));
}

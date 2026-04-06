const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const requireAuth = require('../middleware/auth');

const router = express.Router();

const VALID_FOLDERS = ['avatars', 'attachments', 'invoices'];
const MAX_SIZES = {
  avatars: 2 * 1024 * 1024,
  attachments: 10 * 1024 * 1024,
  invoices: 5 * 1024 * 1024,
};
const ALLOWED_TYPES = {
  avatars: ['image/jpeg', 'image/png', 'image/webp'],
  attachments: [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  invoices: ['application/pdf'],
};

const STORAGE_BUCKET = 'kukugest-files';
let _supabaseAdmin = null;
let _bucketEnsured = false;

function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  return _supabaseAdmin;
}

function sanitizeFilename(filename) {
  const lastDot = filename.lastIndexOf('.');
  const name = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.slice(lastDot) : '';
  const sanitized = name
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '');

  return `${sanitized}${ext.toLowerCase()}` || `file_${Date.now()}`;
}

async function ensureBucketExists() {
  if (_bucketEnsured) return;

  const { error } = await getSupabaseAdmin().storage.createBucket(STORAGE_BUCKET, {
    public: true,
    fileSizeLimit: '10MB',
  });

  if (error && !/already exists|duplicate/i.test(error.message || '')) {
    throw error;
  }

  _bucketEnsured = true;
}

router.post(
  '/',
  requireAuth,
  express.raw({ type: '*/*', limit: '15mb' }),
  async (req, res) => {
    try {
      const folder = String(req.headers['x-upload-folder'] || '');
      const fileNameHeader = String(req.headers['x-file-name'] || '');
      const fileType = String(req.headers['x-file-type'] || 'application/octet-stream');

      if (!VALID_FOLDERS.includes(folder)) {
        return res.status(400).json({ error: 'Pasta de upload inválida.' });
      }

      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      if (!buffer.length) {
        return res.status(400).json({ error: 'Ficheiro vazio.' });
      }

      if (buffer.length > MAX_SIZES[folder]) {
        return res.status(413).json({ error: 'Ficheiro demasiado grande.' });
      }

      if (!ALLOWED_TYPES[folder].includes(fileType)) {
        return res.status(400).json({ error: 'Tipo de ficheiro não permitido.' });
      }

      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(503).json({ error: 'Storage não configurado no backend.' });
      }

      await ensureBucketExists();

      const decodedName = fileNameHeader ? decodeURIComponent(fileNameHeader) : 'ficheiro';
      const sanitizedName = sanitizeFilename(decodedName);
      const pathname = `${folder}/${req.user.effectiveUserId}/${Date.now()}-${sanitizedName}`;

      const { error } = await getSupabaseAdmin().storage
        .from(STORAGE_BUCKET)
        .upload(pathname, buffer, {
          contentType: fileType,
          upsert: false,
        });

      if (error) {
        console.error('[uploads] Supabase upload error:', error);
        return res.status(500).json({ error: 'Não foi possível gravar o ficheiro no storage.' });
      }

      const { data } = getSupabaseAdmin().storage.from(STORAGE_BUCKET).getPublicUrl(pathname);

      return res.json({
        url: data.publicUrl,
        pathname,
        size: buffer.length,
        contentType: fileType,
      });
    } catch (error) {
      console.error('[uploads] Route error:', error);
      return res.status(500).json({ error: 'Falha inesperada no upload.' });
    }
  }
);

module.exports = router;

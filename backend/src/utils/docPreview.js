const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');

const getMimeType = (filePath = '') => {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
};

const getDocumentBuffer = async (fileUrl) => {
  const bucketName = process.env.BUCKET_NAME || process.env.BUCKET;
  if (bucketName) {
    const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region: process.env.REGION || 'us-east-1',
      endpoint: process.env.ENDPOINT,
      credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });

    const urlObj = new URL(fileUrl);
    let key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
    if (bucketName && key.startsWith(`${bucketName}/`)) {
      key = key.substring(bucketName.length + 1);
    }
    if (key.startsWith('uploads/')) {
      key = key.substring('uploads/'.length);
    }

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: decodeURIComponent(key)
    });

    const s3Response = await s3.send(command);
    if (s3Response.Body && s3Response.Body.transformToByteArray) {
      const bytes = await s3Response.Body.transformToByteArray();
      return Buffer.from(bytes);
    }
    return new Promise((resolve, reject) => {
      const chunks = [];
      s3Response.Body.on('data', chunk => chunks.push(chunk));
      s3Response.Body.on('error', reject);
      s3Response.Body.on('end', () => resolve(Buffer.concat(chunks)));
    });
  } else {
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    let relativePath = fileUrl.replace(baseUrl, '');
    if (relativePath.startsWith('/uploads/')) {
      relativePath = relativePath.substring('/uploads/'.length);
    } else if (relativePath.startsWith('uploads/')) {
      relativePath = relativePath.substring('uploads/'.length);
    }
    const localPath = path.join(__dirname, '../../uploads', relativePath);
    if (!fs.existsSync(localPath)) {
      throw new Error(`Archivo no encontrado: ${localPath}`);
    }
    return fs.readFileSync(localPath);
  }
};

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const convertDocToHtml = async (buffer, filename = '') => {
  const lower = filename.toLowerCase();

  // Try mammoth for .docx files
  if (lower.endsWith('.docx')) {
    try {
      const result = await mammoth.convertToHtml({ buffer });
      if (result.value && result.value.trim()) {
        return {
          type: 'docx',
          html: result.value
        };
      }
    } catch (err) {
      console.warn('Mammoth conversion warning, falling back to WordExtractor:', err.message);
    }
  }

  // Use WordExtractor for .doc or fallback
  try {
    const extractor = new WordExtractor();
    const doc = await extractor.extract(buffer);
    const body = doc.getBody() || '';
    const headers = doc.getHeaders() || '';
    const footers = doc.getFooters() || '';

    const paragraphs = body
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => `<p style="margin: 0 0 1em 0; line-height: 1.6; color: #2d3748;">${escapeHtml(line)}</p>`)
      .join('');

    let fullHtml = '';
    if (headers && headers.trim()) {
      fullHtml += `<div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; font-size: 0.85em; color: #718096;">${escapeHtml(headers.trim())}</div>`;
    }
    fullHtml += paragraphs || '<p style="color: #718096; font-style: italic;">Documento sin contenido de texto identificable.</p>';
    if (footers && footers.trim()) {
      fullHtml += `<div style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 16px; font-size: 0.85em; color: #718096;">${escapeHtml(footers.trim())}</div>`;
    }

    return {
      type: 'doc',
      html: fullHtml
    };
  } catch (err) {
    console.error('WordExtractor conversion error:', err);
    throw new Error('No se pudo extraer el contenido del documento.');
  }
};

module.exports = {
  getMimeType,
  getDocumentBuffer,
  convertDocToHtml
};

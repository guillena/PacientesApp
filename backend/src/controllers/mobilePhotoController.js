const jwt = require('jsonwebtoken');
const { Professional, ProfessionalDocument, ProfDocType } = require('../models');
const path = require('path');

// In-memory set to track used tokens (single-use per session, cleared on restart)
// Tokens already have 15min TTL via JWT exp, this prevents replay within that window
const usedTokens = new Set();

/**
 * POST /api/professionals/:professionalId/photo-token
 * Generates a temporary JWT token for mobile photo upload (15 min TTL)
 */
const generatePhotoToken = async (req, res) => {
  try {
    const { professionalId } = req.params;
    const prof = await Professional.findByPk(professionalId);
    if (!prof) return res.status(404).send({ error: 'Profesional no encontrado' });

    const token = jwt.sign(
      { photoUpload: true, professionalId: parseInt(professionalId), username: prof.username },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Use BACKEND_URL env var (set on Railway), or derive from the request host for local dev.
    // If the host is localhost, auto-detect the local network IP so the QR works on mobile.
    let protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    let host = req.headers.host || 'localhost:5000';
    if (process.env.BACKEND_URL) {
      host = process.env.BACKEND_URL.replace(/^https?:\/\//, '');
      protocol = process.env.BACKEND_URL.startsWith('https') ? 'https' : 'http';
    } else if (host.startsWith('localhost') || host.startsWith('127.')) {
      // In local dev: try to find the WiFi/LAN IP so phone can scan the QR
      const os = require('os');
      const nets = os.networkInterfaces();
      let localIp = null;
      for (const name of Object.keys(nets)) {
        for (const iface of nets[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            // Prefer WiFi addresses (192.168.x.x or 10.x.x.x)
            if (!localIp || iface.address.startsWith('192.168') || iface.address.startsWith('10.')) {
              localIp = iface.address;
            }
          }
        }
      }
      if (localIp) {
        const port = host.includes(':') ? host.split(':')[1] : '5000';
        host = `${localIp}:${port}`;
      }
    }
    const mobileUrl = `${protocol}://${host}/mobile-photo?token=${token}`;

    res.send({ token, url: mobileUrl });
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

/**
 * GET /mobile-photo
 * Serves the mobile HTML camera page (validates token via query param)
 */
const serveMobilePage = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('<h2>Token requerido</h2>');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.photoUpload) throw new Error('Token inválido');
  } catch (e) {
    return res.status(401).send('<h2>El enlace expiró o es inválido. Pedí un nuevo QR.</h2>');
  }

  const prof = await Professional.findByPk(decoded.professionalId);
  const profName = prof ? `${prof.firstName} ${prof.lastName}` : 'Profesional';

  // Use relative URL so it works on any host (localhost or Railway)
  const uploadUrl = `/mobile-photo/upload?token=${encodeURIComponent(token)}`;

  // Serve a self-contained HTML page — no React, pure HTML/CSS/JS
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>Subir Foto – ${profName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    header {
      width: 100%;
      padding: 16px 20px;
      background: #1e293b;
      text-align: center;
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #94a3b8;
    }
    header span { color: #38bdf8; }
    #main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 20px;
      gap: 20px;
    }
    #preview-wrap {
      position: relative;
      width: 100%;
      max-width: 420px;
      border-radius: 16px;
      overflow: hidden;
      background: #1e293b;
      aspect-ratio: 4/3;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #video, #canvas {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 16px;
    }
    #canvas { display: none; position: absolute; inset: 0; }
    #photo-preview {
      display: none;
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 16px;
      position: absolute;
      inset: 0;
    }
    .controls {
      display: flex;
      gap: 20px;
      align-items: center;
      justify-content: center;
    }
    #capture-btn {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: white;
      border: 5px solid #38bdf8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 24px rgba(56,189,248,0.4);
      transition: transform 0.1s, box-shadow 0.1s;
      flex-shrink: 0;
    }
    #capture-btn:active { transform: scale(0.92); box-shadow: 0 2px 12px rgba(56,189,248,0.3); }
    #capture-btn .inner {
      width: 52px;
      height: 52px;
      background: #38bdf8;
      border-radius: 50%;
    }
    #retake-btn, #upload-btn, #close-btn {
      padding: 12px 24px;
      border-radius: 50px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: opacity 0.2s;
    }
    #retake-btn { background: #334155; color: #f1f5f9; display: none; }
    #upload-btn { background: #22c55e; color: white; display: none; }
    #close-btn {
      background: #ef4444;
      color: white;
      width: 100%;
      max-width: 420px;
    }
    #status {
      font-size: 0.9rem;
      color: #94a3b8;
      text-align: center;
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #status.success { color: #4ade80; font-weight: 600; font-size: 1.05rem; }
    #status.error { color: #f87171; }
    .spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid rgba(148,163,184,0.3);
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <header>Subir foto para <span>${profName}</span></header>
  <div id="main">
    <div id="preview-wrap">
      <video id="video" autoplay playsinline muted></video>
      <canvas id="canvas"></canvas>
      <img id="photo-preview" alt="Foto tomada" />
    </div>
    <div class="controls">
      <button id="capture-btn" title="Tomar foto"><div class="inner"></div></button>
      <button id="retake-btn">↩ Retomar</button>
      <button id="upload-btn">✓ Subir</button>
    </div>
    <div id="status">Apuntá la cámara y presioná el botón.</div>
    <button id="close-btn" onclick="window.close(); history.go(-1);">Cerrar</button>
  </div>

  <script>
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const photoPreview = document.getElementById('photo-preview');
    const captureBtn = document.getElementById('capture-btn');
    const retakeBtn = document.getElementById('retake-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const status = document.getElementById('status');
    let capturedBlob = null;

    // Start camera
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false
        });
        video.srcObject = stream;
      } catch (err) {
        status.textContent = 'No se pudo acceder a la cámara: ' + err.message;
        status.className = 'error';
      }
    }

    function showCamera() {
      video.style.display = 'block';
      photoPreview.style.display = 'none';
      captureBtn.style.display = 'flex';
      retakeBtn.style.display = 'none';
      uploadBtn.style.display = 'none';
      capturedBlob = null;
      status.textContent = 'Apuntá la cámara y presioná el botón.';
      status.className = '';
    }

    captureBtn.addEventListener('click', () => {
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 960;
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(video, 0, 0, w, h);
      canvas.toBlob(blob => {
        capturedBlob = blob;
        const url = URL.createObjectURL(blob);
        photoPreview.src = url;
        photoPreview.style.display = 'block';
        video.style.display = 'none';
        captureBtn.style.display = 'none';
        retakeBtn.style.display = 'flex';
        uploadBtn.style.display = 'flex';
        status.textContent = '¿Se ve bien? Podés retomar o subir la foto.';
      }, 'image/jpeg', 0.92);
    });

    retakeBtn.addEventListener('click', showCamera);

    uploadBtn.addEventListener('click', async () => {
      if (!capturedBlob) return;
      uploadBtn.disabled = true;
      retakeBtn.disabled = true;
      status.innerHTML = '<span class="spinner"></span>Subiendo...';
      status.className = '';

      const formData = new FormData();
      const filename = 'foto_' + Date.now() + '.jpg';
      formData.append('file', capturedBlob, filename);

      try {
        const res = await fetch('${uploadUrl}', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (res.ok) {
          status.textContent = '✓ Foto subida correctamente.';
          status.className = 'success';
          photoPreview.style.opacity = '0.5';
          uploadBtn.style.display = 'none';
          retakeBtn.textContent = '+ Subir otra';
          retakeBtn.disabled = false;
        } else {
          throw new Error(data.error || 'Error al subir');
        }
      } catch (err) {
        status.textContent = 'Error: ' + err.message;
        status.className = 'error';
        uploadBtn.disabled = false;
        retakeBtn.disabled = false;
      }
    });

    startCamera();
  </script>
</body>
</html>`);
};

/**
 * POST /mobile-photo/upload
 * Receives the photo, validates the temp token, saves to S3 / local storage
 */
const handleMobilePhotoUpload = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send({ error: 'Token requerido' });

    // Check if token was already used
    if (usedTokens.has(token)) {
      return res.status(401).send({ error: 'Este enlace ya fue utilizado. Pedí un nuevo QR.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded.photoUpload) throw new Error('Token inválido');
    } catch (e) {
      return res.status(401).send({ error: 'El enlace expiró o es inválido.' });
    }

    if (!req.file) {
      return res.status(400).send({ error: 'No se recibió ningún archivo' });
    }

    const { professionalId, username } = decoded;
    const prof = await Professional.findByPk(professionalId);
    if (!prof) return res.status(404).send({ error: 'Profesional no encontrado' });

    const folderName = username || prof.username;
    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    const fileUrl = req.file.location || `${baseUrl}/uploads/profesionales/${folderName}/${req.file.filename}`;

    // Fix filename encoding
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    // Find or create a "Foto" doc type for mobile uploads
    let [photoDocType] = await ProfDocType.findOrCreate({
      where: { name: 'Foto' },
      defaults: { name: 'Foto', description: 'Foto tomada desde celular', status: true }
    });

    // Create document record
    const doc = await ProfessionalDocument.create({
      professionalId,
      profDocTypeId: photoDocType.id,
      fileUrl,
      originalName
    });

    const fullDoc = await ProfessionalDocument.findByPk(doc.id, { include: [ProfDocType] });

    // Mark token as used
    usedTokens.add(token);
    // Clean up old tokens from memory after 15 min
    setTimeout(() => usedTokens.delete(token), 15 * 60 * 1000);

    res.status(201).send(fullDoc);
  } catch (e) {
    console.error('Mobile photo upload error:', e);
    res.status(500).send({ error: e.message });
  }
};

module.exports = { generatePhotoToken, serveMobilePage, handleMobilePhotoUpload };

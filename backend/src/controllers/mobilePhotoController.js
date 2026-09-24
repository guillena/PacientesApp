const jwt = require('jsonwebtoken');
const { Professional, ProfessionalDocument, ProfDocType, Patient, PatientDocument } = require('../models');


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
      { photoUpload: true, professionalId: professionalId, username: prof.username },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Use BACKEND_URL (Railway) or auto-detect LAN IP for local dev
    let protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    let host = req.headers.host || 'localhost:5000';

    if (process.env.BACKEND_URL) {
      host = process.env.BACKEND_URL.replace(/^https?:\/\//, '');
      protocol = process.env.BACKEND_URL.startsWith('https') ? 'https' : 'http';
    } else if (host.startsWith('localhost') || host.startsWith('127.')) {
      // In local dev: find WiFi/LAN IP so phone can scan the QR on the same network
      const os = require('os');
      const nets = os.networkInterfaces();
      let localIp = null;
      for (const name of Object.keys(nets)) {
        for (const iface of nets[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
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
 * Serves the mobile HTML camera page.
 * Uses <input type="file" capture="environment"> â€” works on HTTP AND HTTPS.
 * (getUserMedia requires HTTPS/secure context; file input capture does NOT)
 */
const serveMobilePage = async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('<h2 style="font-family:sans-serif;padding:2rem">Token requerido</h2>');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.photoUpload) throw new Error('Token invÃ¡lido');
  } catch (e) {
    return res.status(401).send('<h2 style="font-family:sans-serif;padding:2rem;color:#e74c3c">El enlace expirÃ³ o es invÃ¡lido. PedÃ­ un nuevo QR.</h2>');
  }

  // Determine entity name and upload URL based on entityType
  let entityName;
  let uploadUrl;
  if (decoded.entityType === 'patient') {
    entityName = decoded.patientName || 'Paciente';
    uploadUrl = `/mobile-photo/upload-patient?token=${encodeURIComponent(token)}`;
  } else {
    const prof = await Professional.findByPk(decoded.professionalId);
    entityName = prof ? `${prof.firstName} ${prof.lastName}` : 'Profesional';
    uploadUrl = `/mobile-photo/upload?token=${encodeURIComponent(token)}`;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Subir Foto â€“ ${entityName}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #f1f5f9;
      min-height: 100dvh;
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
      padding: 24px 20px;
      gap: 20px;
    }
    #preview-wrap {
      width: 100%;
      max-width: 420px;
      border-radius: 16px;
      overflow: hidden;
      background: #1e293b;
      aspect-ratio: 4/3;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px dashed #334155;
    }
    #preview-wrap.has-photo { border-style: solid; border-color: #38bdf8; }
    #photo-preview { width: 100%; height: 100%; object-fit: cover; display: none; }
    #placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: #475569;
      font-size: 0.9rem;
      text-align: center;
      padding: 16px;
    }
    #file-input { display: none; }
    #camera-btn {
      width: 80px; height: 80px;
      border-radius: 50%;
      background: white;
      border: 5px solid #38bdf8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 24px rgba(56,189,248,0.45);
      transition: transform 0.12s, box-shadow 0.12s;
      flex-shrink: 0;
    }
    #camera-btn:active { transform: scale(0.91); }
    #camera-btn .inner {
      width: 58px; height: 58px;
      background: #38bdf8;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .controls { display: flex; gap: 16px; align-items: center; justify-content: center; flex-wrap: wrap; }
    .btn {
      padding: 13px 28px;
      border-radius: 50px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
    }
    #retake-btn { background: #334155; color: #f1f5f9; display: none; }
    #upload-btn { background: #22c55e; color: white; display: none; }
    #close-btn { background: #ef4444; color: white; width: 100%; max-width: 420px; }
    #status {
      font-size: 0.92rem;
      color: #94a3b8;
      text-align: center;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 8px;
    }
    #status.success { color: #4ade80; font-weight: 700; font-size: 1.05rem; }
    #status.error { color: #f87171; }
    .spinner {
      display: inline-block;
      width: 20px; height: 20px;
      border: 3px solid rgba(148,163,184,0.3);
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <header>Subir foto para <span>${entityName}</span></header>
  <div id="main">

    <div id="preview-wrap">
      <div id="placeholder">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
        <span>TocÃ¡ el botÃ³n para abrir la cÃ¡mara</span>
      </div>
      <img id="photo-preview" alt="Foto seleccionada" />
    </div>

    <input id="file-input" type="file" accept="image/*" capture="environment" />

    <div class="controls">
      <button id="camera-btn" title="Abrir cÃ¡mara">
        <div class="inner">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
      </button>
      <button id="retake-btn" class="btn">â†© Otra foto</button>
      <button id="upload-btn" class="btn">âœ“ Subir</button>
    </div>

    <div id="status">TocÃ¡ el botÃ³n para sacar una foto.</div>
    <button id="close-btn" class="btn" onclick="window.close(); history.go(-1);">Cerrar</button>
  </div>

  <script>
    const fileInput    = document.getElementById('file-input');
    const photoPreview = document.getElementById('photo-preview');
    const placeholder  = document.getElementById('placeholder');
    const previewWrap  = document.getElementById('preview-wrap');
    const cameraBtn    = document.getElementById('camera-btn');
    const retakeBtn    = document.getElementById('retake-btn');
    const uploadBtn    = document.getElementById('upload-btn');
    const status       = document.getElementById('status');
    let selectedFile   = null;

    cameraBtn.addEventListener('click', () => { fileInput.value = ''; fileInput.click(); });
    retakeBtn.addEventListener('click', () => { fileInput.value = ''; fileInput.click(); });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      selectedFile = file;

      photoPreview.src = URL.createObjectURL(file);
      photoPreview.style.display = 'block';
      placeholder.style.display = 'none';
      previewWrap.classList.add('has-photo');

      cameraBtn.style.display = 'none';
      retakeBtn.style.display = 'flex';
      retakeBtn.textContent = 'â†© Otra foto';
      retakeBtn.disabled = false;
      uploadBtn.style.display = 'flex';
      uploadBtn.disabled = false;
      status.textContent = 'Â¿Se ve bien? PodÃ©s sacar otra o subir la foto.';
      status.className = '';
    });

    uploadBtn.addEventListener('click', async () => {
      if (!selectedFile) return;
      uploadBtn.disabled = true;
      retakeBtn.disabled = true;
      status.innerHTML = '<span class="spinner"></span>Subiendo...';
      status.className = '';

      const formData = new FormData();
      formData.append('file', selectedFile, selectedFile.name || ('foto_' + Date.now() + '.jpg'));

      try {
        const res = await fetch('${uploadUrl}', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) {
          status.textContent = 'âœ“ Foto subida correctamente.';
          status.className = 'success';
          photoPreview.style.opacity = '0.5';
          uploadBtn.style.display = 'none';
          uploadBtn.disabled = false;
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
  </script>
</body>
</html>`);
};

/**
 * POST /mobile-photo/upload
 * Receives the photo (memory storage buffer), validates the temp token, saves to S3 / local disk.
 */
const handleMobilePhotoUpload = async (req, res) => {
  try {
    console.log('[MobileUpload] Request received. token present:', !!req.query.token, 'file present:', !!req.file);

    const { token } = req.query;
    if (!token) return res.status(400).send({ error: 'Token requerido' });


    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded.photoUpload) throw new Error('Token invÃ¡lido');
    } catch (e) {
      return res.status(401).send({ error: 'El enlace expirÃ³ o es invÃ¡lido.' });
    }

    if (!req.file) {
      return res.status(400).send({ error: 'No se recibiÃ³ ningÃºn archivo' });
    }

    const { professionalId, username } = decoded;
    const prof = await Professional.findByPk(professionalId);
    if (!prof) return res.status(404).send({ error: 'Profesional no encontrado' });

    const folderName = username || prof.username;
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    let fileUrl;
    const bucketName = process.env.BUCKET_NAME || process.env.BUCKET;

    if (bucketName) {
      // --- S3 Upload ---
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: process.env.REGION || 'us-east-1',
        endpoint: process.env.ENDPOINT,
        credentials: {
          accessKeyId: process.env.ACCESS_KEY_ID,
          secretAccessKey: process.env.SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
      });
      const s3Key = `profesionales/${folderName}/${fileName}`;
      await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype || 'image/jpeg',
      }));
      fileUrl = `${process.env.ENDPOINT}/${bucketName}/${s3Key}`;
    } else {
      // --- Local disk save ---
      const fs = require('fs');
      const path = require('path');
      const uploadDir = path.join(__dirname, '../../uploads', 'profesionales', folderName);
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, fileName), req.file.buffer);
      const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
      fileUrl = `${baseUrl}/uploads/profesionales/${folderName}/${fileName}`;
    }

    let [photoDocType] = await ProfDocType.findOrCreate({
      where: { name: 'Foto' },
      defaults: { name: 'Foto', description: 'Foto tomada desde celular', status: true }
    });

    const doc = await ProfessionalDocument.create({
      professionalId,
      profDocTypeId: photoDocType.id,
      fileUrl,
      originalName
    });

    const fullDoc = await ProfessionalDocument.findByPk(doc.id, { include: [ProfDocType] });

    console.log('[MobileUpload] Success! Document id:', doc.id);
    res.status(201).send(fullDoc);
  } catch (e) {
    console.error('[MobileUpload] ERROR:', e);
    res.status(500).send({ error: e.message });
  }
};

/**
 * POST /api/patients/:patientId/photo-token
 * Generates a temporary JWT token for mobile photo upload to a patient (15 min TTL)
 */
const generatePatientPhotoToken = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patient = await Patient.findByPk(patientId);
    if (!patient) return res.status(404).send({ error: 'Paciente no encontrado' });

    const token = jwt.sign(
      { photoUpload: true, entityType: 'patient', patientId: patientId, patientName: `${patient.firstName} ${patient.lastName}` },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Build mobile URL (same logic as generatePhotoToken)
    let protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    let host = req.headers.host || 'localhost:5000';
    if (process.env.BACKEND_URL) {
      host = process.env.BACKEND_URL.replace(/^https?:\/\//, '');
      protocol = process.env.BACKEND_URL.startsWith('https') ? 'https' : 'http';
    } else if (host.startsWith('localhost') || host.startsWith('127.')) {
      const os = require('os');
      const nets = os.networkInterfaces();
      let localIp = null;
      for (const name of Object.keys(nets)) {
        for (const iface of nets[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            if (!localIp || iface.address.startsWith('192.168') || iface.address.startsWith('10.')) localIp = iface.address;
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
 * POST /mobile-photo/upload-patient
 * Receives the photo for a patient, validates the temp token, saves to S3 / local disk.
 */
const handleMobilePatientPhotoUpload = async (req, res) => {
  try {
    console.log('[MobilePatientUpload] Request received. token present:', !!req.query.token, 'file present:', !!req.file);

    const { token } = req.query;
    if (!token) return res.status(400).send({ error: 'Token requerido' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded.photoUpload || decoded.entityType !== 'patient') throw new Error('Token invÃ¡lido');
    } catch (e) {
      return res.status(401).send({ error: 'El enlace expirÃ³ o es invÃ¡lido.' });
    }

    if (!req.file) return res.status(400).send({ error: 'No se recibiÃ³ ningÃºn archivo' });

    const { patientId } = decoded;
    const patient = await Patient.findByPk(patientId);
    if (!patient) return res.status(404).send({ error: 'Paciente no encontrado' });

    const folderName = `paciente_${patientId}`;
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const bucketName = process.env.BUCKET_NAME || process.env.BUCKET;

    let url;
    if (bucketName) {
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: process.env.REGION || 'us-east-1',
        endpoint: process.env.ENDPOINT,
        credentials: { accessKeyId: process.env.ACCESS_KEY_ID, secretAccessKey: process.env.SECRET_ACCESS_KEY },
        forcePathStyle: true,
      });
      const s3Key = `pacientes/${folderName}/${fileName}`;
      await s3.send(new PutObjectCommand({ Bucket: bucketName, Key: s3Key, Body: req.file.buffer, ContentType: req.file.mimetype || 'image/jpeg' }));
      url = `${process.env.ENDPOINT}/${bucketName}/${s3Key}`;
    } else {
      const fs = require('fs');
      const path = require('path');
      const uploadDir = path.join(__dirname, '../../uploads', 'pacientes', folderName);
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(path.join(uploadDir, fileName), req.file.buffer);
      const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
      url = `${baseUrl}/uploads/pacientes/${folderName}/${fileName}`;
    }

    const doc = await PatientDocument.create({
      patientId,
      originalName,
      url,
      mimetype: req.file.mimetype || 'image/jpeg',
      size: req.file.size,
      isConformity: false,
    });

    console.log('[MobilePatientUpload] Success! Document id:', doc.id);
    res.status(201).send(doc);
  } catch (e) {
    console.error('[MobilePatientUpload] ERROR:', e);
    res.status(500).send({ error: e.message });
  }
};

module.exports = { generatePhotoToken, serveMobilePage, handleMobilePhotoUpload, generatePatientPhotoToken, handleMobilePatientPhotoUpload };

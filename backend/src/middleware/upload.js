const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const { Patient } = require('../models');

// Determinamos si usamos S3 basado en si BUCKET_NAME o BUCKET está definido en .env (o inyectado en Railway)
const bucketName = process.env.BUCKET_NAME || process.env.BUCKET;
const useS3 = !!bucketName;

let storage;

if (useS3) {
  // --- ENTORNO: PRODUCCIÓN (BUCKET EN RAILWAY/AWS) ---
  const s3Config = new S3Client({
    region: process.env.REGION || 'us-east-1',
    endpoint: process.env.ENDPOINT,
    credentials: {
      accessKeyId: process.env.ACCESS_KEY_ID,
      secretAccessKey: process.env.SECRET_ACCESS_KEY,
    },
    // Force path style is usuall required for custom S3 compatible services like MinIO or Railway
    forcePathStyle: true,
  });

  storage = multerS3({
    s3: s3Config,
    bucket: bucketName,
    // acl: 'public-read', // Descomentar si el bucket necesita que el archivo sea público y lo permite
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const { id } = req.params;
      Patient.findByPk(id).then(patient => {
        const folderName = patient ? patient.docNumber : id;
        // Keep original name but prepend a timestamp to avoid collisions
        const fileName = `${Date.now()}-${file.originalname}`;
        cb(null, `${folderName}/${fileName}`);
      }).catch(err => cb(err));
    }
  });
  console.log('[Storage] Usando almacenamiento en la Nube (S3/Railway Bucket)');
} else {
  // --- ENTORNO: DESARROLLO (DISCO LOCAL) ---
  const uploadDir = path.join(__dirname, '../../uploads');
  
  // Nos aseguramos de que el directorio "uploads" exista
  if (!fs.existsSync(uploadDir)){
      fs.mkdirSync(uploadDir, { recursive: true });
  }

  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const { id } = req.params;
      Patient.findByPk(id).then(patient => {
        const folderName = patient ? patient.docNumber : id;
        const patientDir = path.join(uploadDir, folderName);
        if (!fs.existsSync(patientDir)){
            fs.mkdirSync(patientDir, { recursive: true });
        }
        cb(null, patientDir);
      }).catch(err => cb(err));
    },
    filename: function (req, file, cb) {
      // Keep original name but prepend a timestamp to avoid collisions
      const fileName = `${Date.now()}-${file.originalname}`;
      cb(null, fileName);
    }
  });
  console.log('[Storage] Usando almacenamiento en Disco Local (/uploads)');
}

// Configuración general de Multer
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Límite de 10 MB
});

module.exports = upload;

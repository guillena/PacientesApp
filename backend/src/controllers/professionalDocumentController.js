const { ProfessionalDocument, ProfDocType, Professional } = require('../models');
const fs = require('fs');
const path = require('path');

const getDocuments = async (req, res) => {
  try {
    const documents = await ProfessionalDocument.findAll({
      where: { professionalId: req.params.professionalId },
      include: [ProfDocType]
    });
    res.send(documents);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send({ error: 'No se subió ningún archivo' });
    }

    const { professionalId } = req.params;
    const prof = await Professional.findByPk(professionalId);
    const folderName = prof ? prof.username : professionalId;
    
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const fileUrl = req.file.location || `${baseUrl}/uploads/profesionales/${folderName}/${req.file.filename}`;

    // Fix filename encoding (Multer handles it as latin1)
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    
    // Create the document entry
    const doc = await ProfessionalDocument.create({
      professionalId,
      profDocTypeId: req.body.profDocTypeId,
      fileUrl,
      originalName
    });
    
    // Fetch it again to include ProfDocType
    const fullDoc = await ProfessionalDocument.findByPk(doc.id, { include: [ProfDocType] });
    res.status(201).send(fullDoc);
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
};

const deleteDocument = async (req, res) => {
  try {
    const doc = await ProfessionalDocument.findOne({
      where: { id: req.params.documentId, professionalId: req.params.professionalId }
    });
    
    if (!doc) return res.status(404).send({ error: 'Documento no encontrado' });
    
    const bucketName = process.env.BUCKET_NAME || process.env.BUCKET;
    if (bucketName) {
      // S3 deletion
      const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: process.env.REGION || 'us-east-1',
        endpoint: process.env.ENDPOINT,
        credentials: {
          accessKeyId: process.env.ACCESS_KEY_ID,
          secretAccessKey: process.env.SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
      });

      try {
        const urlObj = new URL(doc.fileUrl);
        let key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
        if (bucketName && key.startsWith(`${bucketName}/`)) {
          key = key.substring(bucketName.length + 1);
        }
        if (key.startsWith('uploads/')) {
          key = key.substring('uploads/'.length);
        }
        await s3.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: decodeURIComponent(key)
        }));
      } catch (err) {
        console.warn('S3 Delete Single Doc Warning:', err);
      }
    } else {
      // Local deletion
      const prof = await Professional.findByPk(req.params.professionalId);
      if (prof) {
        const folderName = prof.username;
        const fileName = path.basename(doc.fileUrl);
        const filePath = path.join(__dirname, '../../uploads', 'profesionales', folderName, fileName);
        
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch (err) {
            console.warn(`Could not delete file ${filePath}:`, err);
          }
        }
      }
    }
    
    await doc.destroy();
    res.send({ message: 'Documento eliminado' });
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

const getProfessionalDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const doc = await ProfessionalDocument.findByPk(documentId);
    
    if (!doc) {
      return res.status(404).send({ error: 'Documento no encontrado' });
    }

    const contentType = doc.fileUrl.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName)}"`);

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

      const urlObj = new URL(doc.fileUrl);
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
      s3Response.Body.pipe(res);
    } else {
      const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      const relativePath = doc.fileUrl.replace(baseUrl, '').replace('/uploads/', '');
      const localPath = path.join(__dirname, '../../uploads', relativePath);
      
      if (fs.existsSync(localPath)) {
        fs.createReadStream(localPath).pipe(res);
      } else {
        res.status(404).send({ error: 'Archivo local no encontrado' });
      }
    }
  } catch (e) {
    console.error('ERROR VIEWING PROFESSIONAL DOCUMENT:', e);
    if (!res.headersSent) {
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
        res.status(404).send({ error: 'Documento no encontrado en el almacenamiento' });
      } else {
        res.status(500).send({ error: 'Error al obtener el documento' });
      }
    }
  }
};

module.exports = {
  getDocuments,
  uploadDocument,
  deleteDocument,
  getProfessionalDocument
};


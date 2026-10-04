const { ProfessionalDocument, ProfDocType, Professional } = require('../models');
const fs = require('fs');
const path = require('path');
const { getMimeType, getDocumentBuffer, convertDocToHtml } = require('../utils/docPreview');

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

const cropProfessionalDocument = async (req, res) => {
  try {
    const { professionalId, documentId } = req.params;
    const file = req.file;
    if (!file) {
      return res.status(400).send({ error: 'No se recibió la imagen recortada' });
    }

    const doc = await ProfessionalDocument.findOne({ where: { id: documentId, professionalId } });
    if (!doc) {
      return res.status(404).send({ error: 'Documento no encontrado' });
    }

    const oldUrl = doc.fileUrl;
    const prof = await Professional.findByPk(professionalId);
    const folderName = prof ? prof.username : professionalId;

    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const newUrl = file.location || `${baseUrl}/uploads/profesionales/${folderName}/${file.filename}`;

    const bucketName = process.env.BUCKET_NAME || process.env.BUCKET;
    if (bucketName) {
      try {
        const { DeleteObjectCommand, S3Client } = require('@aws-sdk/client-s3');
        const s3 = new S3Client({
          region: process.env.REGION || 'us-east-1',
          endpoint: process.env.ENDPOINT,
          credentials: {
            accessKeyId: process.env.ACCESS_KEY_ID,
            secretAccessKey: process.env.SECRET_ACCESS_KEY,
          },
          forcePathStyle: true,
        });
        const urlObj = new URL(oldUrl);
        let key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
        if (bucketName && key.startsWith(`${bucketName}/`)) key = key.substring(bucketName.length + 1);
        if (key.startsWith('uploads/')) key = key.substring('uploads/'.length);
        await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: decodeURIComponent(key) }));
      } catch (e) {
        console.warn('Could not delete old S3 file:', e);
      }
    } else {
      const oldRelativePath = oldUrl.replace(baseUrl, '').replace('/uploads/', '');
      const oldFilePath = path.join(__dirname, '../../uploads', oldRelativePath);
      const newFilePath = path.join(__dirname, '../../uploads/profesionales', folderName, file.filename);
      if (fs.existsSync(oldFilePath) && oldFilePath !== newFilePath) {
        try { fs.unlinkSync(oldFilePath); } catch (e) {}
      }
    }

    doc.fileUrl = newUrl;
    await doc.save();

    const updated = await ProfessionalDocument.findByPk(doc.id, { include: [ProfDocType] });
    res.send(updated);
  } catch (err) {
    console.error('Error cropping professional document:', err);
    res.status(500).send({ error: 'Error al guardar la imagen recortada' });
  }
};

const getProfessionalDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const doc = await ProfessionalDocument.findByPk(documentId);
    
    if (!doc) {
      return res.status(404).send({ error: 'Documento no encontrado' });
    }

    const contentType = getMimeType(doc.originalName || doc.fileUrl);
    res.setHeader('Content-Type', contentType);
    const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(doc.originalName)}"`);

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

const getProfessionalDocumentPreview = async (req, res) => {
  try {
    const { documentId } = req.params;
    const doc = await ProfessionalDocument.findByPk(documentId);
    if (!doc) {
      return res.status(404).send({ error: 'Documento no encontrado' });
    }

    const buffer = await getDocumentBuffer(doc.fileUrl);
    const result = await convertDocToHtml(buffer, doc.originalName || doc.fileUrl);
    res.send(result);
  } catch (err) {
    console.error('ERROR GETTING PROFESSIONAL DOC PREVIEW:', err);
    res.status(500).send({ error: 'Error al generar la vista previa del documento', details: err.message });
  }
};

module.exports = {
  getDocuments,
  uploadDocument,
  deleteDocument,
  cropProfessionalDocument,
  getProfessionalDocument,
  getProfessionalDocumentPreview
};


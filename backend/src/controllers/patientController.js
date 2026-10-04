const { Patient, DocumentType, PatientDocument, Appointment, Activity, Test, PatientTest, Professional, PatientProfessional } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { checkAndSendBirthdayEmails } = require('../utils/birthdayCron');
const { getMimeType, getDocumentBuffer, convertDocToHtml } = require('../utils/docPreview');

const createPatient = async (req, res) => {
  try {
    const { professionalIds, ...data } = req.body;
    // Evitar error en PostgreSQL con fechas vacías o inválidas
    if (data.birthDate === '' || data.birthDate === 'Invalid date') {
      data.birthDate = null;
    }
    const patient = await Patient.create(data);

    // Asignar profesionales: si viene array en el body, usarlo.
    // Si no viene o está vacío y el creador es rol profesional, asignar al profesional que lo crea.
    let targetProfIds = [];
    if (Array.isArray(professionalIds) && professionalIds.length > 0) {
      targetProfIds = professionalIds;
    } else if (req.professional?.role !== 'admin' && req.professional?.id) {
      targetProfIds = [req.professional.id];
    }

    if (targetProfIds.length > 0) {
      await patient.setProfessionals(targetProfIds);
    }

    const createdPatient = await Patient.findByPk(patient.id, {
      include: [
        { model: DocumentType },
        { model: PatientDocument },
        { model: Activity, attributes: ['id'] },
        { model: PatientTest, attributes: ['id'] },
        {
          model: Professional,
          attributes: ['id', 'firstName', 'lastName', 'username', 'role', 'color'],
          through: { attributes: [] }
        }
      ]
    });

    res.status(201).send(createdPatient);
  } catch (e) {
    console.error('SERVER ERROR CREATE PATIENT:', e);
    
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).send({ 
        error: 'Ya existe un paciente con ese tipo y número de documento.',
        message: 'Duplicate document'
      });
    }

    res.status(400).send({ 
      error: 'Error de validación o base de datos',
      message: e.message,
      errors: e.errors?.map(err => err.message) || []
    });
  }
};

const getPatients = async (req, res) => {
  try {
    const userRole = req.professional?.role;
    const userId = req.professional?.id;
    const includeAll = req.query.all === 'true' || userRole === 'admin';

    const where = {};
    if (!includeAll) {
      const assigned = await PatientProfessional.findAll({
        where: { professionalId: userId },
        attributes: ['patientId']
      });
      const assignedPatientIds = assigned.map(a => a.patientId);
      where.id = { [Op.in]: assignedPatientIds };
    }

    const patients = await Patient.findAll({
      where,
      order: [
        ['lastName', 'ASC'],
        ['firstName', 'ASC']
      ],
      include: [
        { model: DocumentType },
        { model: PatientDocument },
        { model: Activity, attributes: ['id'] },
        { model: PatientTest, attributes: ['id'] },
        {
          model: Professional,
          attributes: ['id', 'firstName', 'lastName', 'username', 'role', 'color'],
          through: { attributes: [] }
        }
      ]
    });
    res.send(patients);
  } catch (e) {
    console.error('SERVER ERROR GET PATIENTS:', e);
    res.status(500).send();
  }
};

const getPatient = async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id, {
      include: [
        { model: DocumentType },
        { model: PatientDocument },
        { model: Activity, attributes: ['id'] },
        { model: PatientTest, attributes: ['id'] },
        {
          model: Professional,
          attributes: ['id', 'firstName', 'lastName', 'username', 'role', 'color'],
          through: { attributes: [] }
        }
      ]
    });
    if (!patient) {
      return res.status(404).send();
    }
    res.send(patient);
  } catch (e) {
    console.error('SERVER ERROR GET PATIENT:', e);
    res.status(500).send();
  }
};

const updatePatient = async (req, res) => {
  try {
    const patient = await Patient.findByPk(req.params.id);
    if (!patient) {
      return res.status(404).send();
    }
    const { professionalIds, ...data } = req.body;
    console.log(`[UPDATE PATIENT] ID: ${req.params.id} | User: ${req.professional?.username} (${req.professional?.role})`);
    console.log(`[UPDATE PATIENT] Received professionalIds:`, professionalIds);

    // Evitar error en PostgreSQL con fechas vacías o inválidas
    if (data.birthDate === '' || data.birthDate === 'Invalid date') {
      data.birthDate = null;
    }
    await patient.update(data);

    // Solo el administrador puede modificar la asignación de profesionales a un paciente
    if (req.professional?.role === 'admin' && Array.isArray(professionalIds)) {
      console.log(`[UPDATE PATIENT] Admin is updating professionalIds:`, professionalIds);
      await patient.setProfessionals(professionalIds);
    }

    const updatedPatient = await Patient.findByPk(patient.id, {
      include: [
        { model: DocumentType },
        { model: PatientDocument },
        { model: Activity, attributes: ['id'] },
        { model: PatientTest, attributes: ['id'] },
        {
          model: Professional,
          attributes: ['id', 'firstName', 'lastName', 'username', 'role', 'color'],
          through: { attributes: [] }
        }
      ]
    });

    res.send(updatedPatient);
  } catch (e) {
    console.error('SERVER ERROR UPDATE PATIENT:', e);

    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).send({ 
        error: 'Ya existe un paciente con ese tipo y número de documento.',
        message: 'Duplicate document'
      });
    }

    res.status(400).send({
      error: 'Error al actualizar el paciente',
      message: e.message
    });
  }
};

const getDocumentTypes = async (req, res) => {
  try {
    const types = await DocumentType.findAll();
    res.send(types);
  } catch (e) {
    res.status(500).send();
  }
};

const uploadPatientDocument = async (req, res) => {
  try {
    const patientId = req.params.id;
    const file = req.file;
    if (!file) {
      return res.status(400).send({ error: 'No se subió ningún archivo' });
    }

    const patient = await Patient.findByPk(patientId);
    const folderName = patient ? patient.docNumber : patientId;

    // Determine URL (local or cloud)
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const url = file.location || `${baseUrl}/uploads/${folderName}/${file.filename}`;

    // Fix filename encoding (Multer handles it as latin1)
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const doc = await PatientDocument.create({
      patientId,
      originalName,
      url,
      mimetype: file.mimetype,
      size: file.size,
      isConformity: req.body.isConformity === 'true' || req.body.isConformity === true
    });

    res.status(201).send(doc);
  } catch (e) {
    console.error('Error uploading document:', e);
    res.status(500).send({ error: 'Failed to save document' });
  }
};

const deletePatientDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;
    const doc = await PatientDocument.findOne({ where: { id: docId, patientId: id } });
    if (!doc) return res.status(404).send();

    const bucketName = process.env.BUCKET_NAME || process.env.BUCKET;
    if (bucketName) {
      // 1. Delete physical file from S3
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
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
        const urlObj = new URL(doc.url);
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
      // 1. Delete physical file if using local storage
      const patient = await Patient.findByPk(id);
      if (patient) {
        const folderName = patient.docNumber;
        // Get filename from URL
        const fileName = path.basename(doc.url);
        const filePath = path.join(__dirname, '../../uploads', folderName, fileName);
        
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`Deleted file: ${filePath}`);
          } catch (err) {
            console.warn(`Could not delete file ${filePath}:`, err);
          }
        }
      }
    }

    await doc.destroy();
    res.send({ message: 'Documento eliminado' });
  } catch (e) {
    console.error('Error deleting document:', e);
    res.status(500).send({ error: 'Error al eliminar el documento' });
  }
};

const cropPatientDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;
    const file = req.file;
    if (!file) {
      return res.status(400).send({ error: 'No se recibió la imagen recortada' });
    }

    const doc = await PatientDocument.findOne({ where: { id: docId, patientId: id } });
    if (!doc) {
      return res.status(404).send({ error: 'Documento no encontrado' });
    }

    const oldUrl = doc.url;
    const patient = await Patient.findByPk(id);
    const folderName = patient ? patient.docNumber : id;

    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const newUrl = file.location || `${baseUrl}/uploads/${folderName}/${file.filename}`;

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
      const newFilePath = path.join(__dirname, '../../uploads', folderName, file.filename);
      if (fs.existsSync(oldFilePath) && oldFilePath !== newFilePath) {
        try { fs.unlinkSync(oldFilePath); } catch (e) {}
      }
    }

    doc.url = newUrl;
    doc.size = file.size;
    doc.mimetype = file.mimetype;
    await doc.save();

    res.send(doc);
  } catch (err) {
    console.error('Error cropping patient document:', err);
    res.status(500).send({ error: 'Error al guardar la imagen recortada' });
  }
};

const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await Patient.findByPk(id, {
      include: [{ model: PatientDocument }]
    });
    
    if (!patient) return res.status(404).send({ error: 'Paciente no encontrado' });

    const folderName = patient.docNumber;

    // 1. Delete ALL Documents/Folder from S3 and Local for this patient
    const bucketName = process.env.BUCKET_NAME || process.env.BUCKET;
    if (bucketName) {
      // --- MODALIDAD S3: Eliminar todos los objetos de la carpeta del paciente ---
      const { ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: process.env.REGION || 'us-east-1',
        endpoint: process.env.ENDPOINT,
        credentials: {
          accessKeyId: process.env.ACCESS_KEY_ID,
          secretAccessKey: process.env.SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
      });

      const prefixes = new Set([`${folderName}/`, `${id}/`]);
      const keysToDelete = new Set();

      // Collect keys by prefix listing
      for (const prefix of prefixes) {
        try {
          const listCmd = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix
          });
          const listRes = await s3.send(listCmd);
          if (listRes.Contents && listRes.Contents.length > 0) {
            listRes.Contents.forEach(item => keysToDelete.add(item.Key));
          }
        } catch (err) {
          console.warn(`S3 List Warning for prefix ${prefix}:`, err);
        }
      }

      // Also collect keys from DB records as fallback
      if (patient.PatientDocuments && patient.PatientDocuments.length > 0) {
        patient.PatientDocuments.forEach(doc => {
          try {
            const urlObj = new URL(doc.url);
            let key = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
            if (bucketName && key.startsWith(`${bucketName}/`)) {
              key = key.substring(bucketName.length + 1);
            }
            if (key.startsWith('uploads/')) {
              key = key.substring('uploads/'.length);
            }
            keysToDelete.add(decodeURIComponent(key));
          } catch (e) {}
        });
      }

      if (keysToDelete.size > 0) {
        const objects = Array.from(keysToDelete).map(k => ({ Key: k }));
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: { Objects: objects }
        });
        await s3.send(deleteCommand).catch(err => console.error('S3 Delete Patient Folder Warning:', err));
      }
    }

    // Cleanup local folder if it exists
    const uploadDir = path.join(__dirname, '../../uploads');
    const patientDir = path.join(uploadDir, folderName);
    const idDir = path.join(uploadDir, id);
    if (fs.existsSync(patientDir)) {
      try { fs.rmSync(patientDir, { recursive: true, force: true }); } catch (e) {}
    }
    if (fs.existsSync(idDir)) {
      try { fs.rmSync(idDir, { recursive: true, force: true }); } catch (e) {}
    }

    // 2. Manually delete associations (Safer for some DB constraints)
    await Appointment.destroy({ where: { patientId: id } });
    await Activity.destroy({ where: { patientId: id } });
    await PatientDocument.destroy({ where: { patientId: id } });
    await PatientTest.destroy({ where: { patientId: id } });
    await PatientProfessional.destroy({ where: { patientId: id } });

    // 3. Final Patient Delete
    await patient.destroy();
    
    res.send({ message: 'Paciente y sus archivos eliminados exitosamente' });
  } catch (e) {
    console.error('SERVER ERROR DELETE PATIENT:', e);
    res.status(500).send({ 
      error: 'Error al eliminar el paciente. No tiene permisos suficientes o tiene registros vinculados de forma estricta.',
      details: e.message 
    });
  }
};

const getPatientDocument = async (req, res) => {
  try {
    const { docId } = req.params;
    const doc = await PatientDocument.findByPk(docId);
    
    if (!doc) {
      return res.status(404).send({ error: 'Documento no encontrado' });
    }

    // Determine type for correct response headers
    const contentType = getMimeType(doc.originalName || doc.url);
    res.setHeader('Content-Type', contentType);
    const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(doc.originalName)}"`);

    const bucketName = process.env.BUCKET_NAME || process.env.BUCKET;
    if (bucketName) {
      // --- MODALIDAD S3 (PRODUCCIÓN) ---
      const s3 = new S3Client({
        region: process.env.REGION || 'us-east-1',
        endpoint: process.env.ENDPOINT,
        credentials: {
          accessKeyId: process.env.ACCESS_KEY_ID,
          secretAccessKey: process.env.SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
      });

      // Extract key from URL
      const urlObj = new URL(doc.url);
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
      // --- MODALIDAD LOCAL (DESARROLLO) ---
      // Convert URL to local path
      const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      const relativePath = doc.url.replace(baseUrl, '').replace('/uploads/', '');
      const localPath = path.join(__dirname, '../../uploads', relativePath);
      
      if (fs.existsSync(localPath)) {
        fs.createReadStream(localPath).pipe(res);
      } else {
        res.status(404).send({ error: 'Archivo local no encontrado' });
      }
    }
  } catch (e) {
    console.error('ERROR VIEWING DOCUMENT:', e);
    if (!res.headersSent) {
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
        res.status(404).send({ error: 'Documento no encontrado en el almacenamiento' });
      } else {
        res.status(500).send({ error: 'Error al obtener el documento' });
      }
    }
  }
};

const triggerBirthdayEmail = async (req, res) => {
  try {
    const result = await checkAndSendBirthdayEmails();
    res.send({ success: true, ...result });
  } catch (e) {
    console.error('ERROR TRIGGERING BIRTHDAY EMAIL:', e);
    res.status(500).send({ error: e.message });
  }
};

const getPatientTests = async (req, res) => {
  try {
    const { id } = req.params;
    const tests = await PatientTest.findAll({
      where: { patientId: id },
      include: [{ model: Test }],
      order: [['date', 'DESC']]
    });
    res.send(tests);
  } catch (e) {
    res.status(500).send({ error: 'Error al obtener pruebas del paciente' });
  }
};

const addPatientTest = async (req, res) => {
  try {
    const { id } = req.params;
    const { testId, date } = req.body;
    
    if (!testId || !date) {
      return res.status(400).send({ error: 'Faltan datos obligatorios' });
    }

    const patientTest = await PatientTest.create({
      patientId: id,
      testId,
      date
    });

    const testWithDetails = await PatientTest.findByPk(patientTest.id, {
      include: [{ model: Test }]
    });

    res.status(201).send(testWithDetails);
  } catch (e) {
    res.status(500).send({ error: 'Error al agregar la prueba al paciente' });
  }
};

const deletePatientTest = async (req, res) => {
  try {
    const { id, testId } = req.params;
    const patientTest = await PatientTest.findOne({
      where: { id: testId, patientId: id }
    });

    if (!patientTest) return res.status(404).send();

    await patientTest.destroy();
    res.send({ message: 'Prueba eliminada' });
  } catch (e) {
    res.status(500).send({ error: 'Error al eliminar la prueba' });
  }
};

const getPatientDocumentPreview = async (req, res) => {
  try {
    const { docId } = req.params;
    const doc = await PatientDocument.findByPk(docId);
    if (!doc) {
      return res.status(404).send({ error: 'Documento no encontrado' });
    }

    const buffer = await getDocumentBuffer(doc.url);
    const result = await convertDocToHtml(buffer, doc.originalName || doc.url);
    res.send(result);
  } catch (err) {
    console.error('ERROR GETTING PATIENT DOC PREVIEW:', err);
    res.status(500).send({ error: 'Error al generar la vista previa del documento', details: err.message });
  }
};

module.exports = {
  createPatient,
  getPatients,
  getPatient,
  updatePatient,
  getDocumentTypes,
  uploadPatientDocument,
  deletePatientDocument,
  cropPatientDocument,
  deletePatient,
  getPatientDocument,
  getPatientDocumentPreview,
  triggerBirthdayEmail,
  getPatientTests,
  addPatientTest,
  deletePatientTest
};

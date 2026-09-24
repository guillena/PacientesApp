const bcrypt = require('bcryptjs');
const { Professional, Benefit, ProfessionalDocument } = require('../models');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const createProfessional = async (req, res) => {
  try {
    let { firstName, lastName, username, password, role, benefitIds, color } = req.body;
    if (role === 'admin') color = '#95a5a6';

    console.log('--- CREATE PROFESSIONAL ---');
    console.log('Body:', JSON.stringify({ ...req.body, password: '***' }));
    
    const hashedPassword = await bcrypt.hash(password, 8);
    const professional = await Professional.create({
      firstName, lastName, username, password: hashedPassword, role, color
    });
    console.log('Created ID:', professional.id);

    if (benefitIds && Array.isArray(benefitIds)) {
      console.log('Setting Benefits:', benefitIds);
      await professional.setBenefits(benefitIds);
    }

    // Refresh professional to include Benefits in the re-fetched object
    const profWithBenefits = await Professional.findByPk(professional.id, {
      include: [Benefit],
      attributes: { exclude: ['password'] }
    });

    console.log('CREATE PROF SUCCESS:', profWithBenefits.username);
    res.status(201).send(profWithBenefits);
  } catch (e) {
    console.error('SERVER ERROR CREATE PROF:', e);
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).send({ error: 'El nombre de usuario ya está en uso. Por favor elija otro.' });
    }
    res.status(400).send({ error: e.message || 'Error al crear profesional', details: e });
  }
};

const getProfessionals = async (req, res) => {
  try {
    const professionals = await Professional.findAll({
      attributes: { exclude: ['password'] },
      include: [Benefit, ProfessionalDocument]
    });
    res.send(professionals);
  } catch (e) {
    res.status(500).send(e);
  }
};

const updateProfessional = async (req, res) => {
  try {
    const professional = await Professional.findByPk(req.params.id);
    if (!professional) {
      return res.status(404).send({ error: 'Profesional no encontrado' });
    }
    
    // If password is being updated, hash it
    let updateData = { ...req.body };
    if (updateData.password && updateData.password.trim() !== '') {
      updateData.password = await bcrypt.hash(updateData.password, 8);
    } else {
      // Don't update password if empty string or missing
      delete updateData.password;
    }

    if (updateData.role === 'admin') {
      updateData.color = '#95a5a6';
    }
    
    console.log('--- UPDATE PROFESSIONAL ---');
    console.log('Body:', JSON.stringify({ ...updateData, password: '***' }));
    
    await professional.update(updateData);

    if (updateData.benefitIds && Array.isArray(updateData.benefitIds)) {
      console.log('Updating Benefits:', updateData.benefitIds);
      await professional.setBenefits(updateData.benefitIds);
    }
    
    const profWithBenefits = await Professional.findByPk(professional.id, {
      include: [Benefit],
      attributes: { exclude: ['password'] }
    });
    console.log('UPDATE PROF SUCCESS:', professional.username);
    res.send(profWithBenefits);
  } catch (e) {
    console.error('SERVER ERROR UPDATE PROF:', e);
    if (e.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).send({ error: 'El nombre de usuario ya está en uso. Por favor elija otro.' });
    }
    res.status(400).send({ error: e.message || 'Error al actualizar profesional' });
  }
};

const deleteProfessional = async (req, res) => {
  try {
    const professional = await Professional.findByPk(req.params.id);
    if (!professional) {
      return res.status(404).send({ error: 'Profesional no encontrado' });
    }
    await professional.destroy();
    res.send({ message: 'Profesional eliminado' });
  } catch (e) {
    console.error('SERVER ERROR DELETE PROF:', e);
    res.status(500).send({ error: 'Error al eliminar profesional' });
  }
};

const downloadAllFiles = async (req, res) => {
  try {
    const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
    const fileName = `buketkume${timestamp}.zip`;

    res.attachment(fileName);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    const bucketName = process.env.BUCKET_NAME || process.env.BUCKET;
    if (bucketName) {
      // --- MODALIDAD S3 (PRODUCCIÓN) ---
      console.log('[ARCHIVE] Descargando desde S3:', bucketName);
      const s3 = new S3Client({
        region: process.env.REGION || 'us-east-1',
        endpoint: process.env.ENDPOINT,
        credentials: {
          accessKeyId: process.env.ACCESS_KEY_ID,
          secretAccessKey: process.env.SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
      });

      const listCommand = new ListObjectsV2Command({ Bucket: bucketName });
      const { Contents } = await s3.send(listCommand);

      if (Contents && Contents.length > 0) {
        for (const item of Contents) {
          const getCommand = new GetObjectCommand({ Bucket: bucketName, Key: item.Key });
          const response = await s3.send(getCommand);
          archive.append(response.Body, { name: item.Key });
        }
      }
    } else {
      // --- MODALIDAD LOCAL (DESARROLLO) ---
      const uploadDir = path.join(__dirname, '../../uploads');
      if (fs.existsSync(uploadDir)) {
        archive.directory(uploadDir, false);
      }
    }

    await archive.finalize();
  } catch (e) {
    console.error('ERROR DOWNLOADING ALL FILES:', e);
    if (!res.headersSent) {
      res.status(500).send({ error: 'Error al generar el archivo. Por favor intente nuevamente.' });
    }
  }
};

module.exports = { createProfessional, getProfessionals, updateProfessional, deleteProfessional, downloadAllFiles };

const express = require('express');
// Trigger restart for Tasks routes
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const { sequelize } = require('./src/models');

const authRoutes = require('./src/routes/authRoutes');
const professionalRoutes = require('./src/routes/professionalRoutes');
const patientRoutes = require('./src/routes/patientRoutes');
const benefitRoutes = require('./src/routes/benefitRoutes');
const appointmentRoutes = require('./src/routes/appointmentRoutes');
const activityRoutes = require('./src/routes/activityRoutes');
const taskRoutes = require('./src/routes/taskRoutes');
const testRoutes = require('./src/routes/testRoutes');
const profDocTypeRoutes = require('./src/routes/profDocTypeRoutes');
const { Test, ProfDocType, Patient, Professional, PatientProfessional } = require('./src/models');
const { seedTests } = require('./src/utils/seedTests');
const upload = require('./src/middleware/upload');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// app.use(helmet({
//   contentSecurityPolicy: false,
//   crossOriginResourcePolicy: { policy: "cross-origin" },
//   frameguard: false
// }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Serve static files from the uploads directory (used in local development)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/professionals', professionalRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/benefits', benefitRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/prof-doc-types', profDocTypeRoutes);

// Mobile QR photo upload routes (public-ish, secured by short-lived JWT in query string)
// Uses a simple memory-storage multer to avoid issues with the complex shared upload middleware
const multerMemory = require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const { serveMobilePage, handleMobilePhotoUpload, handleMobilePatientPhotoUpload } = require('./src/controllers/mobilePhotoController');
app.get('/mobile-photo', serveMobilePage);
app.post('/mobile-photo/upload', multerMemory.single('file'), handleMobilePhotoUpload);
app.post('/mobile-photo/upload-patient', multerMemory.single('file'), handleMobilePatientPhotoUpload);



// Basic Route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Suppress favicon 404 (browsers always request this)
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('GLOBAL ERROR:', err);
  res.status(err.status || 500).send({ error: err.message, details: err });
});

const { initBirthdayCron } = require('./src/utils/birthdayCron');

// Database Sync and Start Server
sequelize.sync().then(async () => {
  console.log('Database connected and synced');
  
  // Automatic safe column migration for Appointments table
  try {
    const isPostgres = sequelize.getDialect() === 'postgres';
    if (isPostgres) {
      const appCols = ['confirmed', 'paid', 'attended'];
      for (const col of appCols) {
        try {
          await sequelize.query(`ALTER TABLE "Appointments" ADD COLUMN IF NOT EXISTS "${col}" BOOLEAN DEFAULT FALSE;`);
        } catch (e) {
          try {
            await sequelize.query(`ALTER TABLE appointments ADD COLUMN IF NOT EXISTS ${col} BOOLEAN DEFAULT FALSE;`);
          } catch (e2) {}
        }
      }
    }

    const queryInterface = sequelize.getQueryInterface();
    let tableDescription = null;
    let targetTableName = 'Appointments';
    try {
      tableDescription = await queryInterface.describeTable('Appointments');
      targetTableName = 'Appointments';
    } catch (e) {
      try {
        tableDescription = await queryInterface.describeTable('appointments');
        targetTableName = 'appointments';
      } catch (e2) {}
    }

    if (tableDescription) {
      const colMap = {};
      Object.keys(tableDescription).forEach(k => {
        colMap[k.toLowerCase()] = true;
      });

      if (!colMap['confirmed']) {
        await queryInterface.addColumn(targetTableName, 'confirmed', {
          type: require('sequelize').DataTypes.BOOLEAN,
          defaultValue: false
        });
        console.log(`[Migration] Added column "confirmed" to ${targetTableName} table successfully`);
      }
      if (!colMap['paid']) {
        await queryInterface.addColumn(targetTableName, 'paid', {
          type: require('sequelize').DataTypes.BOOLEAN,
          defaultValue: false
        });
        console.log(`[Migration] Added column "paid" to ${targetTableName} table successfully`);
      }
      if (!colMap['attended']) {
        await queryInterface.addColumn(targetTableName, 'attended', {
          type: require('sequelize').DataTypes.BOOLEAN,
          defaultValue: false
        });
        console.log(`[Migration] Added column "attended" to ${targetTableName} table successfully`);
      }
    }

    // Automatic safe column migration for Professionals table (address & personal fields)
    const profTableDescription = await queryInterface.describeTable('Professionals');
    const profCols = [
      { name: 'street', type: require('sequelize').DataTypes.STRING },
      { name: 'number', type: require('sequelize').DataTypes.STRING },
      { name: 'floor', type: require('sequelize').DataTypes.STRING },
      { name: 'apartment', type: require('sequelize').DataTypes.STRING },
      { name: 'province', type: require('sequelize').DataTypes.STRING },
      { name: 'city', type: require('sequelize').DataTypes.STRING },
      { name: 'postalCode', type: require('sequelize').DataTypes.STRING },
      { name: 'docTypeId', type: require('sequelize').DataTypes.UUID },
      { name: 'docNumber', type: require('sequelize').DataTypes.STRING },
      { name: 'licenseNumber', type: require('sequelize').DataTypes.STRING },
      { name: 'startDate', type: require('sequelize').DataTypes.DATEONLY }
    ];
    for (const col of profCols) {
      if (!profTableDescription[col.name]) {
        await queryInterface.addColumn('Professionals', col.name, {
          type: col.type,
          allowNull: true
        });
        console.log(`[Migration] Added column "${col.name}" to Professionals table successfully`);
      }
    }
  } catch (migErr) {
    console.log('[Migration check]', migErr.message);
  }

  // Auto-seed Tests catalogue if empty
  try {
    const testsCount = await Test.count();
    if (testsCount === 0) {
      console.log('[Auto-seed] Catálogo de pruebas vacío. Importando...');
      await seedTests();
    }
  } catch (seedErr) {
    console.error('[Auto-seed Tests error]', seedErr.message);
  }

  // Auto-seed ProfDocType if empty
  try {
    const profDocCount = await ProfDocType.count();
    if (profDocCount === 0) {
      console.log('[Auto-seed] Tipos de documento profesional vacío. Creando tipos iniciales...');
      await ProfDocType.findOrCreate({
        where: { name: 'DNI' },
        defaults: { name: 'DNI', description: 'Documento Nacional de Identidad', status: true }
      });
    }
  } catch (profDocErr) {
    console.error('[Auto-seed ProfDocType error]', profDocErr.message);
  }

  // Auto-seed PatientProfessional if empty
  try {
    const relCount = await PatientProfessional.count();
    if (relCount === 0) {
      console.log('[Auto-seed] Asignando pacientes existentes a profesionales...');
      const existingPatients = await Patient.findAll();
      const existingProfessionals = await Professional.findAll();
      const pairs = [];
      for (const p of existingPatients) {
        for (const prof of existingProfessionals) {
          pairs.push({ patientId: p.id, professionalId: prof.id });
        }
      }
      if (pairs.length > 0) {
        await PatientProfessional.bulkCreate(pairs, { ignoreDuplicates: true });
        console.log(`[Auto-seed] Asignados ${existingPatients.length} pacientes a ${existingProfessionals.length} profesionales (${pairs.length} relaciones).`);
      }
    }
  } catch (profSeedErr) {
    console.error('[Auto-seed PatientProfessional error]', profSeedErr.message);
  }

  initBirthdayCron();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Unable to connect to the database:', err);
});

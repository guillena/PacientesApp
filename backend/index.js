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

// Basic Route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

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
    const queryInterface = sequelize.getQueryInterface();
    const tableDescription = await queryInterface.describeTable('Appointments');
    if (!tableDescription.confirmed) {
      await queryInterface.addColumn('Appointments', 'confirmed', {
        type: require('sequelize').DataTypes.BOOLEAN,
        defaultValue: false
      });
      console.log('[Migration] Added column "confirmed" to Appointments table successfully');
    }
  } catch (migErr) {
    console.log('[Migration check]', migErr.message);
  }

  initBirthdayCron();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Unable to connect to the database:', err);
});

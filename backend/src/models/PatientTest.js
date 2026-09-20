const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PatientTest = sequelize.define('PatientTest', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  testId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  }
}, {
  tableName: 'PatientTests',
});

module.exports = PatientTest;

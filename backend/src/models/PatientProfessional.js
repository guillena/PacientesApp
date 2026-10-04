const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PatientProfessional = sequelize.define('PatientProfessional', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  patientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Patients',
      key: 'id'
    }
  },
  professionalId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Professionals',
      key: 'id'
    }
  }
}, {
  tableName: 'PatientProfessionals',
  indexes: [
    {
      unique: true,
      fields: ['patientId', 'professionalId']
    }
  ]
});

module.exports = PatientProfessional;

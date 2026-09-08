const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Appointment = sequelize.define('Appointment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'completed', 'cancelled'),
    defaultValue: 'scheduled'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  attended: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  confirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  repetitionId: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

module.exports = Appointment;

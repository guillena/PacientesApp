const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Professional = require('./Professional');
const ProfDocType = require('./ProfDocType');

const ProfessionalDocument = sequelize.define('ProfessionalDocument', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  professionalId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Professional,
      key: 'id'
    }
  },
  profDocTypeId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: ProfDocType,
      key: 'id'
    }
  },
  fileUrl: {
    type: DataTypes.STRING,
    allowNull: false
  },
  originalName: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

module.exports = ProfessionalDocument;

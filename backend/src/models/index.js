const sequelize = require('../config/database');
const Benefit = require('./Benefit');
const DocumentType = require('./DocumentType');
const Professional = require('./Professional');
const Patient = require('./Patient');
const Appointment = require('./Appointment');
const ProfessionalBenefits = require('./ProfessionalBenefits');
const Activity = require('./Activity');
const PatientDocument = require('./PatientDocument');
const Task = require('./Task');
const Test = require('./Test');
const PatientTest = require('./PatientTest');
const ProfDocType = require('./ProfDocType');
const ProfessionalDocument = require('./ProfessionalDocument');

// Associations

// Professional <-> Benefit (Many-to-Many)
Professional.belongsToMany(Benefit, { 
  through: ProfessionalBenefits, 
  foreignKey: { name: 'ProfessionalId', allowNull: false, unique: false },
  otherKey: { name: 'BenefitId', allowNull: false, unique: false }
});
Benefit.belongsToMany(Professional, { 
  through: ProfessionalBenefits, 
  foreignKey: { name: 'BenefitId', allowNull: false, unique: false },
  otherKey: { name: 'ProfessionalId', allowNull: false, unique: false }
});

// DocumentType -> Patient (One-to-Many)
DocumentType.hasMany(Patient, { foreignKey: 'docTypeId' });
Patient.belongsTo(DocumentType, { foreignKey: 'docTypeId' });

// Patient -> Appointment (One-to-Many)
Patient.hasMany(Appointment, { foreignKey: 'patientId', onDelete: 'CASCADE' });
Appointment.belongsTo(Patient, { foreignKey: 'patientId' });

// Professional -> Appointment (One-to-Many)
Professional.hasMany(Appointment, { foreignKey: 'professionalId' });
Appointment.belongsTo(Professional, { foreignKey: 'professionalId' });

// Benefit -> Appointment (One-to-Many)
Benefit.hasMany(Appointment, { foreignKey: 'benefitId', onDelete: 'CASCADE' });
Appointment.belongsTo(Benefit, { foreignKey: 'benefitId' });

// Patient -> Activity (One-to-Many)
Patient.hasMany(Activity, { foreignKey: 'patientId', onDelete: 'CASCADE' });
Activity.belongsTo(Patient, { foreignKey: 'patientId' });

// Patient -> PatientDocument (One-to-Many)
Patient.hasMany(PatientDocument, { foreignKey: 'patientId', onDelete: 'CASCADE' });
PatientDocument.belongsTo(Patient, { foreignKey: 'patientId' });

// Professional -> Activity (One-to-Many)
Professional.hasMany(Activity, { foreignKey: 'professionalId' });
Activity.belongsTo(Professional, { foreignKey: 'professionalId' });

// Patient <-> Test (Many-to-Many)
Patient.hasMany(PatientTest, { foreignKey: 'patientId', onDelete: 'CASCADE' });
PatientTest.belongsTo(Patient, { foreignKey: 'patientId' });
Test.hasMany(PatientTest, { foreignKey: 'testId', onDelete: 'CASCADE' });
PatientTest.belongsTo(Test, { foreignKey: 'testId' });

// Professional -> ProfessionalDocument (One-to-Many)
Professional.hasMany(ProfessionalDocument, { foreignKey: 'professionalId', onDelete: 'CASCADE' });
ProfessionalDocument.belongsTo(Professional, { foreignKey: 'professionalId' });

// ProfDocType -> ProfessionalDocument (One-to-Many)
ProfDocType.hasMany(ProfessionalDocument, { foreignKey: 'profDocTypeId', onDelete: 'RESTRICT' });
ProfessionalDocument.belongsTo(ProfDocType, { foreignKey: 'profDocTypeId' });

module.exports = {
  sequelize,
  Benefit,
  DocumentType,
  Professional,
  Patient,
  Appointment,
  Activity,
  PatientDocument,
  Task,
  Test,
  PatientTest,
  ProfDocType,
  ProfessionalDocument
};

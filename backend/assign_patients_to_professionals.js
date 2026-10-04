const { sequelize, Patient, Professional, PatientProfessional } = require('./src/models');

async function assignPatientsToProfessionals() {
  try {
    console.log('Iniciando sincronización de tabla PatientProfessionals...');
    // Asegurar que la tabla y sus índices existan en la base de datos (PostgreSQL o SQLite)
    await PatientProfessional.sync();
    console.log('Tabla PatientProfessionals sincronizada correctamente.');

    console.log('Obteniendo pacientes y profesionales existentes...');
    const patients = await Patient.findAll();
    const professionals = await Professional.findAll();

    console.log(`Pacientes encontrados: ${patients.length}`);
    console.log(`Profesionales encontrados: ${professionals.length}`);

    if (patients.length === 0 || professionals.length === 0) {
      console.log('No hay pacientes o profesionales suficientes para asignar.');
      process.exit(0);
    }

    const pairs = [];
    for (const patient of patients) {
      for (const professional of professionals) {
        pairs.push({
          patientId: patient.id,
          professionalId: professional.id
        });
      }
    }

    console.log(`Generando ${pairs.length} relaciones entre pacientes y profesionales...`);
    const result = await PatientProfessional.bulkCreate(pairs, {
      ignoreDuplicates: true
    });

    const totalCount = await PatientProfessional.count();
    console.log(`¡Proceso completado con éxito! Total de relaciones actuales en la BD: ${totalCount}`);
    process.exit(0);
  } catch (error) {
    console.error('Error durante la sincronización y asignación:', error);
    process.exit(1);
  }
}

assignPatientsToProfessionals();

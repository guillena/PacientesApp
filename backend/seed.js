const bcrypt = require('bcryptjs');
const { Professional, DocumentType, Benefit, ProfDocType, sequelize } = require('./src/models');
const { seedTests } = require('./src/utils/seedTests');

const seed = async () => {
  try {
    // Sync Database Schema
    console.log('--- ESTRUCTURA ACTUAL DE LA BD ---');
    const tables = await sequelize.getQueryInterface().showAllTables();
    for (const table of tables) {
      if (typeof table === 'string') {
        const description = await sequelize.getQueryInterface().describeTable(table);
        console.log(`Tabla: ${table}`, JSON.stringify(description, null, 2));
      }
    }
    console.log('--- FIN ESTRUCTURA ACTUAL ---');
    
    await sequelize.sync({ force: true });

    // Create Document Types
    await DocumentType.findOrCreate({ where: { name: 'DNI' } });
    await DocumentType.findOrCreate({ where: { name: 'Pasaporte' } });

    // Create Professional Document Types
    await ProfDocType.findOrCreate({
      where: { name: 'DNI' },
      defaults: { name: 'DNI', description: 'Documento Nacional de Identidad', status: true }
    });

    // Create Default Benefits
    const benefits = [
      { name: 'Consulta Médica', description: 'Atención general de primer nivel' },
      { name: 'Kinesiología', description: 'Rehabilitación y fisioterapia' },
      { name: 'Psicología', description: 'Terapia individual' }
    ];

    for (const b of benefits) {
      await Benefit.findOrCreate({
        where: { name: b.name },
        defaults: b
      });
    }

    // Create or Update Admin User
    const password = await bcrypt.hash('admin123', 8);
    let [admin, created] = await Professional.findOrCreate({
      where: { username: 'admin' },
      defaults: {
        firstName: 'Admin',
        lastName: 'Kumespacio',
        username: 'admin',
        password: password,
        role: 'admin'
      }
    });

    if (!created) {
      await admin.update({ password });
      console.log('ℹ️ El usuario Admin ya existía, se ha actualizado su contraseña.');
    } else {
      console.log('✅ Usuario Admin creado con éxito: admin (usuario) / admin123 (clave)');
    }

    // Seed Tests catalogue
    await seedTests();

    process.exit(0);
  } catch (e) {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  }
};

seed();

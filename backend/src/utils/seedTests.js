const { Test } = require('../models');
const testsData = require('./testsData.json');

const seedTests = async () => {
  try {
    let createdCount = 0;
    let existingCount = 0;

    for (const item of testsData) {
      const [test, created] = await Test.findOrCreate({
        where: {
          name: item.name.trim(),
          category: item.category.trim()
        },
        defaults: {
          name: item.name.trim(),
          category: item.category.trim(),
          active: true
        }
      });

      if (created) {
        createdCount++;
      } else {
        existingCount++;
      }
    }

    console.log(`[Seed Tests] Completado: ${createdCount} creados, ${existingCount} ya existían. Total en catálogo: ${testsData.length}`);
    return { createdCount, existingCount, total: testsData.length };
  } catch (error) {
    console.error('[Seed Tests] Error al sembrar catálogo de pruebas:', error);
    throw error;
  }
};

module.exports = { seedTests };

if (require.main === module) {
  const { sequelize } = require('../models');
  sequelize.sync().then(async () => {
    await seedTests();
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

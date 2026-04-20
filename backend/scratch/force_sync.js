const { sequelize } = require('../src/models');

sequelize.sync({ alter: true })
  .then(() => {
    console.log('Database synced with alter:true');
    process.exit(0);
  })
  .catch(err => {
    console.error('Sync error:', err);
    process.exit(1);
  });

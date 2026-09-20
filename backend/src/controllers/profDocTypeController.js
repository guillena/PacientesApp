const { ProfDocType } = require('../models');

const getProfDocTypes = async (req, res) => {
  try {
    const types = await ProfDocType.findAll();
    res.send(types);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

const createProfDocType = async (req, res) => {
  try {
    const type = await ProfDocType.create(req.body);
    res.status(201).send(type);
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
};

const updateProfDocType = async (req, res) => {
  try {
    const type = await ProfDocType.findByPk(req.params.id);
    if (!type) return res.status(404).send({ error: 'Tipo de documento no encontrado' });
    await type.update(req.body);
    res.send(type);
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
};

const deleteProfDocType = async (req, res) => {
  try {
    const type = await ProfDocType.findByPk(req.params.id);
    if (!type) return res.status(404).send({ error: 'Tipo de documento no encontrado' });
    
    // Deleting might fail if there are constraints, but that's fine for now or handle RESTRICT error
    await type.destroy();
    res.send({ message: 'Tipo eliminado correctamente' });
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

module.exports = {
  getProfDocTypes,
  createProfDocType,
  updateProfDocType,
  deleteProfDocType
};

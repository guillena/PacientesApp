const { Activity, Professional } = require('../models');

const createActivity = async (req, res) => {
  try {
    const { patientId, description } = req.body;
    const professionalId = req.professional.id; // from auth middleware

    const activity = await Activity.create({
      patientId,
      professionalId,
      description
    });

    const populatedActivity = await Activity.findByPk(activity.id, {
      include: [
        { model: Professional, attributes: ['id', 'firstName', 'lastName'] }
      ]
    });

    res.status(201).send(populatedActivity);
  } catch (e) {
    res.status(400).send(e);
  }
};

const getPatientActivities = async (req, res) => {
  try {
    const { patientId } = req.params;

    const activities = await Activity.findAll({
      where: { patientId },
      include: [
        { model: Professional, attributes: ['id', 'firstName', 'lastName'] }
      ],
      order: [['date', 'DESC']]
    });

    res.send(activities);
  } catch (e) {
    res.status(500).send(e);
  }
};

const updateActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { description } = req.body;
    const activity = await Activity.findByPk(id);
    if (!activity) return res.status(404).send();
    
    activity.description = description;
    await activity.save();
    
    const populatedActivity = await Activity.findByPk(activity.id, {
      include: [{ model: Professional, attributes: ['id', 'firstName', 'lastName'] }]
    });
    res.send(populatedActivity);
  } catch (e) {
    res.status(400).send(e);
  }
};

const deleteActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const activity = await Activity.findByPk(id);
    if (!activity) return res.status(404).send();
    
    await activity.destroy();
    res.send({ message: 'Actividad eliminada' });
  } catch (e) {
    res.status(500).send(e);
  }
};

module.exports = { createActivity, getPatientActivities, updateActivity, deleteActivity };

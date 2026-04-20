const { Appointment, Patient, Benefit, Professional } = require('../models');
const { Op } = require('sequelize');

const createAppointment = async (req, res) => {
  try {
    const { patientId, benefitId, startTime, endTime, notes, attended, repetitionId } = req.body;
    let professionalId = req.professional.id; // Default to self

    console.log('CREATING APPOINTMENT:', req.body);

    // If admin, allow passing professionalId, if none passed, it remains admin's own ID
    if (req.professional.role === 'admin' && req.body.professionalId) {
      professionalId = req.body.professionalId;
    }

    const appointment = await Appointment.create({
      patientId,
      professionalId,
      benefitId,
      startTime,
      endTime,
      notes,
      attended,
      repetitionId
    });

    res.status(201).send(appointment);
  } catch (e) {
    console.error('APPOINTMENT CREATE ERROR:', e);
    res.status(400).send({ error: e.message || 'Error creating appointment' });
  }
};

const getAppointments = async (req, res) => {
  try {
    const { start, end, professionalId, benefitId } = req.query;
    const where = {};

    if (start && end) {
      where.startTime = { [Op.between]: [new Date(start), new Date(end)] };
    }

    if (req.professional.role === 'professional') {
      // Professionals can ONLY see their own appointments
      where.professionalId = req.professional.id;
    } else {
      // Admins can see all, or filter by a specific professional
      if (professionalId) where.professionalId = professionalId;
    }

    if (benefitId) where.benefitId = benefitId;

    const appointments = await Appointment.findAll({
      where,
      include: [
        { model: Patient },
        { model: Professional, attributes: ['firstName', 'lastName', 'role', 'color'] },
        { model: Benefit, attributes: ['name', 'isAdmission'] }
      ]
    });

    res.send(appointments);
  } catch (e) {
    res.status(500).send(e);
  }
};

const updateAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) return res.status(404).send();

    // Check permissions
    if (req.professional.role !== 'admin' && appointment.professionalId !== req.professional.id) {
      return res.status(403).send({ error: 'No permissions' });
    }

    await appointment.update(req.body);
    res.send(appointment);
  } catch (e) {
    console.error('APPOINTMENT UPDATE ERROR:', e);
    res.status(400).send({ error: e.message || 'Error updating appointment' });
  }
};

const deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) return res.status(404).send();

    // Check permissions
    if (req.professional.role !== 'admin' && appointment.professionalId !== req.professional.id) {
      return res.status(403).send({ error: 'No permissions' });
    }

    await appointment.destroy();
    res.send();
  } catch (e) {
    res.status(500).send(e);
  }
};

const getPatientAppointments = async (req, res) => {
  try {
    const { patientId } = req.params;
    const appointments = await Appointment.findAll({
      where: { patientId },
      include: [
        { model: Professional, attributes: ['firstName', 'lastName'] },
        { model: Benefit, attributes: ['name'] }
      ],
      order: [['startTime', 'DESC']]
    });
    res.send(appointments);
  } catch (e) {
    res.status(500).send(e);
  }
};

module.exports = { 
  createAppointment, 
  getAppointments, 
  updateAppointment, 
  deleteAppointment,
  getPatientAppointments
};

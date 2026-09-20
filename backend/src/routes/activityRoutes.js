const express = require('express');
const router = express.Router();
const { auth, isAdmin } = require('../middleware/auth');
const activityController = require('../controllers/activityController');

router.post('/', auth, activityController.createActivity);
router.get('/patient/:patientId', auth, activityController.getPatientActivities);
router.patch('/:id', auth, isAdmin, activityController.updateActivity);
router.delete('/:id', auth, isAdmin, activityController.deleteActivity);

module.exports = router;

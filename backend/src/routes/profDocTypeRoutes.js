const express = require('express');
const { getProfDocTypes, createProfDocType, updateProfDocType, deleteProfDocType } = require('../controllers/profDocTypeController');
const { auth, isAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, isAdmin, getProfDocTypes);
router.post('/', auth, isAdmin, createProfDocType);
router.patch('/:id', auth, isAdmin, updateProfDocType);
router.delete('/:id', auth, isAdmin, deleteProfDocType);

module.exports = router;

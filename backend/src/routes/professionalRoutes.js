const express = require('express');
const { createProfessional, getProfessionals, updateProfessional, deleteProfessional, downloadAllFiles } = require('../controllers/professionalController');
const { auth, isAdmin } = require('../middleware/auth');
const router = express.Router();

const upload = require('../middleware/upload');
const { getDocuments, uploadDocument, deleteDocument, getProfessionalDocument } = require('../controllers/professionalDocumentController');
const { generatePhotoToken } = require('../controllers/mobilePhotoController');

router.post('/', auth, isAdmin, createProfessional);
router.get('/', auth, isAdmin, getProfessionals);
router.get('/download-all', auth, isAdmin, downloadAllFiles);
router.patch('/:id', auth, isAdmin, updateProfessional);
router.delete('/:id', auth, isAdmin, deleteProfessional);

// Document handling endpoints
router.get('/documents/:documentId/view', auth, getProfessionalDocument);
router.get('/:professionalId/documents', auth, isAdmin, getDocuments);
router.post('/:professionalId/documents', auth, isAdmin, upload.single('file'), uploadDocument);
router.delete('/:professionalId/documents/:documentId', auth, isAdmin, deleteDocument);

// QR Photo upload token generation
router.post('/:professionalId/photo-token', auth, isAdmin, generatePhotoToken);

module.exports = router;

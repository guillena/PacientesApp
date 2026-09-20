const express = require('express');
const { 
  getTests, 
  getCategories, 
  createTest, 
  updateTest, 
  deleteTest 
} = require('../controllers/testController');
const { auth, isAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, getTests);
router.get('/categories', auth, getCategories);
router.post('/', auth, isAdmin, createTest);
router.patch('/:id', auth, isAdmin, updateTest);
router.delete('/:id', auth, isAdmin, deleteTest);

module.exports = router;

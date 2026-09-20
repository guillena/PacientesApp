const { Op } = require('sequelize');
const { Test, sequelize } = require('../models');

// GET /api/tests - List all tests with optional search and category filters
const getTests = async (req, res) => {
  try {
    const { search, category } = req.query;
    const where = {};

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { name: { [Op.iLike ? Op.iLike : Op.like]: term } },
        { description: { [Op.iLike ? Op.iLike : Op.like]: term } }
      ];
    }

    const tests = await Test.findAll({
      where,
      order: [
        ['category', 'ASC'],
        ['name', 'ASC']
      ]
    });

    res.send(tests);
  } catch (error) {
    console.error('Error fetching tests:', error);
    res.status(500).send({ error: 'Error al obtener la lista de pruebas' });
  }
};

// GET /api/tests/categories - List unique categories
const getCategories = async (req, res) => {
  try {
    const categories = await Test.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('category')), 'category']
      ],
      order: [['category', 'ASC']]
    });

    const categoryList = categories.map(c => c.category).filter(Boolean);
    res.send(categoryList);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).send({ error: 'Error al obtener las categorías' });
  }
};

// POST /api/tests - Create a new test
const createTest = async (req, res) => {
  try {
    const { name, category, description, active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).send({ error: 'El nombre de la prueba es obligatorio' });
    }
    if (!category || !category.trim()) {
      return res.status(400).send({ error: 'La categoría es obligatoria' });
    }

    // Check if duplicate exists for the same category
    const existing = await Test.findOne({
      where: {
        name: name.trim(),
        category: category.trim()
      }
    });

    if (existing) {
      return res.status(400).send({ error: `Ya existe una prueba con el nombre "${name.trim()}" en la categoría "${category.trim()}"` });
    }

    const test = await Test.create({
      name: name.trim(),
      category: category.trim(),
      description: description ? description.trim() : null,
      active: active !== undefined ? active : true
    });

    res.status(201).send(test);
  } catch (error) {
    console.error('Error creating test:', error);
    res.status(400).send({ error: error.message || 'Error al crear la prueba' });
  }
};

// PATCH /api/tests/:id - Update an existing test
const updateTest = async (req, res) => {
  try {
    const { id } = req.params;
    const test = await Test.findByPk(id);

    if (!test) {
      return res.status(404).send({ error: 'Prueba no encontrada' });
    }

    const { name, category, description, active } = req.body;

    // Check uniqueness if name or category are being changed
    if ((name && name.trim() !== test.name) || (category && category.trim() !== test.category)) {
      const targetName = name ? name.trim() : test.name;
      const targetCategory = category ? category.trim() : test.category;

      const duplicate = await Test.findOne({
        where: {
          name: targetName,
          category: targetCategory,
          id: { [Op.ne]: id }
        }
      });

      if (duplicate) {
        return res.status(400).send({ error: `Ya existe otra prueba con el nombre "${targetName}" en la categoría "${targetCategory}"` });
      }
    }

    await test.update({
      name: name !== undefined ? name.trim() : test.name,
      category: category !== undefined ? category.trim() : test.category,
      description: description !== undefined ? (description ? description.trim() : null) : test.description,
      active: active !== undefined ? active : test.active
    });

    res.send(test);
  } catch (error) {
    console.error('Error updating test:', error);
    res.status(400).send({ error: error.message || 'Error al actualizar la prueba' });
  }
};

// DELETE /api/tests/:id - Delete a test
const deleteTest = async (req, res) => {
  try {
    const { id } = req.params;
    const test = await Test.findByPk(id);

    if (!test) {
      return res.status(404).send({ error: 'Prueba no encontrada' });
    }

    await test.destroy();
    res.send({ message: 'Prueba eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting test:', error);
    res.status(500).send({ error: error.message || 'Error al eliminar la prueba' });
  }
};

module.exports = {
  getTests,
  getCategories,
  createTest,
  updateTest,
  deleteTest
};

const { Task } = require('../models');

const getTasks = async (req, res) => {
  try {
    const tasks = await Task.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.send(tasks);
  } catch (e) {
    res.status(500).send(e);
  }
};

const createTask = async (req, res) => {
  try {
    console.log('CREATING TASK:', req.body);
    const task = await Task.create(req.body);
    res.status(201).send(task);
  } catch (e) {
    console.error('TASK CREATE ERROR:', e);
    res.status(400).send(e);
  }
};

const updateTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).send();
    await task.update(req.body);
    res.send(task);
  } catch (e) {
    res.status(400).send(e);
  }
};

const deleteTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task) return res.status(404).send();
    await task.destroy();
    res.send({ message: 'Task deleted' });
  } catch (e) {
    res.status(500).send(e);
  }
};

module.exports = {
  getTasks,
  createTask,
  updateTask,
  deleteTask
};

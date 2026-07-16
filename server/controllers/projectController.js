const Project = require('../models/Project');
const History = require('../models/History');

// ================= CREATE PROJECT =================
const createProject = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Project ka naam zaroori hai.' });
    }

    const project = await Project.create({
      user: req.user._id,
      name,
      description: description || ''
    });

    res.status(201).json({ message: 'Project ban gaya.', project });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// ================= GET ALL PROJECTS (with item count) =================
const getProjects = async (req, res) => {
  try {
    const projects = await Project.find({ user: req.user._id }).sort({ createdAt: -1 });

    // attach a count of how many history items belong to each project
    const projectsWithCounts = await Promise.all(
      projects.map(async (p) => {
        const count = await History.countDocuments({ project: p._id, user: req.user._id });
        return { ...p.toObject(), itemCount: count };
      })
    );

    res.status(200).json({ projects: projectsWithCounts });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// ================= GET ONE PROJECT + ITS ITEMS =================
const getProjectById = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: 'Project nahi mila.' });
    }

    const items = await History.find({ project: project._id, user: req.user._id }).sort({ createdAt: -1 });

    res.status(200).json({ project, items });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// ================= DELETE PROJECT (unassign its items, don't delete the audio) =================
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, user: req.user._id });
    if (!project) {
      return res.status(404).json({ message: 'Project nahi mila.' });
    }

    // Un-assign history items rather than deleting the audio itself
    await History.updateMany({ project: project._id }, { $set: { project: null } });
    await project.deleteOne();

    res.status(200).json({ message: 'Project delete ho gaya (audios History mein mahfooz hain).' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

module.exports = { createProject, getProjects, getProjectById, deleteProject };
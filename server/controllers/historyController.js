const History = require('../models/History');

const getHistory = async (req, res) => {
  try {
    const history = await History.find({ user: req.user._id })
      .populate('project', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({ history });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const deleteHistoryItem = async (req, res) => {
  try {
    const item = await History.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'History item nahi mila.' });
    }

    if (item.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Aap yeh delete nahi kar sakte.' });
    }

    await item.deleteOne();

    res.status(200).json({ message: 'History item delete ho gaya.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// ================= ASSIGN / UNASSIGN A HISTORY ITEM TO A PROJECT =================
const assignToProject = async (req, res) => {
  try {
    const { projectId } = req.body; // pass null/empty to unassign

    const item = await History.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'History item nahi mila.' });
    }

    if (item.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Aap yeh update nahi kar sakte.' });
    }

    item.project = projectId || null;
    await item.save();

    res.status(200).json({ message: 'Project update ho gaya.', item });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

module.exports = { getHistory, deleteHistoryItem, assignToProject };
const User = require('../models/User');
const Voice = require('../models/Voice');
const History = require('../models/History');

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Role sirf "user" ya "admin" ho sakta hai.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User nahi mila.' });
    }

    user.role = role;
    await user.save();

    res.status(200).json({ message: `User ab "${role}" ban gaya.`, user });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User nahi mila.' });
    }

    await user.deleteOne();
    res.status(200).json({ message: 'User delete ho gaya.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const totalVoices = await Voice.countDocuments();
    const totalGenerations = await History.countDocuments();

    res.status(200).json({ totalUsers, totalAdmins, totalVoices, totalGenerations });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// ================= ALL ACTIVITY (every user's generation history, for admin) =================
const getAllActivity = async (req, res) => {
  try {
    // populate() pulls in the related user's name/email instead of just the ID
    const activity = await History.find()
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .limit(200); // safety cap so this doesn't get huge

    res.status(200).json({ activity });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

module.exports = { getAllUsers, updateUserRole, deleteUser, getDashboardStats, getAllActivity };
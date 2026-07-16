const User = require('../models/User');

const DAILY_FREE_LIMIT = 20;

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User nahi mila.' });
    }
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User nahi mila.' });
    }

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;

    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.status(200).json({
      message: 'Profile update ho gayi.',
      user: { id: updatedUser._id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// ================= GET TODAY'S USAGE (for daily free-plan limit) =================
const getUsage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User nahi mila.' });
    }

    // Admins have unlimited generations
    if (user.role === 'admin') {
      return res.status(200).json({ used: 0, limit: null, remaining: null, unlimited: true });
    }

    const today = new Date().toDateString();
    const lastDate = user.lastGenerationDate ? new Date(user.lastGenerationDate).toDateString() : null;

    // If it's a new day, the count effectively resets (without writing to DB yet)
    const used = lastDate === today ? user.dailyGenerationCount : 0;
    const remaining = Math.max(0, DAILY_FREE_LIMIT - used);

    res.status(200).json({ used, limit: DAILY_FREE_LIMIT, remaining, unlimited: false });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

module.exports = { getProfile, updateProfile, getUsage };
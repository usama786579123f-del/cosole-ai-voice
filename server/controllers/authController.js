const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// ================= SIGNUP =================
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Sab fields bharna zaroori hai.' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'Yeh email pehle se registered hai.' });
    }

    const user = await User.create({ name, email, password });
    const token = generateToken(user._id);

    res.status(201).json({
      message: 'Account successfully ban gaya.',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('❌ SIGNUP ERROR:', error); // Ab terminal mein bhi dikhega
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// ================= LOGIN =================
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email aur password dono chahiye.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Email ya password galat hai.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email ya password galat hai.' });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('❌ LOGIN ERROR:', error);
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

// ================= LOGGED-IN USER KI DETAILS =================
const getMe = async (req, res) => {
  res.status(200).json({ user: req.user });
};

module.exports = { registerUser, loginUser, getMe };
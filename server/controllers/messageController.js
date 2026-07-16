const Message = require('../models/Message');

const createMessage = async (req, res) => {
  try {
    const { name, email, topic, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: 'Name, email, aur message zaroori hain.' });
    }

    const newMessage = await Message.create({ name, email, topic, message });

    res.status(201).json({
      message: 'Aap ka message mil gaya hai. Hum jald hi contact karenge.',
      data: newMessage
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const getAllMessages = async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    res.status(200).json({ messages });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'Message nahi mila.' });
    }
    message.status = 'read';
    await message.save();
    res.status(200).json({ message: 'Marked as read.', data: message });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ message: 'Message nahi mila.' });
    }
    await message.deleteOne();
    res.status(200).json({ message: 'Message delete ho gaya.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

module.exports = { createMessage, getAllMessages, markAsRead, deleteMessage };
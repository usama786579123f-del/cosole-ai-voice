const ApiKey = require('../models/ApiKey');

const getApiKey = async (req, res) => {
  try {
    let apiKey = await ApiKey.findOne({ user: req.user._id });

    if (!apiKey) {
      apiKey = await ApiKey.create({
        user: req.user._id,
        key: ApiKey.generateKey()
      });
    }

    res.status(200).json({ apiKey: apiKey.key, lastUsed: apiKey.lastUsed, createdAt: apiKey.createdAt });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const regenerateApiKey = async (req, res) => {
  try {
    const newKey = ApiKey.generateKey();

    let apiKey = await ApiKey.findOne({ user: req.user._id });

    if (apiKey) {
      apiKey.key = newKey;
      apiKey.lastUsed = null;
      await apiKey.save();
    } else {
      apiKey = await ApiKey.create({ user: req.user._id, key: newKey });
    }

    res.status(200).json({ message: 'API key regenerated.', apiKey: apiKey.key });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

module.exports = { getApiKey, regenerateApiKey };
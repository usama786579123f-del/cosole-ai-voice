const Voice = require('../models/Voice');
const History = require('../models/History');

const generateVoice = async (req, res) => {
  try {
    const { text, voiceId } = req.body;

    if (!text || !voiceId) {
      return res.status(400).json({ message: 'Text aur voiceId dono chahiye.' });
    }

    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'Cartesia-Version': '2026-03-01',
        'X-API-Key': process.env.CARTESIA_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_id: 'sonic-3.5',
        transcript: text,
        voice: { mode: 'id', id: voiceId },
        output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 44100 }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ message: 'Cartesia API error.', error: errorText });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const audioBase64 = audioBuffer.toString('base64');
    const audioUrl = `data:audio/mp3;base64,${audioBase64}`;

    const voiceDoc = await Voice.findOne({ voiceId });

    await History.create({
      user: req.user._id,
      text,
      voice: voiceDoc ? voiceDoc._id : null,
      voiceName: voiceDoc ? voiceDoc.name : 'Unknown',
      audioUrl
    });

    res.status(200).json({ message: 'Audio successfully ban gaya.', audioUrl });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const getVoices = async (req, res) => {
  try {
    const voices = await Voice.find();
    res.status(200).json({ voices });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

const addVoice = async (req, res) => {
  try {
    const { name, voiceId, language, gender, previewUrl, isPremium } = req.body;

    const voiceExists = await Voice.findOne({ voiceId });
    if (voiceExists) {
      return res.status(400).json({ message: 'Yeh voice pehle se maujood hai.' });
    }

    const voice = await Voice.create({ name, voiceId, language, gender, previewUrl, isPremium });

    res.status(201).json({ message: 'Voice add ho gayi.', voice });
  } catch (error) {
    res.status(500).json({ message: 'Server error.', error: error.message });
  }
};

module.exports = { generateVoice, getVoices, addVoice };
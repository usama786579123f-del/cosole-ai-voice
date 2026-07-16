require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const connectDB = require('./config/db');
const History = require('./models/History');
const ApiKey = require('./models/ApiKey');
const User = require('./models/User');

const DAILY_FREE_LIMIT = 20;

const app = express();
const PORT = process.env.PORT || 3000;
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const CARTESIA_BASE_URL = 'https://api.cartesia.ai';
const CARTESIA_VERSION = '2026-03-01';

if (!CARTESIA_API_KEY) {
  console.warn('\n⚠️  CARTESIA_API_KEY was not found in .env!\n');
}

connectDB();

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const historyRoutes = require('./routes/historyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const apiKeyRoutes = require('./routes/apiKeyRoutes');
const messageRoutes = require('./routes/messageRoutes');
const projectRoutes = require('./routes/projectRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/apikey', apiKeyRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/projects', projectRoutes);

function cartesiaHeaders(extra = {}) {
  return {
    'Authorization': `Bearer ${CARTESIA_API_KEY}`,
    'X-API-Key': CARTESIA_API_KEY,
    'Cartesia-Version': CARTESIA_VERSION,
    ...extra,
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, apiKeyConfigured: Boolean(CARTESIA_API_KEY) });
});

app.get('/api/voices', async (req, res) => {
  try {
    let allVoices = [];
    let cursor = null;
    let hasMore = true;
    let safety = 0;

    while (hasMore && safety < 25) {
      const url = new URL(`${CARTESIA_BASE_URL}/voices`);
      url.searchParams.set('limit', '100');
      if (cursor) url.searchParams.set('starting_after', cursor);

      const response = await fetch(url, { headers: cartesiaHeaders() });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: 'Could not load voices from Cartesia', details: errText });
      }

      const data = await response.json();
      const pageVoices = Array.isArray(data) ? data : data.data || [];
      allVoices = allVoices.concat(pageVoices);

      hasMore = Boolean(data.has_more) && pageVoices.length > 0;
      cursor = pageVoices.length ? pageVoices[pageVoices.length - 1].id : null;
      safety++;
    }

    res.json({ voices: allVoices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching voices', details: err.message });
  }
});

const SUPPORTED_EMOTIONS = new Set([
  'neutral', 'calm', 'peaceful', 'serene', 'content',
  'happy', 'excited', 'enthusiastic', 'elated', 'euphoric', 'triumphant', 'amazed', 'surprised', 'curious', 'flirtatious', 'grateful', 'affectionate', 'trust', 'sympathetic', 'proud', 'confident', 'anticipation',
  'angry', 'mad', 'outraged', 'frustrated', 'agitated', 'threatened', 'disgusted', 'contempt', 'envious', 'sarcastic', 'ironic',
  'sad', 'dejected', 'melancholic', 'disappointed', 'hurt', 'guilty', 'bored', 'tired', 'rejected', 'nostalgic', 'wistful', 'apologetic',
  'hesitant', 'insecure', 'confused', 'resigned', 'anxious', 'panicked', 'alarmed', 'scared',
  'mysterious', 'distant', 'skeptical', 'contemplative', 'determined'
]);

function callCartesiaTts(payload) {
  return fetch(`${CARTESIA_BASE_URL}/tts/bytes`, {
    method: 'POST',
    headers: cartesiaHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
}

// ===== Helper: identify the calling user via JWT Bearer token OR X-API-Key header =====
async function identifyUser(req) {
  // 1) Try X-API-Key header first (for external/API usage)
  const apiKeyHeader = req.headers['x-api-key'];
  if (apiKeyHeader) {
    const found = await ApiKey.findOne({ key: apiKeyHeader });
    if (found) {
      found.lastUsed = new Date();
      await found.save();
      return found.user; // ObjectId
    }
    return null; // invalid key provided
  }

  // 2) Fall back to JWT Bearer token (for the web app itself)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded.id;
    } catch (err) {
      return null;
    }
  }

  return null; // no auth provided — anonymous request
}

app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceId, speed, emotion, laughter, language } = req.body;

    if (!text || !voiceId) {
      return res.status(400).json({ error: 'text and voiceId are both required' });
    }

    // ===== Identify the user (if any) and enforce the daily free-plan limit =====
    const userId = await identifyUser(req);
    let userDoc = null;

    if (userId) {
      userDoc = await User.findById(userId);

      if (userDoc && userDoc.role !== 'admin') {
        const today = new Date().toDateString();
        const lastDate = userDoc.lastGenerationDate ? new Date(userDoc.lastGenerationDate).toDateString() : null;

        if (lastDate !== today) {
          // New day — reset the counter
          userDoc.dailyGenerationCount = 0;
          userDoc.lastGenerationDate = new Date();
        }

        if (userDoc.dailyGenerationCount >= DAILY_FREE_LIMIT) {
          return res.status(403).json({
            error: 'Daily limit reached',
            limitReached: true,
            message: `Aap ne aaj ki ${DAILY_FREE_LIMIT} free voices generate kar li hain. Kal wapis try karein ya Pro plan le lein.`
          });
        }
      }
    }

    const SPEED_MAP = { slow: 0.75, normal: 1.0, fast: 1.3 };
    const numericSpeed = SPEED_MAP[speed] ?? 1.0;
    const finalTranscript = laughter ? `${text} [laughter]` : text;

    const generationConfig = { speed: numericSpeed, volume: 1 };
    if (emotion && SUPPORTED_EMOTIONS.has(emotion)) {
      generationConfig.emotion = emotion;
    }

    const payload = {
      model_id: 'sonic-3.5',
      transcript: finalTranscript,
      voice: { mode: 'id', id: voiceId },
      output_format: { container: 'wav', encoding: 'pcm_f32le', sample_rate: 44100 },
      generation_config: generationConfig,
    };
    if (language) payload.language = language;

    let response = await callCartesiaTts(payload);

    if (!response.ok && response.status === 400 && payload.generation_config.emotion) {
      const errText = await response.text();
      if (/invalid emotion/i.test(errText)) {
        delete payload.generation_config.emotion;
        response = await callCartesiaTts(payload);
      } else {
        return res.status(response.status).json({ error: 'Could not generate audio', details: errText });
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Could not generate audio', details: errText });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());

    // ===== Increment usage + Save to History if we identified the user =====
    if (userDoc) {
      try {
        if (userDoc.role !== 'admin') {
          userDoc.dailyGenerationCount = (userDoc.dailyGenerationCount || 0) + 1;
          userDoc.lastGenerationDate = new Date();
          await userDoc.save();
        }

        const audioBase64 = audioBuffer.toString('base64');
        const audioUrl = `data:audio/wav;base64,${audioBase64}`;

        await History.create({
          user: userDoc._id,
          text,
          voiceName: voiceId,
          audioUrl
        });
      } catch (err) {
        console.error('Could not save history/usage:', err.message);
      }
    }

    res.set('Content-Type', 'audio/wav');
    res.send(audioBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while generating audio', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🎙️  Voice AI Studio server running: http://localhost:${PORT}\n`);
});
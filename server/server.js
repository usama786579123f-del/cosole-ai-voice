// Voice AI Studio — Backend Server
// This server keeps the Cartesia API key safe and forwards requests
// from the browser to Cartesia's API.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const CARTESIA_API_KEY = process.env.CARTESIA_API_KEY;
const CARTESIA_BASE_URL = 'https://api.cartesia.ai';
const CARTESIA_VERSION = '2026-03-01';

if (!CARTESIA_API_KEY) {
  console.warn(
    '\n⚠️  CARTESIA_API_KEY was not found in .env! ' +
    'Copy .env.example to .env and add your key.\n'
  );
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function cartesiaHeaders(extra = {}) {
  return {
    'Authorization': `Bearer ${CARTESIA_API_KEY}`,
    'X-API-Key': CARTESIA_API_KEY,
    'Cartesia-Version': CARTESIA_VERSION,
    ...extra,
  };
}

// ---------- Health check ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, apiKeyConfigured: Boolean(CARTESIA_API_KEY) });
});

// ---------- Voices list — fetches every page so the full library shows up ----------
app.get('/api/voices', async (req, res) => {
  try {
    let allVoices = [];
    let cursor = null;
    let hasMore = true;
    let safety = 0; // guards against an infinite loop if pagination misbehaves

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
      console.log(`Cartesia /voices page ${safety + 1}: got ${pageVoices.length}, has_more=${data.has_more}`);

      hasMore = Boolean(data.has_more) && pageVoices.length > 0;
      cursor = pageVoices.length ? pageVoices[pageVoices.length - 1].id : null;
      safety++;
    }

    console.log(`Total voices fetched: ${allVoices.length}`);
    res.json({ voices: allVoices });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while fetching voices', details: err.message });
  }
});

// ---------- Text-to-Speech generation ----------
// Cartesia's real schema (per current docs) is:
//   generation_config: { speed: 0.6–1.5 (number), volume: 0.5–2.0, emotion: "excited" | "sad" | ... }
// Non-verbal laughter is a literal "[laughter]" tag inserted in the transcript text
// (not a generation_config field) — that's the only inline tag Cartesia documents.
//
// NOTE: "scared" used to be listed here as supported, but Cartesia's API
// actually rejects it with a 400 "invalid emotion: scared" error — that was
// silently breaking every generation where that chip was selected. It's
// removed from the allow-list below, and the matching "Scared" button was
// removed from index.html too. Keep both lists in sync if you add more.
const SUPPORTED_EMOTIONS = new Set(['angry', 'excited', 'content', 'sad']);

function callCartesiaTts(payload) {
  return fetch(`${CARTESIA_BASE_URL}/tts/bytes`, {
    method: 'POST',
    headers: cartesiaHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
}

app.post('/api/tts', async (req, res) => {
  try {
    const { text, voiceId, speed, emotion, laughter, language } = req.body;

    if (!text || !voiceId) {
      return res.status(400).json({ error: 'text and voiceId are both required' });
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
      output_format: {
        container: 'wav',
        encoding: 'pcm_f32le',
        sample_rate: 44100,
      },
      generation_config: generationConfig,
    };
    if (language) payload.language = language;

    let response = await callCartesiaTts(payload);

    // Safety net: if Cartesia ever rejects the emotion value specifically
    // (whether it's one we thought was valid, or a stale value cached in
    // someone's browser from before this fix), retry once without any
    // emotion instead of failing the whole generation.
    if (!response.ok && response.status === 400 && payload.generation_config.emotion) {
      const errText = await response.text();
      if (/invalid emotion/i.test(errText)) {
        console.warn(`Cartesia rejected emotion "${payload.generation_config.emotion}" — retrying without it.`);
        delete payload.generation_config.emotion;
        response = await callCartesiaTts(payload);
      } else {
        console.error('Cartesia TTS error:', response.status, errText);
        return res.status(response.status).json({ error: 'Could not generate audio', details: errText });
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error('Cartesia TTS error:', response.status, errText);
      return res.status(response.status).json({ error: 'Could not generate audio', details: errText });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
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
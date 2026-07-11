// ============ Auth guard (lightweight, local-only) ============
const currentUser = JSON.parse(localStorage.getItem('vas_user') || 'null');
if (!currentUser || !currentUser.name) {
  window.location.href = 'login.html';
  // Stop the rest of this script from running while the redirect happens.
  throw new Error('Redirecting to login…');
}

// Rough country → best-matching Cartesia language code, used only to
// pre-select a sensible starting filter. Cartesia's Sonic models don't ship
// native Urdu voices, so for Pakistan we point to Hindi first (closest
// phonetically) with English as the reliable fallback. Unlisted countries
// default to English.
const COUNTRY_LANGUAGE_HINTS = {
  PK: ['hi', 'en'], IN: ['hi', 'en'], BD: ['hi', 'en'], NP: ['hi', 'en'],
  US: ['en'], GB: ['en'], CA: ['en', 'fr'], AU: ['en'], NZ: ['en'], IE: ['en'], ZA: ['en'],
  AE: ['ar', 'en'], SA: ['ar', 'en'], EG: ['ar', 'en'], IQ: ['ar', 'en'], JO: ['ar', 'en'],
  QA: ['ar', 'en'], KW: ['ar', 'en'], OM: ['ar', 'en'], BH: ['ar', 'en'], MA: ['ar', 'fr'],
  DZ: ['ar', 'fr'], TN: ['ar', 'fr'], LB: ['ar', 'fr'],
  FR: ['fr'], BE: ['fr', 'nl'], CH: ['fr', 'de', 'it'], SN: ['fr'], CI: ['fr'],
  DE: ['de'], AT: ['de'], MX: ['es'], ES: ['es'], AR: ['es'], CO: ['es'], CL: ['es'],
  PE: ['es'], VE: ['es'], EC: ['es'], GT: ['es'], CU: ['es'], BR: ['pt'], PT: ['pt'],
  IT: ['it'], NL: ['nl'], SE: ['sv'], NO: ['no', 'en'], DK: ['da', 'en'], FI: ['fi'],
  PL: ['pl'], RU: ['ru'], UA: ['uk', 'ru'], TR: ['tr'], GR: ['el'], RO: ['ro'],
  HU: ['hu'], CZ: ['cs'], SK: ['sk'], BG: ['bg'], HR: ['hr'],
  CN: ['zh'], HK: ['zh', 'en'], TW: ['zh'], JP: ['ja'], KR: ['ko'],
  VN: ['vi'], TH: ['th'], ID: ['id'], MY: ['ms', 'en'], PH: ['tl', 'en'],
  IL: ['he', 'en'],
};

// Full names for Cartesia's supported language codes — shown in filters and
// on voice cards instead of bare two-letter codes, which are hard to scan.
const LANGUAGE_NAMES = {
  en: 'English', hi: 'Hindi', es: 'Spanish', fr: 'French', de: 'German',
  ja: 'Japanese', zh: 'Chinese', ko: 'Korean', pt: 'Portuguese', it: 'Italian',
  ru: 'Russian', ar: 'Arabic', he: 'Hebrew', sv: 'Swedish', tr: 'Turkish',
  pl: 'Polish', nl: 'Dutch', da: 'Danish', no: 'Norwegian', fi: 'Finnish',
  uk: 'Ukrainian', el: 'Greek', ro: 'Romanian', hu: 'Hungarian', cs: 'Czech',
  sk: 'Slovak', bg: 'Bulgarian', hr: 'Croatian', vi: 'Vietnamese', th: 'Thai',
  id: 'Indonesian', ms: 'Malay', tl: 'Tagalog', ta: 'Tamil', te: 'Telugu',
  bn: 'Bengali', gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', mr: 'Marathi',
  pa: 'Punjabi', ca: 'Catalan',
};
function languageName(code) {
  const base = (code || 'en').toLowerCase();
  return LANGUAGE_NAMES[base] || base.toUpperCase();
}

// Built from the shared WORLD_COUNTRIES list (countries.js) if it loaded.
const COUNTRY_NAMES = typeof WORLD_COUNTRIES !== 'undefined'
  ? Object.fromEntries(WORLD_COUNTRIES)
  : {};
function countryName(code) {
  if (!code) return '';
  return COUNTRY_NAMES[code.toUpperCase()] || code;
}

// ============ State ============
let voices = [];
let selectedVoiceId = null;
let selectedEmotion = '';
let selectedSpeed = 'normal';
let laughterOn = false;
let searchQuery = '';
let languageFilterValue = '';
let countryFilterValue = '';
let audioCtx = null;
let analyser = null;
let sourceNode = null;
let currentObjectUrl = null;
let recStartTime = null;
let recTimerHandle = null;

// ============ Elements ============
const voiceGrid = document.getElementById('voiceGrid');
const voiceCount = document.getElementById('voiceCount');
const voiceSearch = document.getElementById('voiceSearch');
const languageFilter = document.getElementById('languageFilter');
const countryFilter = document.getElementById('countryFilter');
const apiStatusDot = document.getElementById('apiStatusDot');
const apiStatusText = document.getElementById('apiStatusText');
const sidebarUser = document.getElementById('sidebarUser');
const selectedVoiceAvatar = document.getElementById('selectedVoiceAvatar');
const selectedVoiceName = document.getElementById('selectedVoiceName');
const selectedVoiceLang = document.getElementById('selectedVoiceLang');
const scriptInput = document.getElementById('scriptInput');
const charCount = document.getElementById('charCount');
const generateBtn = document.getElementById('generateBtn');
const emotionChips = document.getElementById('emotionChips');
const speedChips = document.getElementById('speedChips');
const laughterToggle = document.getElementById('laughterToggle');
const onAirLamp = document.getElementById('onAirLamp');
const onAirTime = document.getElementById('onAirTime');
const scopePanel = document.querySelector('.scope-panel');
const scopeStatus = document.getElementById('scopeStatus');
const scopeCanvas = document.getElementById('scope');
const scopeIdle = document.getElementById('scopeIdle');
const playbackPanel = document.getElementById('playbackPanel');
const playBtn = document.getElementById('playBtn');
const playbackProgress = document.getElementById('playbackProgress');
const playbackTime = document.getElementById('playbackTime');
const downloadBtn = document.getElementById('downloadBtn');
const audioPlayer = document.getElementById('audioPlayer');

const takesList = document.getElementById('takesList');
const takesEmpty = document.getElementById('takesEmpty');
const clearTakesBtn = document.getElementById('clearTakesBtn');
const takeAudioPlayer = document.getElementById('takeAudioPlayer');
let currentlyPlayingTakeId = null;
let currentTakeObjectUrl = null;

// Tracks every object URL we've handed to a take's "download" link so we can
// revoke them before re-rendering the list (each refresh used to leak one
// blob URL per take forever, since a new URL was created every time without
// releasing the old one).
let takeDownloadUrls = [];
function revokeTakeDownloadUrls() {
  takeDownloadUrls.forEach(url => URL.revokeObjectURL(url));
  takeDownloadUrls = [];
}

// Small helper: only attaches the listener if the element actually exists,
// and logs a clear warning if it doesn't — instead of throwing and killing
// every line of code that comes after it (this is what caused the whole
// app, including voice loading, to stop working after an HTML edit removed
// an element the script still expected).
function safeOn(element, event, handler, label) {
  if (!element) {
    console.warn(`[Voice AI Studio] Could not find "${label}" in the page — skipping its ${event} handler.`);
    return;
  }
  element.addEventListener(event, handler);
}

// ============ Greeting ============
if (currentUser && currentUser.name && sidebarUser) {
  sidebarUser.textContent = `· Hi, ${currentUser.name}`;
}

// ============ Helpers ============
const AVATAR_COLORS = ['#ffb020', '#35e8cb', '#ff8a5c', '#7fb3ff', '#e39bff', '#8fe08f'];

function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// Cartesia voices ship a free-text description (e.g. "a calm, warm narrator"
// or "deep, gravelly, menacing"). We scan it for keywords and surface a
// plain-language "best for" tag so people can pick a voice by use-case.
const GENRE_RULES = [
  { tag: 'Horror / Villain', keywords: ['menacing', 'sinister', 'raspy', 'growl', 'dark', 'eerie', 'villain', 'gravelly', 'creepy'] },
  { tag: 'Story / Narration', keywords: ['calm', 'soothing', 'warm', 'gentle', 'storyteller', 'narrat', 'soft'] },
  { tag: 'Kids / Cartoon', keywords: ['child', 'kid', 'young', 'playful', 'cartoon', 'cheerful'] },
  { tag: 'News / Podcast', keywords: ['news', 'anchor', 'broadcast', 'authoritative', 'confident', 'professional'] },
  { tag: 'Ads / Vlog', keywords: ['energetic', 'upbeat', 'friendly', 'enthusiastic', 'casual', 'conversational'] },
  { tag: 'Corporate', keywords: ['business', 'corporate', 'formal', 'clear', 'crisp'] },
  { tag: 'Romantic', keywords: ['romantic', 'sultry', 'intimate', 'seductive'] },
];

function genreForVoice(voice) {
  const haystack = `${voice.description || ''} ${voice.name || ''}`.toLowerCase();
  for (const rule of GENRE_RULES) {
    if (rule.keywords.some(k => haystack.includes(k))) return rule.tag;
  }
  return 'General';
}

function setStatus(ok, text) {
  if (!apiStatusDot || !apiStatusText) return;
  apiStatusDot.className = 'status-dot ' + (ok ? 'ok' : 'err');
  apiStatusText.textContent = text;
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ============ Load voices ============
async function loadVoices() {
  if (!voiceGrid) {
    console.warn('[Voice AI Studio] #voiceGrid not found — cannot render voices on this page.');
    return;
  }
  try {
    const health = await fetch('/api/health').then(r => r.json());
    if (!health.apiKeyConfigured) {
      setStatus(false, 'API key missing in .env');
      renderEmptyVoices('Add CARTESIA_API_KEY to the backend .env file');
      return;
    }

    const res = await fetch('/api/voices');
    const data = await res.json();

    if (!res.ok) {
      setStatus(false, 'Could not load voices');
      renderEmptyVoices(data.error || 'Something went wrong');
      return;
    }

    voices = data.voices || [];
    setStatus(true, `${voices.length} voices ready`);
    populateLanguageFilter();
    applyDefaultLanguageFromUser();
    renderVoiceGrid();
  } catch (err) {
    setStatus(false, 'Could not connect to server');
    renderEmptyVoices('Is the backend server running? (npm start)');
  }
}

function populateLanguageFilter() {
  if (languageFilter) {
    const langs = Array.from(new Set(voices.map(v => (v.language || 'en').toLowerCase()))).sort();
    languageFilter.innerHTML = '<option value="">All languages</option>';
    langs.forEach(code => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = languageName(code);
      languageFilter.appendChild(opt);
    });
  }

  if (countryFilter) {
    const countries = Array.from(new Set(voices.map(v => v.country).filter(Boolean))).sort();
    countryFilter.innerHTML = '<option value="">All countries</option>';
    countries.forEach(code => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = countryName(code);
      countryFilter.appendChild(opt);
    });
    countryFilter.style.display = countries.length ? '' : 'none';
  }
}

function applyDefaultLanguageFromUser() {
  if (!currentUser || !currentUser.country) return;

  // If Cartesia gave us a direct country match on any voice, prefer that —
  // it's exact, unlike our language-guess table.
  const hasDirectCountryMatch = voices.some(v => v.country === currentUser.country);
  if (hasDirectCountryMatch) {
    countryFilterValue = currentUser.country;
    if (countryFilter) countryFilter.value = currentUser.country;
    return;
  }

  const hints = COUNTRY_LANGUAGE_HINTS[currentUser.country];
  if (!hints) return;
  const availableLangs = new Set(voices.map(v => (v.language || 'en').toLowerCase()));
  const bestMatch = hints.find(code => availableLangs.has(code));
  if (bestMatch) {
    languageFilterValue = bestMatch;
    if (languageFilter) languageFilter.value = bestMatch;
  }
}

function renderEmptyVoices(message) {
  if (!voiceGrid) return;
  voiceGrid.innerHTML = `<p style="grid-column:1/-1;color:var(--text-muted);font-size:12.5px;line-height:1.5;">${message}</p>`;
}

function getFilteredVoices() {
  return voices.filter(voice => {
    const matchesSearch = !searchQuery ||
      (voice.name || '').toLowerCase().includes(searchQuery) ||
      genreForVoice(voice).toLowerCase().includes(searchQuery);
    const matchesLang = !languageFilterValue || (voice.language || 'en').toLowerCase() === languageFilterValue;
    const matchesCountry = !countryFilterValue || voice.country === countryFilterValue;
    return matchesSearch && matchesLang && matchesCountry;
  });
}

function renderVoiceGrid() {
  if (!voiceGrid) return;
  const filtered = getFilteredVoices();
  if (voiceCount) voiceCount.textContent = `${filtered.length} / ${voices.length}`;

  if (!filtered.length) {
    renderEmptyVoices(voices.length ? 'No voices match your search/filter' : 'No voices found');
    return;
  }

  voiceGrid.innerHTML = '';
  filtered.forEach(voice => {
    const card = document.createElement('button');
    card.className = 'voice-card';
    card.dataset.id = voice.id;
    const color = colorForName(voice.name || voice.id);
    const genre = genreForVoice(voice);
    card.style.setProperty('--card-accent', color);
    card.innerHTML = `
      <span class="voice-avatar" style="background:${color}">${initials(voice.name || '??')}</span>
      <span class="voice-card-name">${voice.name || 'Untitled'}</span>
      <span class="voice-card-genre">${genre}</span>
      <span class="voice-card-tag">${(voice.language || 'en').toUpperCase()}${voice.country ? ' · ' + countryName(voice.country) : ''}</span>
    `;
    card.classList.toggle('selected', voice.id === selectedVoiceId);
    card.addEventListener('click', () => selectVoice(voice));
    voiceGrid.appendChild(card);
  });

  if (!selectedVoiceId && filtered[0]) selectVoice(filtered[0]);
}

function selectVoice(voice) {
  selectedVoiceId = voice.id;
  document.querySelectorAll('.voice-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.id === voice.id);
  });
  const color = colorForName(voice.name || voice.id);
  if (selectedVoiceAvatar) {
    selectedVoiceAvatar.style.background = color;
    selectedVoiceAvatar.textContent = initials(voice.name || '??');
  }
  if (selectedVoiceName) selectedVoiceName.textContent = voice.name || 'Untitled';
  if (selectedVoiceLang) {
    const langLabel = `${(voice.language || 'en').toUpperCase()} · ${genreForVoice(voice)}`;
    selectedVoiceLang.textContent = voice.country ? `${langLabel} · ${countryName(voice.country)}` : langLabel;
  }
}

safeOn(voiceSearch, 'input', () => {
  searchQuery = voiceSearch.value.trim().toLowerCase();
  renderVoiceGrid();
}, '#voiceSearch');

safeOn(languageFilter, 'change', () => {
  languageFilterValue = languageFilter.value;
  renderVoiceGrid();
}, '#languageFilter');

safeOn(countryFilter, 'change', () => {
  countryFilterValue = countryFilter.value;
  renderVoiceGrid();
}, '#countryFilter');

// ============ Emotion & speed chips ============
safeOn(emotionChips, 'click', e => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  document.querySelectorAll('#emotionChips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  selectedEmotion = btn.dataset.emotion;
}, '#emotionChips');

safeOn(speedChips, 'click', e => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  document.querySelectorAll('#speedChips .chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  selectedSpeed = btn.dataset.speed;
}, '#speedChips');

safeOn(laughterToggle, 'click', () => {
  laughterOn = !laughterOn;
  laughterToggle.classList.toggle('active', laughterOn);
}, '#laughterToggle');

// ============ Char count ============
safeOn(scriptInput, 'input', () => {
  charCount.textContent = `${scriptInput.value.length} / 900`;
}, '#scriptInput');

// ============ REC timecode ============
function startRecTimer() {
  recStartTime = Date.now();
  if (onAirTime) onAirTime.textContent = '00:00';
  clearInterval(recTimerHandle);
  recTimerHandle = setInterval(() => {
    const elapsed = (Date.now() - recStartTime) / 1000;
    if (onAirTime) onAirTime.textContent = formatClock(elapsed);
  }, 200);
}
function stopRecTimer() {
  clearInterval(recTimerHandle);
}

// ============ Oscilloscope (signature reactive element) ============
const ctx2d = scopeCanvas ? scopeCanvas.getContext('2d') : null;
let idlePhase = 0;

function resizeCanvas() {
  if (!scopeCanvas) return;
  const rect = scopeCanvas.getBoundingClientRect();
  scopeCanvas.width = rect.width * devicePixelRatio;
  scopeCanvas.height = rect.height * devicePixelRatio;
}
window.addEventListener('resize', resizeCanvas);

function setupAudioGraph() {
  if (audioCtx || !audioPlayer) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  sourceNode = audioCtx.createMediaElementSource(audioPlayer);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
}

function drawGrid(w, h) {
  ctx2d.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx2d.lineWidth = 1;
  for (let x = 0; x < w; x += w / 12) {
    ctx2d.beginPath(); ctx2d.moveTo(x, 0); ctx2d.lineTo(x, h); ctx2d.stroke();
  }
  ctx2d.beginPath(); ctx2d.moveTo(0, h / 2); ctx2d.lineTo(w, h / 2); ctx2d.stroke();
}

function drawScope() {
  requestAnimationFrame(drawScope);
  if (!scopeCanvas || !ctx2d || !audioPlayer) return;

  const w = scopeCanvas.width;
  const h = scopeCanvas.height;
  if (!w || !h) return;
  ctx2d.clearRect(0, 0, w, h);
  drawGrid(w, h);

  const isPlaying = analyser && !audioPlayer.paused && !audioPlayer.ended;

  ctx2d.lineWidth = 2 * devicePixelRatio;

  if (isPlaying) {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    ctx2d.strokeStyle = '#ffaa1a';
    ctx2d.shadowBlur = 14;
    ctx2d.shadowColor = '#ffaa1a';
    ctx2d.beginPath();
    const sliceWidth = w / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * h) / 2;
      if (i === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
      x += sliceWidth;
    }
    ctx2d.stroke();
  } else {
    idlePhase += 0.012;
    ctx2d.strokeStyle = 'rgba(154, 162, 174, 0.35)';
    ctx2d.shadowBlur = 0;
    ctx2d.beginPath();
    const mid = h / 2;
    const amp = h * 0.035;
    for (let x = 0; x <= w; x += 4) {
      const y = mid + Math.sin(x * 0.01 + idlePhase) * amp;
      if (x === 0) ctx2d.moveTo(x, y); else ctx2d.lineTo(x, y);
    }
    ctx2d.stroke();
  }
}

resizeCanvas();
if (scopeCanvas) drawScope();

// ============ Take Log (history) — stored in IndexedDB so it survives reloads ============
const TAKES_DB_NAME = 'voice-ai-studio';
const TAKES_STORE = 'takes';
let takesDbPromise = null;

function openTakesDb() {
  if (takesDbPromise) return takesDbPromise;
  takesDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(TAKES_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TAKES_STORE)) {
        db.createObjectStore(TAKES_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return takesDbPromise;
}

async function addTake(take) {
  const db = await openTakesDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TAKES_STORE, 'readwrite');
    tx.objectStore(TAKES_STORE).add(take);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllTakes() {
  const db = await openTakesDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TAKES_STORE, 'readonly');
    const req = tx.objectStore(TAKES_STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.timestamp - a.timestamp));
    req.onerror = () => reject(req.error);
  });
}

async function deleteTake(id) {
  const db = await openTakesDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TAKES_STORE, 'readwrite');
    tx.objectStore(TAKES_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearAllTakes() {
  const db = await openTakesDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TAKES_STORE, 'readwrite');
    tx.objectStore(TAKES_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function refreshTakesList() {
  if (!takesList) return;
  const takes = await getAllTakes();

  // Release any object URLs from the previous render before creating new
  // ones, otherwise every refresh leaks the old blob URLs.
  revokeTakeDownloadUrls();

  takesList.querySelectorAll('.take-item').forEach(el => el.remove());
  if (takesEmpty) takesEmpty.style.display = takes.length ? 'none' : 'block';

  takes.forEach(take => {
    const item = document.createElement('div');
    item.className = 'take-item';
    item.dataset.id = take.id;
    item.innerHTML = `
      <span class="take-avatar" style="background:${take.voiceColor}">${initials(take.voiceName || '??')}</span>
      <div class="take-body">
        <p class="take-text">${take.text}</p>
        <span class="take-meta">${take.voiceName} · ${take.emotion ? take.emotion + ' · ' : ''}${timeAgo(take.timestamp)}</span>
      </div>
      <div class="take-actions">
        <button class="take-btn play-take" title="Play">▶</button>
        <a class="take-btn download-take" title="Download" download="${(take.voiceName || 'take').replace(/\s+/g, '-')}.wav">⬇</a>
        <button class="take-btn delete" title="Delete">✕</button>
      </div>
    `;

    const playBtnEl = item.querySelector('.play-take');
    const downloadEl = item.querySelector('.download-take');
    const deleteBtnEl = item.querySelector('.delete');

    playBtnEl.addEventListener('click', () => toggleTakePlayback(take, playBtnEl));
    deleteBtnEl.addEventListener('click', async () => {
      await deleteTake(take.id);
      refreshTakesList();
    });

    const downloadUrl = URL.createObjectURL(take.audioBlob);
    takeDownloadUrls.push(downloadUrl);
    downloadEl.href = downloadUrl;

    takesList.appendChild(item);
  });
}

function toggleTakePlayback(take, btnEl) {
  if (!takeAudioPlayer) return;
  const isThisPlaying = currentlyPlayingTakeId === take.id && !takeAudioPlayer.paused;
  document.querySelectorAll('.play-take').forEach(b => { b.textContent = '▶'; b.classList.remove('playing'); });

  if (isThisPlaying) {
    takeAudioPlayer.pause();
    currentlyPlayingTakeId = null;
    return;
  }

  if (currentTakeObjectUrl) URL.revokeObjectURL(currentTakeObjectUrl);
  currentTakeObjectUrl = URL.createObjectURL(take.audioBlob);
  takeAudioPlayer.src = currentTakeObjectUrl;
  takeAudioPlayer.play();
  currentlyPlayingTakeId = take.id;
  btnEl.textContent = '❚❚';
  btnEl.classList.add('playing');
}

if (takeAudioPlayer) {
  takeAudioPlayer.addEventListener('ended', () => {
    document.querySelectorAll('.play-take').forEach(b => { b.textContent = '▶'; b.classList.remove('playing'); });
    currentlyPlayingTakeId = null;
  });
}

safeOn(clearTakesBtn, 'click', async () => {
  if (!confirm('Clear all takes? This can\'t be undone.')) return;
  await clearAllTakes();
  refreshTakesList();
}, '#clearTakesBtn');

// ============ Generate voice ============
safeOn(generateBtn, 'click', async () => {
  const text = scriptInput.value.trim();
  if (!text) { scriptInput.focus(); return; }
  if (!selectedVoiceId) { alert('Please select a voice first'); return; }

  generateBtn.disabled = true;
  generateBtn.innerHTML = '<span class="btn-generate-icon">◌</span> Generating…';
  if (onAirLamp) onAirLamp.classList.add('live');
  if (scopePanel) scopePanel.classList.add('live');
  if (scopeStatus) scopeStatus.textContent = 'REC';
  startRecTimer();
  if (scopeIdle) scopeIdle.textContent = 'Recording your line…';

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voiceId: selectedVoiceId,
        emotion: selectedEmotion,
        speed: selectedSpeed,
        laughter: laughterOn,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Could not generate voice');
    }

    const blob = await res.blob();
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = URL.createObjectURL(blob);

    if (audioPlayer) audioPlayer.src = currentObjectUrl;
    if (downloadBtn) downloadBtn.href = currentObjectUrl;
    if (playbackPanel) playbackPanel.hidden = false;
    if (scopeIdle) scopeIdle.style.display = 'none';

    setupAudioGraph();
    if (audioPlayer) audioPlayer.play();

    const voice = voices.find(v => v.id === selectedVoiceId);
    await addTake({
      voiceId: selectedVoiceId,
      voiceName: (voice && voice.name) || 'Untitled',
      voiceColor: colorForName((voice && voice.name) || selectedVoiceId),
      text,
      emotion: selectedEmotion,
      speed: selectedSpeed,
      timestamp: Date.now(),
      audioBlob: blob,
    });
    refreshTakesList();
  } catch (err) {
    alert(err.message);
    if (scopeIdle) {
      scopeIdle.textContent = 'Something went wrong — try again';
      scopeIdle.style.display = 'flex';
    }
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<span class="btn-generate-icon">▶</span> Generate Voice';
    if (onAirLamp) onAirLamp.classList.remove('live');
    if (scopePanel) scopePanel.classList.remove('live');
    if (scopeStatus) scopeStatus.textContent = 'IDLE';
    stopRecTimer();
  }
}, '#generateBtn');

// ============ Playback controls ============
safeOn(playBtn, 'click', () => {
  if (audioPlayer.paused) audioPlayer.play(); else audioPlayer.pause();
}, '#playBtn');

if (audioPlayer) {
  audioPlayer.addEventListener('play', () => {
    if (playBtn) playBtn.textContent = '❚❚';
    if (onAirLamp) onAirLamp.classList.add('live');
    if (scopePanel) scopePanel.classList.add('live');
    if (scopeStatus) scopeStatus.textContent = 'PLAY';
    startRecTimer();
  });
  audioPlayer.addEventListener('pause', () => {
    if (playBtn) playBtn.textContent = '▶';
    if (onAirLamp) onAirLamp.classList.remove('live');
    if (scopePanel) scopePanel.classList.remove('live');
    if (scopeStatus) scopeStatus.textContent = 'IDLE';
    stopRecTimer();
  });
  audioPlayer.addEventListener('ended', () => {
    if (playBtn) playBtn.textContent = '▶';
    if (onAirLamp) onAirLamp.classList.remove('live');
    if (scopePanel) scopePanel.classList.remove('live');
    if (scopeStatus) scopeStatus.textContent = 'IDLE';
    stopRecTimer();
  });

  audioPlayer.addEventListener('timeupdate', () => {
    if (!audioPlayer.duration) return;
    const pct = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    if (playbackProgress) playbackProgress.style.width = pct + '%';
    const secs = Math.floor(audioPlayer.currentTime);
    if (playbackTime) playbackTime.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  });
}

// ============ Init ============
loadVoices();
refreshTakesList();
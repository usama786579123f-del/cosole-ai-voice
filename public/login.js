```javascript
// Login is intentionally lightweight: no backend, no password, no email.
// We only ever store { name, country } in this browser's localStorage.

const existing = localStorage.getItem('vas_user');
if (existing) {
  // Already "logged in" on this device — skip straight to the console.
  window.location.href = 'index.html';
}

const loginForm = document.getElementById('loginForm');
const nameInput = document.getElementById('nameInput');
const countryInput = document.getElementById('countryInput');

// Populate the country dropdown from the shared world list, with the most
// relevant markets for our voice library pinned to the top for convenience.
const PINNED = ['PK', 'IN', 'US', 'GB', 'AE', 'SA', 'CA', 'AU'];
const pinnedSet = new Set(PINNED);
PINNED.forEach(code => {
  const entry = WORLD_COUNTRIES.find(([c]) => c === code);
  if (entry) addCountryOption(entry[0], entry[1]);
});
const divider = document.createElement('option');
divider.disabled = true;
divider.textContent = '──────────';
countryInput.appendChild(divider);
WORLD_COUNTRIES
  .filter(([code]) => !pinnedSet.has(code))
  .sort((a, b) => a[1].localeCompare(b[1]))
  .forEach(([code, name]) => addCountryOption(code, name));

function addCountryOption(code, name) {
  const opt = document.createElement('option');
  opt.value = code;
  opt.textContent = name;
  countryInput.appendChild(opt);
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }

  const user = { name, country: countryInput.value || null };
  localStorage.setItem('vas_user', JSON.stringify(user));
  window.location.href = 'index.html';
});
```
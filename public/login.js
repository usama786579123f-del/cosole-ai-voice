// ============ LOGIN ============
const loginForm = document.getElementById('login-form');

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const messageEl = document.getElementById('login-message');

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Signing in...';
    submitBtn.disabled = true;
    messageEl.textContent = '';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        messageEl.textContent = data.message || 'Login failed.';
        messageEl.className = 'text-sm text-red-400';
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        return;
      }

      // Token aur user info save karo
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Admin hai to admin dashboard, warna normal dashboard
      if (data.user.role === 'admin') {
        window.location.href = 'admin/dashboard.html';
      } else {
        window.location.href = 'dashboard.html';
      }

    } catch (error) {
      messageEl.textContent = 'Server error. Please try again.';
      messageEl.className = 'text-sm text-red-400';
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}

// ============ SIGNUP ============
const signupForm = document.getElementById('signup-form');

if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const messageEl = document.getElementById('signup-message');

    const submitBtn = signupForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating account...';
    submitBtn.disabled = true;
    messageEl.textContent = '';

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        messageEl.textContent = data.message || 'Signup failed.';
        messageEl.className = 'text-sm text-red-400';
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      messageEl.textContent = 'Account created! Redirecting...';
      messageEl.className = 'text-sm text-green-400';

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);

    } catch (error) {
      messageEl.textContent = 'Server error. Please try again.';
      messageEl.className = 'text-sm text-red-400';
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}
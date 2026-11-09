const API = "https://bdu-premium.mbasa6034-74e.workers.dev";   // ← CHANGE THIS LATER

const STORAGE_KEY = 'bdu_install_id';

async function getOrCreateInstallationId() {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID() + '-' + Date.now().toString(36);
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

async function api(path, options = {}) {
  const installId = await getOrCreateInstallationId();
  const headers = {
    'Content-Type': 'application/json',
    'X-Installation-Id': installId,
    ...(options.headers || {})
  };
  const token = localStorage.getItem('bdu_token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`\( {API} \){path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

function showLogin() {
  document.getElementById('main').innerHTML = `
    <div class="card">
      <h2>Login</h2>
      <input id="phone" type="tel" placeholder="Phone number (e.g. 0912345678)" />
      <input id="password" type="password" placeholder="Password" />
      <button class="btn" onclick="doLogin()">Login</button>
      <p style="margin-top:16px;">No account? <a href="#" onclick="showSignup()">Register</a></p>
      <div id="msg"></div>
    </div>
  `;
}

function showSignup() {
  document.getElementById('main').innerHTML = `
    <div class="card">
      <h2>Register</h2>
      <input id="full_name" placeholder="Full Name" />
      <input id="phone" type="tel" placeholder="Phone number" />
      <input id="password" type="password" placeholder="Password" />
      <input id="confirm" type="password" placeholder="Confirm Password" />
      <button class="btn" onclick="doSignup()">Create Account</button>
      <p style="margin-top:16px;">Already have account? <a href="#" onclick="showLogin()">Login</a></p>
      <div id="msg"></div>
    </div>
  `;
}

async function doSignup() {
  const full_name = document.getElementById('full_name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  const confirm = document.getElementById('confirm').value;
  const msg = document.getElementById('msg');

  if (password !== confirm) {
    msg.innerHTML = '<p class="error">Passwords do not match</p>';
    return;
  }

  try {
    const installation_id = await getOrCreateInstallationId();
    await api('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ full_name, phone, password, installation_id })
    });
    msg.innerHTML = '<p class="success">Account created! Please login.</p>';
    setTimeout(showLogin, 1500);
  } catch (err) {
    msg.innerHTML = `<p class="error">${err.error || 'Registration failed'}</p>`;
  }
}

async function doLogin() {
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  const msg = document.getElementById('msg');

  try {
    const installation_id = await getOrCreateInstallationId();
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password, installation_id })
    });
    localStorage.setItem('bdu_token', data.token);
    showHome(data.user);
  } catch (err) {
    msg.innerHTML = `<p class="error">${err.error || 'Login failed'}</p>`;
  }
}

function showHome(user) {
  document.getElementById('main').innerHTML = `
    <div class="card">
      <h2>Welcome, ${user.full_name}</h2>
      <p>Phone: ${user.phone}</p>
      <p style="margin-top:12px; color:#276749;">✓ Device registered successfully</p>
      <button class="btn" style="margin-top:20px;" onclick="logout()">Logout</button>
    </div>
  `;
}

async function logout() {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch(e) {}
  localStorage.removeItem('bdu_token');
  showLogin();
}

// Start
(async () => {
  const token = localStorage.getItem('bdu_token');
  if (token) {
    try {
      const user = await api('/api/auth/me');
      showHome(user);
    } catch {
      showLogin();
    }
  } else {
    showLogin();
  }
})();

import { hashPassword, verifyPassword, hashInstallationId, createSessionId } from './auth.js';
import { registerDevice, verifyDevice, getActiveDevice } from './device.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (path === '/api/auth/signup' && method === 'POST') {
        return await handleSignup(request, env);
      }
      if (path === '/api/auth/login' && method === 'POST') {
        return await handleLogin(request, env);
      }
      if (path === '/api/auth/me' && method === 'GET') {
        return await handleMe(request, env);
      }
      if (path === '/api/auth/logout' && method === 'POST') {
        return await handleLogout(request, env);
      }
      if (path === '/api/device/status' && method === 'GET') {
        return await handleDeviceStatus(request, env);
      }
      if (path === '/api/version' && method === 'GET') {
        const row = await env.DB.prepare(`SELECT value FROM app_config WHERE key = 'app_version'`).first();
        return json({ version: row?.value || '1.0.0' });
      }
      if (path === '/api/programs' && method === 'GET') {
        const { results } = await env.DB.prepare(`SELECT * FROM programs`).all();
        return json(results);
      }

      return new Response('BDU PREMIUM API is running', { status: 200, headers: corsHeaders() });
    } catch (err) {
      console.error(err);
      return json({ error: 'Internal server error' }, 500);
    }
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Installation-Id',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() }
  });
}

async function handleSignup(request, env) {
  const body = await request.json();
  const { full_name, university, campus, phone, password, installation_id, device_model, app_version } = body;

  if (!full_name || !phone || !password || !installation_id) {
    return json({ error: 'Missing required fields' }, 400);
  }
  if (password.length < 6) return json({ error: 'Password too short' }, 400);

  const existing = await env.DB.prepare(`SELECT id FROM users WHERE phone = ?`).bind(phone).first();
  if (existing) return json({ error: 'Phone number already registered' }, 409);

  const password_hash = await hashPassword(password);
  const installHash = await hashInstallationId(installation_id);

  const userResult = await env.DB.prepare(
    `INSERT INTO users (full_name, university, campus, phone, password_hash) VALUES (?, ?, ?, ?, ?)`
  ).bind(full_name, university || 'Bahir Dar University', campus || null, phone, password_hash).run();

  const userId = userResult.meta.last_row_id;
  await registerDevice(env.DB, userId, installHash, { device_model, app_version });

  return json({ success: true, message: 'Account created and device registered' });
}

async function handleLogin(request, env) {
  const body = await request.json();
  const { phone, password, installation_id } = body;

  if (!phone || !password || !installation_id) {
    return json({ error: 'Missing credentials or device ID' }, 400);
  }

  const user = await env.DB.prepare(`SELECT * FROM users WHERE phone = ?`).bind(phone).first();

  if (!user || user.status !== 'active') {
    await logAttempt(env.DB, null, phone, installation_id, false, 'invalid_credentials');
    return json({ error: 'Invalid phone or password' }, 401);
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    await logAttempt(env.DB, user.id, phone, installation_id, false, 'wrong_password');
    return json({ error: 'Invalid phone or password' }, 401);
  }

  const installHash = await hashInstallationId(installation_id);
  const deviceCheck = await verifyDevice(env.DB, user.id, installHash);

  if (!deviceCheck.ok) {
    await logAttempt(env.DB, user.id, phone, installation_id, false, deviceCheck.reason);
    return json({
      error: 'This account is registered to another device. Only your registered device can access this account. Contact the administrator if you need to change your device.',
      code: 'DEVICE_MISMATCH'
    }, 403);
  }

  const sessionId = createSessionId();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, device_id, expires_at) VALUES (?, ?, ?, ?)`
  ).bind(sessionId, user.id, deviceCheck.device.id, expires).run();

  await logAttempt(env.DB, user.id, phone, installation_id, true, null);

  return json({
    success: true,
    token: sessionId,
    user: { id: user.id, full_name: user.full_name, phone: user.phone }
  });
}

async function handleMe(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  const token = auth.slice(7);

  const session = await env.DB.prepare(
    `SELECT s.*, u.full_name, u.phone, u.status 
     FROM sessions s JOIN users u ON s.user_id = u.id
     WHERE s.id = ? AND s.expires_at > datetime('now')`
  ).bind(token).first();

  if (!session || session.status !== 'active') return json({ error: 'Unauthorized' }, 401);

  const installId = request.headers.get('X-Installation-Id');
  if (installId) {
    const hash = await hashInstallationId(installId);
    const check = await verifyDevice(env.DB, session.user_id, hash);
    if (!check.ok) return json({ error: 'Device mismatch', code: 'DEVICE_MISMATCH' }, 403);
  }

  return json({ id: session.user_id, full_name: session.full_name, phone: session.phone });
}

async function handleLogout(request, env) {
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    await env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(token).run();
  }
  return json({ success: true });
}

async function handleDeviceStatus(request, env) {
  const meRes = await handleMe(request, env);
  if (meRes.status !== 200) return meRes;
  const data = await meRes.json();
  const device = await getActiveDevice(env.DB, data.id);
  return json({ device });
}

async function logAttempt(db, userId, phone, installHash, success, reason) {
  await db.prepare(
    `INSERT INTO login_attempts (user_id, phone, installation_id_hash, success, rejection_reason)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(userId, phone, installHash, success ? 1 : 0, reason).run();
}

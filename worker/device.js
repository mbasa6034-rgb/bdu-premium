export async function getActiveDevice(db, userId) {
  return await db.prepare(
    `SELECT * FROM device_registrations WHERE user_id = ? AND status = 'active' LIMIT 1`
  ).bind(userId).first();
}

export async function registerDevice(db, userId, installationIdHash, meta = {}) {
  await db.prepare(
    `UPDATE device_registrations SET status = 'revoked', revoked_at = datetime('now')
     WHERE user_id = ? AND status = 'active'`
  ).bind(userId).run();

  const result = await db.prepare(
    `INSERT INTO device_registrations 
     (user_id, installation_id_hash, device_model, platform, app_version, status)
     VALUES (?, ?, ?, ?, ?, 'active')`
  ).bind(
    userId,
    installationIdHash,
    meta.device_model || null,
    meta.platform || 'android',
    meta.app_version || null
  ).run();

  return result.meta.last_row_id;
}

export async function verifyDevice(db, userId, installationIdHash) {
  const device = await getActiveDevice(db, userId);
  if (!device) return { ok: false, reason: 'no_device_registered' };
  if (device.installation_id_hash !== installationIdHash) {
    return { ok: false, reason: 'device_mismatch' };
  }
  await db.prepare(
    `UPDATE device_registrations SET last_seen_at = datetime('now') WHERE id = ?`
  ).bind(device.id).run();
  return { ok: true, device };
}

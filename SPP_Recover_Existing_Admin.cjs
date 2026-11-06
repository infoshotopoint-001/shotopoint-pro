/**
 * Recover an existing Shoto Point administrator account by email.
 * Reads database settings from .env and reset values from environment variables.
 * It rotates the Admin ID, Control Key and bcrypt password for ONE active account.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');

async function main() {
  const email = String(process.env.SPP_ADMIN_EMAIL || '').trim().toLowerCase();
  const newPassword = String(process.env.SPP_ADMIN_NEW_PASSWORD || '');
  if (!email || !email.includes('@')) throw new Error('A valid SPP_ADMIN_EMAIL is required.');
  if (newPassword.length < 12) throw new Error('The new password must contain at least 12 characters.');
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
    throw new Error('Database settings are missing from .env.');
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    ssl: String(process.env.DB_SSL || 'false') === 'true' ? { rejectUnauthorized: true } : undefined,
    connectTimeout: 10000
  });

  try {
    const [rows] = await connection.execute(
      'SELECT id, status FROM admins WHERE email = ? LIMIT 1', [email]
    );
    if (!rows.length) throw new Error('No administrator exists with that email. No changes were made.');
    const account = rows[0];
    if (account.status !== 'active') {
      throw new Error(`The existing account status is "${account.status}". No changes were made; review the account status first.`);
    }

    const adminId = 'SP-ADMIN-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const controlKey = 'SPK-' + crypto.randomBytes(8).toString('hex').toUpperCase();
    const passwordHash = await bcrypt.hash(newPassword, 12);

    const [result] = await connection.execute(
      'UPDATE admins SET admin_id = ?, control_key = ?, password_hash = ? WHERE id = ? AND email = ? AND status = \'active\'',
      [adminId, controlKey, passwordHash, account.id, email]
    );
    if (result.affectedRows !== 1) throw new Error('The account was not updated. No credentials were changed.');

    console.log('\nEXISTING SHOTO POINT ADMIN ACCOUNT RECOVERED');
    console.log('Email: ' + email);
    console.log('Admin ID: ' + adminId);
    console.log('Control Key: ' + controlKey);
    console.log('Password: the new password you entered securely in PowerShell.');
    console.log('\nSave the Admin ID and Control Key securely. Do not share them in chat.');
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error('\nADMIN RECOVERY FAILED: ' + (error.code || error.message));
  process.exitCode = 1;
});

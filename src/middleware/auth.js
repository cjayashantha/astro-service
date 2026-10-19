'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CLIENTS_FILE = process.env.CLIENTS_FILE || path.join(__dirname, '../../clients.json');

// Load clients once at startup. Throws on any problem so the server never runs unprotected.
function loadClients(filePath) {
  let list;
  try {
    list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    throw new Error(`Cannot load clients file ${filePath}: ${err.message}`);
  }
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`Clients file ${filePath} must be a non-empty array`);
  }

  const clients = new Map();
  for (const { clientId, clientSecret } of list) {
    if (typeof clientId !== 'string' || !clientId || typeof clientSecret !== 'string' || !clientSecret) {
      throw new Error(`Clients file ${filePath}: each entry needs a non-empty clientId and clientSecret`);
    }
    if (clients.has(clientId)) {
      throw new Error(`Clients file ${filePath}: duplicate clientId "${clientId}"`);
    }
    clients.set(clientId, clientSecret);
  }
  return clients;
}

const clients = loadClients(CLIENTS_FILE);

// Constant-time string comparison (hash first so lengths always match)
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function requireClient(req, res, next) {
  const clientId = req.get('x-client-id');
  const secret   = req.get('x-client-secret');
  const expected = clientId && clients.get(clientId);

  if (!expected || !secret || !safeEqual(secret, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.clientId = clientId;
  next();
}

module.exports = { requireClient, loadClients };

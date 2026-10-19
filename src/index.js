'use strict';

const express = require('express');
const ephemerisRouter = require('./routes/ephemeris');
const { requireClient } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Body parsing
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ephemeris route (requires x-client-id / x-client-secret headers)
app.use('/api/ephemeris', requireClient, ephemerisRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  const message = err.message || 'Internal server error';
  res.status(err.status || 500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`eph-service listening on port ${PORT}`);
});

module.exports = app;

'use strict';

const express = require('express');
const { getEphemerisData, parseUtcOffset, ZODIACS } = require('../services/ephemerisService');

const router = express.Router();

// --- Validation helpers ---

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function validateRequest(body) {
  const { date, time, lat, lon, zodiac, timezone } = body;
  const errors = [];

  if (timezone !== undefined && timezone !== null && timezone !== '' && parseUtcOffset(timezone) === null) {
    errors.push('Invalid timezone. Expected UTC offset ±HHMM (e.g. "+0530" for Colombo, "+0800" for Singapore)');
  }

  if (zodiac !== undefined && !ZODIACS.includes(String(zodiac).toLowerCase())) {
    errors.push(`zodiac must be one of: ${ZODIACS.join(', ')} (default: sidereal)`);
  }

  if (date === undefined || date === null || date === '') {
    errors.push('Missing required field: date');
  } else if (!DATE_RE.test(date)) {
    errors.push('Invalid date format. Expected YYYY-MM-DD (e.g. "2026-01-30")');
  }

  if (time === undefined || time === null || time === '') {
    errors.push('Missing required field: time');
  } else if (!TIME_RE.test(time)) {
    errors.push('Invalid time format. Expected HH:MM with hours 0-23 and minutes 0-59 (e.g. "20:30")');
  }

  if (lat === undefined || lat === null || lat === '') {
    errors.push('Missing required field: lat');
  } else {
    const latNum = Number(lat);
    if (isNaN(latNum)) {
      errors.push('lat must be a number');
    } else if (latNum < -90 || latNum > 90) {
      errors.push('lat must be between -90 and 90');
    }
  }

  if (lon === undefined || lon === null || lon === '') {
    errors.push('Missing required field: lon');
  } else {
    const lonNum = Number(lon);
    if (isNaN(lonNum)) {
      errors.push('lon must be a number');
    } else if (lonNum < -180 || lonNum > 180) {
      errors.push('lon must be between -180 and 180');
    }
  }

  return errors;
}

// POST /api/ephemeris
router.post('/', (req, res, next) => {
  try {
    const errors = validateRequest(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    const { date, time } = req.body;
    const lat = Number(req.body.lat);
    const lon = Number(req.body.lon);
    const zodiac = req.body.zodiac ? String(req.body.zodiac).toLowerCase() : 'sidereal';

    const timezone = req.body.timezone ? String(req.body.timezone).trim() : null;

    const data = getEphemerisData(date, time, lat, lon, zodiac, timezone);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

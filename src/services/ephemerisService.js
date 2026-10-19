'use strict';

const path = require('path');
const swisseph = require('swisseph');
const SunCalc = require('suncalc');
const { find: tzFind } = require('geo-tz');

swisseph.swe_set_ephe_path(path.join(__dirname, '../../node_modules/swisseph/ephe'));

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

const PLANETS = [
  { name: 'Sun',      id: swisseph.SE_SUN },
  { name: 'Moon',     id: swisseph.SE_MOON },
  { name: 'Mercury',  id: swisseph.SE_MERCURY },
  { name: 'Venus',    id: swisseph.SE_VENUS },
  { name: 'Mars',     id: swisseph.SE_MARS },
  { name: 'Jupiter',  id: swisseph.SE_JUPITER },
  { name: 'Saturn',   id: swisseph.SE_SATURN },
  { name: 'Uranus',   id: swisseph.SE_URANUS },
  { name: 'Neptune',  id: swisseph.SE_NEPTUNE },
  { name: 'Pluto',    id: swisseph.SE_PLUTO },
  // Mean Node, matching AstroSage / traditional Vedic Rahu. Ketu is derived (Rahu + 180°).
  { name: 'Rahu',     id: swisseph.SE_MEAN_NODE },
  { name: 'Chiron',   id: swisseph.SE_CHIRON },
];

const ZODIACS = ['sidereal', 'tropical'];

// Resolve timezone name from lat/lon, then get UTC offset in hours for a given local datetime string.
function getUtcOffsetHours(dateStr, timeStr, lat, lon) {
  try {
    const tzNames = tzFind(lat, lon);
    if (!tzNames || tzNames.length === 0) return 0;
    const tz = tzNames[0];
    const dt = new Date(`${dateStr}T${timeStr}:00Z`);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'longOffset',
    }).formatToParts(dt);
    const offsetPart = parts.find(p => p.type === 'timeZoneName');
    if (!offsetPart) return 0;
    // value is like "GMT+05:30" or "GMT-04:00" or "GMT+0"
    const match = offsetPart.value.match(/GMT([+-])(\d{2})(?::(\d{2}))?/);
    if (!match) return 0;
    const sign    = match[1] === '+' ? 1 : -1;
    const hours   = parseInt(match[2], 10);
    const minutes = parseInt(match[3] || '0', 10);
    return sign * (hours + minutes / 60);
  } catch {
    return 0;
  }
}

// Parse a UTC offset like "+0530", "-04:00" or "+08" into hours; null if invalid.
function parseUtcOffset(str) {
  const match = String(str).trim().match(/^([+-])(\d{2}):?(\d{2})?$/);
  if (!match) return null;
  const hours   = parseInt(match[2], 10);
  const minutes = parseInt(match[3] || '0', 10);
  if (hours > 14 || minutes > 59) return null;
  return (match[1] === '+' ? 1 : -1) * (hours + minutes / 60);
}

// Convert local date+time at lat/lon to a UTC-based Julian Day Number.
// An explicit utcOffset (hours) overrides the timezone detected from lat/lon.
function localToJd(dateStr, timeStr, lat, lon, explicitOffset = null) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute]     = timeStr.split(':').map(Number);
  const utcOffset          = explicitOffset ?? getUtcOffsetHours(dateStr, timeStr, lat, lon);
  const localHour          = hour + minute / 60;
  const utcHour            = localHour - utcOffset;

  // Handle day rollover
  let adjYear = year, adjMonth = month, adjDay = day, adjHour = utcHour;
  if (adjHour < 0) {
    adjHour += 24;
    const d = new Date(Date.UTC(year, month - 1, day - 1));
    adjYear  = d.getUTCFullYear();
    adjMonth = d.getUTCMonth() + 1;
    adjDay   = d.getUTCDate();
  } else if (adjHour >= 24) {
    adjHour -= 24;
    const d = new Date(Date.UTC(year, month - 1, day + 1));
    adjYear  = d.getUTCFullYear();
    adjMonth = d.getUTCMonth() + 1;
    adjDay   = d.getUTCDate();
  }

  return {
    jd: swisseph.swe_julday(adjYear, adjMonth, adjDay, adjHour, swisseph.SE_GREG_CAL),
    utcOffset,
    utcDateStr: `${String(adjYear).padStart(4,'0')}-${String(adjMonth).padStart(2,'0')}-${String(adjDay).padStart(2,'0')}`,
    utcTimeStr: `${String(Math.floor(adjHour)).padStart(2,'0')}:${String(Math.round((adjHour % 1) * 60)).padStart(2,'0')}`,
  };
}

function norm360(lon) {
  return ((lon % 360) + 360) % 360;
}

function getSignInfo(longitude) {
  const n = norm360(longitude);
  const signIndex  = Math.floor(n / 30);
  const signDegree = n % 30;
  return { sign: SIGNS[signIndex], signDegree: parseFloat(signDegree.toFixed(4)) };
}

// Convert decimal degrees to DMS string "DD°MM'SS\""
function toDMS(deg) {
  const d = Math.floor(deg);
  const mTotal = (deg - d) * 60;
  const m = Math.floor(mTotal);
  const s = Math.round((mTotal - m) * 60);
  return `${d}°${String(m).padStart(2,'0')}'${String(s).padStart(2,'0')}"`;
}

// Format a Date as HH:MM:SS local time at the given UTC offset (hours), independent of server timezone.
function formatTime(date, utcOffset) {
  if (!date || isNaN(date.getTime())) return null;
  const local = new Date(date.getTime() + utcOffset * 3600000);
  const h = String(local.getUTCHours()).padStart(2, '0');
  const m = String(local.getUTCMinutes()).padStart(2, '0');
  const s = String(local.getUTCSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function getMoonPhaseName(phase) {
  if (phase < 0.125) return 'New Moon';
  if (phase < 0.25)  return 'Waxing Crescent';
  if (phase < 0.375) return 'First Quarter';
  if (phase < 0.5)   return 'Waxing Gibbous';
  if (phase < 0.625) return 'Full Moon';
  if (phase < 0.75)  return 'Waning Gibbous';
  if (phase < 0.875) return 'Last Quarter';
  return 'Waning Crescent';
}

// Build a zodiac position from a tropical longitude; sidereal subtracts the ayanamsa.
function toPosition(tropicalLon, ayanamsa, zodiac) {
  const raw  = zodiac === 'tropical' ? tropicalLon : tropicalLon - ayanamsa;
  const lon  = parseFloat(norm360(raw).toFixed(4));
  const info = getSignInfo(lon);
  return { longitude: lon, dms: toDMS(info.signDegree), sign: info.sign, signDegree: info.signDegree };
}

function calcPlanetPosition(jd, planetId, ayanamsa, zodiac) {
  try {
    const result = swisseph.swe_calc_ut(jd, planetId, swisseph.SEFLG_SPEED);
    if (result.error) return null;

    const speed = result.longitudeSpeed !== undefined ? result.longitudeSpeed : (result.speedLongitude || 0);

    return {
      ...toPosition(result.longitude, ayanamsa, zodiac),
      latitude:    parseFloat((result.latitude || 0).toFixed(6)),
      distance:    parseFloat((result.distance || 0).toFixed(6)),
      speed:       parseFloat(speed.toFixed(6)),
      isRetrograde: speed < 0,
    };
  } catch {
    return null;
  }
}

function calcHouses(jd, lat, lon, ayanamsa, zodiac) {
  try {
    const houses = swisseph.swe_houses(jd, lat, lon, 'P');
    if (!houses || houses.error) return null;

    const rawCusps = houses.house || houses.cusps || [];
    const startIdx = rawCusps.length === 13 ? 1 : 0;

    const buildPoint = (rawLon) => toPosition(rawLon, ayanamsa, zodiac);

    const cusps = [];
    for (let i = 0; i < 12; i++) {
      const raw = rawCusps[startIdx + i];
      if (raw === undefined) break;
      cusps.push({ house: i + 1, ...buildPoint(raw) });
    }

    return {
      system: 'Placidus',
      ascendant: buildPoint(houses.ascendant),
      midheaven: buildPoint(houses.mc),
      cusps,
    };
  } catch {
    return null;
  }
}

function calcSiderealTime(jd) {
  try {
    const raw = swisseph.swe_sidtime(jd);
    const stHours = (typeof raw === 'object' && raw !== null)
      ? (raw.siderialTime || raw.siderealTime || 0)
      : raw;
    const totalSeconds = Math.round(stHours * 3600);
    const h = String(Math.floor(totalSeconds / 3600) % 24).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  } catch {
    return null;
  }
}

function calcAyanamsa(jd) {
  try {
    swisseph.swe_set_sid_mode(swisseph.SE_SIDM_LAHIRI, 0, 0);
    const lahiri = swisseph.swe_get_ayanamsa_ut(jd);
    swisseph.swe_set_sid_mode(swisseph.SE_SIDM_RAMAN, 0, 0);
    const raman = swisseph.swe_get_ayanamsa_ut(jd);
    return {
      lahiri: parseFloat((lahiri || 0).toFixed(6)),
      raman:  parseFloat((raman  || 0).toFixed(6)),
    };
  } catch {
    return null;
  }
}

function calcSunTimes(dateStr, lat, lon, utcOffset) {
  try {
    // Local noon on the birth date, so SunCalc picks the correct local day
    const date  = new Date(Date.parse(`${dateStr}T12:00:00Z`) - utcOffset * 3600000);
    const times = SunCalc.getTimes(date, lat, lon);
    const fmt   = (d) => formatTime(d, utcOffset);
    return {
      sunrise:          fmt(times.sunrise),
      sunset:           fmt(times.sunset),
      solarNoon:        fmt(times.solarNoon),
      civilDawn:        fmt(times.dawn),
      civilDusk:        fmt(times.dusk),
      nauticalDawn:     fmt(times.nauticalDawn),
      nauticalDusk:     fmt(times.nauticalDusk),
      astronomicalDawn: fmt(times.nightEnd),
      astronomicalDusk: fmt(times.night),
    };
  } catch {
    return null;
  }
}

function calcMoonPhase(jdDate) {
  try {
    // Convert JD to JS Date (JD 2440587.5 = 1970-01-01T00:00:00Z)
    const msFromEpoch = (jdDate - 2440587.5) * 86400000;
    const date = new Date(msFromEpoch);
    const illum = SunCalc.getMoonIllumination(date);
    return {
      phase:        parseFloat(illum.phase.toFixed(4)),
      phaseName:    getMoonPhaseName(illum.phase),
      illumination: parseFloat(illum.fraction.toFixed(4)),
      angle:        parseFloat(illum.angle.toFixed(4)),
    };
  } catch {
    return null;
  }
}

function getEphemerisData(dateStr, timeStr, lat, lon, zodiac = 'sidereal', timezone = null) {
  const explicitOffset = timezone ? parseUtcOffset(timezone) : null;
  const { jd, utcOffset, utcDateStr, utcTimeStr } = localToJd(dateStr, timeStr, lat, lon, explicitOffset);

  // Compute Lahiri ayanamsa first (needed for sidereal conversion of everything)
  const ayanamsaData = calcAyanamsa(jd);
  const lahiri       = ayanamsaData ? ayanamsaData.lahiri : 0;

  const planets = {};
  for (const { name, id } of PLANETS) {
    planets[name] = calcPlanetPosition(jd, id, lahiri, zodiac);
  }

  // Ketu sits exactly opposite Rahu, moving at the same speed
  const rahu = planets.Rahu;
  planets.Ketu = rahu && {
    ...rahu,
    ...toPosition(rahu.longitude + 180, 0, 'tropical'),
    latitude: -rahu.latitude,
  };

  return {
    input: { date: dateStr, time: timeStr, lat, lon, zodiac, timezone },
    timezone: {
      utcOffset,
      source: explicitOffset !== null ? 'input' : 'detected',
      utcDate: utcDateStr,
      utcTime: utcTimeStr,
    },
    julianDay:    parseFloat(jd.toFixed(4)),
    planets,
    houses:       calcHouses(jd, lat, lon, lahiri, zodiac),
    sunTimes:     calcSunTimes(dateStr, lat, lon, utcOffset),
    moonPhase:    calcMoonPhase(jd),
    siderealTime: calcSiderealTime(jd),
    ayanamsa:     ayanamsaData,
  };
}

module.exports = { getEphemerisData, parseUtcOffset, ZODIACS };

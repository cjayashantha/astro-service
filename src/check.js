'use strict';

// Smoke test for deployment: confirms the swisseph native addon built and loads on this host.
// Run with `npm run check` (or cPanel "Run JS script" → check). Does not need clients.json.

try {
  const { getEphemerisData } = require('./services/ephemerisService');
  const r = getEphemerisData('1988-03-03', '23:42', 6.85, 79.8667);

  console.log(`Node ${process.version} (${process.platform}/${process.arch})`);
  console.log(`Sun        ${r.planets.Sun.sign} ${r.planets.Sun.dms}`);
  console.log(`Moon       ${r.planets.Moon.sign} ${r.planets.Moon.dms}`);
  console.log(`Ascendant  ${r.houses.ascendant.sign} ${r.houses.ascendant.dms}`);
  console.log(`Sunrise    ${r.sunTimes.sunrise}`);

  if (r.planets.Sun.sign !== 'Aquarius' || r.houses.ascendant.sign !== 'Scorpio') {
    throw new Error('Unexpected positions — check ephemeris files and timezone detection');
  }
  console.log('OK');
} catch (err) {
  console.error('CHECK FAILED:', err.message);
  process.exit(1);
}

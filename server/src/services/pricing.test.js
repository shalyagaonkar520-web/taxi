const test = require('node:test');
const assert = require('node:assert');
const { getCurrencyForLocation, calculateFare } = require('./pricing');

test('maps cities to their local currency', () => {
  assert.deepStrictEqual(getCurrencyForLocation('New York, NY'), {
    code: 'USD',
    symbol: '$',
    locale: 'en-US'
  });

  assert.deepStrictEqual(getCurrencyForLocation('Bengaluru, India'), {
    code: 'INR',
    symbol: '₹',
    locale: 'en-IN'
  });

  assert.deepStrictEqual(getCurrencyForLocation('Paris, France'), {
    code: 'EUR',
    symbol: '€',
    locale: 'fr-FR'
  });
});

test('includes the resolved currency in fare details', () => {
  const fare = calculateFare({
    category: 'UberX',
    distanceKm: 2,
    durationMin: 6,
    currencyInfo: getCurrencyForLocation('London, UK')
  });

  assert.equal(fare.currencyCode, 'GBP');
  assert.equal(fare.currency, '£');
});

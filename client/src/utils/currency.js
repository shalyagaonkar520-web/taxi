const CURRENCY_BY_LOCATION = {
  default: { code: 'USD', symbol: '$', locale: 'en-US' },
  india: { code: 'INR', symbol: '₹', locale: 'en-IN' },
  uk: { code: 'GBP', symbol: '£', locale: 'en-GB' },
  europe: { code: 'EUR', symbol: '€', locale: 'fr-FR' },
  canada: { code: 'CAD', symbol: 'C$', locale: 'en-CA' },
  australia: { code: 'AUD', symbol: 'A$', locale: 'en-AU' }
};

export function getCurrencyForLocation(location = '') {
  const normalized = String(location || '').toLowerCase();

  if (/(india|bengaluru|bangalore|mumbai|delhi|hyderabad|chennai|kolkata|pune)/.test(normalized)) {
    return CURRENCY_BY_LOCATION.india;
  }

  if (/(united kingdom|uk|england|london|manchester|birmingham|glasgow|scotland|wales)/.test(normalized)) {
    return CURRENCY_BY_LOCATION.uk;
  }

  if (/(france|paris|germany|berlin|munich|italy|rome|spain|madrid|europe|eu)/.test(normalized)) {
    return CURRENCY_BY_LOCATION.europe;
  }

  if (/(canada|toronto|vancouver|montreal|calgary|ottawa)/.test(normalized)) {
    return CURRENCY_BY_LOCATION.canada;
  }

  if (/(australia|sydney|melbourne|perth|brisbane)/.test(normalized)) {
    return CURRENCY_BY_LOCATION.australia;
  }

  return CURRENCY_BY_LOCATION.default;
}

export function formatCurrency(value, location = '', options = {}, currencyCodeOverride = null) {
  const number = Number(value ?? 0);
  const currencyInfo = getCurrencyForLocation(location, currencyCodeOverride);
  const formatter = new Intl.NumberFormat(currencyInfo.locale, {
    style: 'currency',
    currency: currencyInfo.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options
  });

  return formatter.format(number);
}

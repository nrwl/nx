const restrictedCountries: string[] = [
  'BY', // Belarus
  'CN', // China
  'CU', // Cuba
  'IR', // Iran
  'KP', // North Korea
  'RU', // Russia
  'SY', // Syria
  'VE', // Venezuela
];

// Netlify sets x-nf-geo to base64-encoded JSON; it is absent outside Netlify.
function getCountryCode(request: Request): string | undefined {
  const geo = request.headers.get('x-nf-geo');
  if (!geo) {
    return undefined;
  }
  try {
    return JSON.parse(atob(geo))?.country?.code;
  } catch {
    return undefined;
  }
}

export function isRestrictedRegion(request: Request): boolean {
  const country = getCountryCode(request);
  return !!country && restrictedCountries.includes(country);
}

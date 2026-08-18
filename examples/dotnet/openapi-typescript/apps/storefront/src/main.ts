import type { WeatherForecast } from '@example/api-client';

/**
 * Ordinary consumer code. Nothing here knows the types came from C#.
 *
 * `toFixed` is a number method, so if `TemperatureC` stops being an `int` on
 * the server this stops compiling, and it stops compiling here in the front end
 * rather than failing at runtime against a response that no longer matches.
 */
export function formatForecast(forecast: WeatherForecast): string {
  const celsius = forecast.temperatureC.toFixed(0);
  return `${forecast.summary ?? 'Unknown'}: ${celsius}C`;
}

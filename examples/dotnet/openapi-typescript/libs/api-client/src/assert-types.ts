/**
 * This file is the point of the example. It is hand-written and checked in,
 * while everything under `./generated` is produced by the `codegen` target and
 * gitignored.
 *
 * Nothing here runs. It exists so that `tsc --noEmit` fails when the types that
 * cross the C#/TypeScript boundary stop matching what `apps/Api` declares. That
 * is the whole promise of generating a client from the API: a change on the
 * server becomes a compile error on the client, not a runtime surprise.
 *
 * To watch it work, change `int TemperatureC` to `string TemperatureC` in
 * `apps/Api/Program.cs` and run `nx run-many -t build,codegen,typecheck`.
 */
import type { WeatherForecast } from './generated';

declare const forecast: WeatherForecast;

// A C# `int` has to arrive as a `number`.
//
// This is also the regression test for a real failure that appears on .NET 10:
// there the emitted document is OpenAPI 3.1, ASP.NET Core's default
// NumberHandling reports the property as a union of `integer` and `string`, and
// openapi-generator answers a union it cannot map with an empty interface. `{}`
// is assignable from anything but not TO `number`, so this line is what catches
// it. See `Program.cs` for the server-side fix.
export const temperatureC: number = forecast.temperatureC;

// A C# `string?` has to arrive as nullable, and has to stay required: the
// property is always present, its value may be null.
export const summary: string | null = forecast.summary;

// A computed C# property is still part of the contract.
export const temperatureF: number | undefined = forecast.temperatureF;

// A `DateOnly` arrives as a `Date` under typescript-fetch, not a string.
export const date: Date = forecast.date;

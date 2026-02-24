export type ParameterValue = number | boolean | string;

/**
 * Event scoped custom dimensions.
 * @remarks
 * - Event custom dimensions limit is 50.
 * - `ep.*` string type.
 * - `epn.*` number type.
 * @see https://support.google.com/analytics/answer/10075209?hl=en
 */
export enum EventCustomDimension {
  Command = 'ep.nx_command',
  GeneratorName = 'ep.generator_name',
  PackageName = 'ep.package_name',
  PackageVersion = 'ep.package_version',
}

/**
 * Event scoped custom mertics.
 * @remarks
 * - Event scoped custom mertics limit is 50.
 * - `ep.*` string type.
 * - `epn.*` number type.
 * @see https://support.google.com/analytics/answer/10075209?hl=en
 */
export enum EventCustomMetric {
  Time = 'epn.time',
}

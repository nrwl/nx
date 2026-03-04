import { IS_WASM } from '../native';

export type ParameterValue = number | boolean | string;

/**
 * Event dimension and metric names — sourced from Rust (telemetry/mod.rs).
 * These are the canonical GA4 parameter names used in analytics events.
 * Analytics is not supported on WASM, so dimensions are only loaded from native.
 *
 * @see https://support.google.com/analytics/answer/10075209?hl=en
 */

const dimensions = IS_WASM ? null : require('../native').getEventDimensions();

/**
 * Event scoped custom dimensions (ep.* = string).
 */
export const EventCustomDimension = {
  Command: dimensions?.command as string,
  GeneratorName: dimensions?.generatorName as string,
  PackageName: dimensions?.packageName as string,
  PackageVersion: dimensions?.packageVersion as string,
  CreateProjectGraph: dimensions?.createProjectGraph as string,
};

/**
 * Event scoped custom metrics (epn.* = number).
 */
export const EventCustomMetric = {
  Duration: dimensions?.duration as string,
};

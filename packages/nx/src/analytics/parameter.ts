export type ParameterValue = number | boolean | string;

/**
 * GA built-in request parameters
 * @see https://www.thyngster.com/ga4-measurement-protocol-cheatsheet
 * @see http://go/depot/google3/analytics/container_tag/templates/common/gold/mpv2_schema.js
 */
export enum RequestParameter {
  ClientId = 'cid',
  DebugView = '_dbg',
  GtmVersion = 'gtm',
  Language = 'ul',
  NewToSite = '_nsi',
  NonInteraction = 'ni',
  PageLocation = 'dl',
  PageTitle = 'dt',
  ProtocolVersion = 'v',
  SessionEngaged = 'seg',
  SessionId = 'sid',
  SessionNumber = 'sct',
  SessionStart = '_ss',
  TrackingId = 'tid',
  TrafficType = 'tt',
  UserAgentArchitecture = 'uaa',
  UserAgentBitness = 'uab',
  UserAgentFullVersionList = 'uafvl',
  UserAgentMobile = 'uamb',
  UserAgentModel = 'uam',
  UserAgentPlatform = 'uap',
  UserAgentPlatformVersion = 'uapv',
  UserId = 'uid',
}

/**
 * User scoped custom dimensions.
 * @remarks
 * - User custom dimensions limit is 25.
 * - `up.*` string type.
 * - `upn.*` number type.
 * @see https://support.google.com/analytics/answer/10075209?hl=en
 */
export enum UserCustomDimension {
  UserId = 'up.user_id',
  OsArchitecture = 'up.os_architecture',
  NodeVersion = 'up.node_version',
  NxVersion = 'up.nx_version',
  PackageManager = 'up.package_manager',
  PackageManagerVersion = 'up.pkg_manager_version',
}

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
  GeneratorCollectionName = 'ep.generator_collection_name',
  GeneratorName = 'ep.generator_name',
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

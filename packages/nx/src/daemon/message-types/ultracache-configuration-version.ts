/**
 * One stored version of an Ultracache configuration: what crosses the socket
 * in place of the handle.
 */
export interface UltracacheConfigurationVersion {
  commit: string;
  fetchedAt: number;
}

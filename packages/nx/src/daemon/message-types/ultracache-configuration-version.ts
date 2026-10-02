/**
 * One stored version of a commit's Ultracache configurations: what crosses
 * the socket in place of the handle.
 */
export interface UltracacheConfigurationVersion {
  commit: string;
  fetchedAt: number;
}

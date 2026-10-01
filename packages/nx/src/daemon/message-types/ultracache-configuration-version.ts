/** One stored version of a snapshot set: what crosses the socket in place of the handle. */
export interface UltracacheConfigurationVersion {
  commit: string;
  fetchedAt: number;
}

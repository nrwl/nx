import type { NxReleaseConfiguration } from '../../config/nx-json';
import { createAPI as createReleaseChangelogAPI } from './changelog';
import { createAPI as createReleasePublishAPI } from './publish';
import { createAPI as createReleaseAPI } from './release';
import { createAPI as createReleaseVersionAPI } from './version';

/**
 * @public
 */
export class ReleaseClient {
  releaseChangelog = createReleaseChangelogAPI(this.overrideReleaseConfig);
  releasePublish = createReleasePublishAPI(this.overrideReleaseConfig);
  releaseVersion = createReleaseVersionAPI(this.overrideReleaseConfig);
  release = createReleaseAPI(this.overrideReleaseConfig);

  constructor(private overrideReleaseConfig: NxReleaseConfiguration) {}
}

const defaultClient = new ReleaseClient({});

/**
 * @public
 */
export const releaseChangelog = defaultClient.releaseChangelog.bind(
  defaultClient
) as typeof defaultClient.releaseChangelog;

/**
 * @public
 */
export { PublishProjectsResult } from './publish';
/**
 * @public
 */
export const releasePublish = defaultClient.releasePublish.bind(
  defaultClient
) as typeof defaultClient.releasePublish;

/**
 * @public
 */
export const releaseVersion = defaultClient.releaseVersion.bind(
  defaultClient
) as typeof defaultClient.releaseVersion;

/**
 * @public
 */
export const release = defaultClient.release.bind(
  defaultClient
) as typeof defaultClient.release;

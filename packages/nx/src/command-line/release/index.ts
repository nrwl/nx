import type { NxReleaseConfiguration } from '../../config/nx-json';
import { createAPI as createReleaseChangelogAPI } from './changelog';
import { createAPI as createReleasePublishAPI } from './publish';
import { createAPI as createReleaseAPI } from './release';
import { createAPI as createReleaseVersionAPI } from './version';

/**
 * @public
 */
export class ReleaseClient {
  releaseChangelog = createReleaseChangelogAPI(
    this.nxReleaseConfig,
    this.ignoreNxJsonConfig
  );
  releasePublish = createReleasePublishAPI(
    this.nxReleaseConfig,
    this.ignoreNxJsonConfig
  );
  releaseVersion = createReleaseVersionAPI(
    this.nxReleaseConfig,
    this.ignoreNxJsonConfig
  );
  release = createReleaseAPI(this.nxReleaseConfig, this.ignoreNxJsonConfig);

  constructor(
    /**
     * Nx release configuration to use for the current release client. By default, it will be combined with any
     * configuration in nx.json, but you can choose to use it as the sole source of truth by setting ignoreNxJsonConfig
     * to true.
     */
    private nxReleaseConfig: NxReleaseConfiguration,
    private ignoreNxJsonConfig: boolean = false
  ) {}
}

const defaultClient = new ReleaseClient({} as NxReleaseConfiguration);

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

/**
 * @public
 */
export {
  AfterAllProjectsVersioned,
  VersionActions,
} from './version/version-actions';

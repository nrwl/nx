"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionActions = exports.release = exports.releaseVersion = exports.releasePublish = exports.releaseChangelog = exports.ReleaseClient = void 0;
const changelog_1 = require("./changelog");
const publish_1 = require("./publish");
const release_1 = require("./release");
const version_1 = require("./version");
/**
 * @public
 */
class ReleaseClient {
    constructor(
    /**
     * Nx release configuration to use for the current release client. By default, it will be combined with any
     * configuration in nx.json, but you can choose to use it as the sole source of truth by setting ignoreNxJsonConfig
     * to true.
     */
    nxReleaseConfig, ignoreNxJsonConfig = false) {
        this.nxReleaseConfig = nxReleaseConfig;
        this.ignoreNxJsonConfig = ignoreNxJsonConfig;
        this.releaseChangelog = (0, changelog_1.createAPI)(this.nxReleaseConfig, this.ignoreNxJsonConfig);
        this.releasePublish = (0, publish_1.createAPI)(this.nxReleaseConfig, this.ignoreNxJsonConfig);
        this.releaseVersion = (0, version_1.createAPI)(this.nxReleaseConfig, this.ignoreNxJsonConfig);
        this.release = (0, release_1.createAPI)(this.nxReleaseConfig, this.ignoreNxJsonConfig);
    }
}
exports.ReleaseClient = ReleaseClient;
const defaultClient = new ReleaseClient({});
/**
 * @public
 */
exports.releaseChangelog = defaultClient.releaseChangelog.bind(defaultClient);
/**
 * @public
 */
exports.releasePublish = defaultClient.releasePublish.bind(defaultClient);
/**
 * @public
 */
exports.releaseVersion = defaultClient.releaseVersion.bind(defaultClient);
/**
 * @public
 */
exports.release = defaultClient.release.bind(defaultClient);
/**
 * @public
 */
var version_actions_1 = require("./version/version-actions");
Object.defineProperty(exports, "VersionActions", { enumerable: true, get: function () { return version_actions_1.VersionActions; } });

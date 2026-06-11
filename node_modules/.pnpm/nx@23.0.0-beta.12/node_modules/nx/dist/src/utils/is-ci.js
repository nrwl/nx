"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCI = isCI;
function isCI() {
    if (process.env.CI === 'false') {
        return false;
    }
    return (process.env.CI ||
        process.env.TF_BUILD === 'true' ||
        process.env.GITHUB_ACTIONS === 'true' ||
        process.env.BUILDKITE === 'true' ||
        process.env.CIRCLECI === 'true' ||
        process.env.CIRRUS_CI === 'true' ||
        process.env.TRAVIS === 'true' ||
        !!process.env['bamboo.buildKey'] ||
        !!process.env['bamboo_buildKey'] ||
        !!process.env.CODEBUILD_BUILD_ID ||
        !!process.env.GITLAB_CI ||
        !!process.env.HEROKU_TEST_RUN_ID ||
        !!process.env.BUILD_ID ||
        !!process.env.BUILD_NUMBER ||
        !!process.env.BUILD_BUILDID ||
        !!process.env.TEAMCITY_VERSION ||
        !!process.env.JENKINS_URL ||
        !!process.env.HUDSON_URL);
}

use std::env;

pub fn is_ci() -> bool {
    env::var("CI").is_ok_and(|s| s != "false")
        || env::var("TF_BUILD").is_ok_and(|s| s == "true")
        || env::var("GITHUB_ACTIONS").is_ok_and(|s| s == "true")
        || env::var("BUILDKITE").is_ok_and(|s| s == "true")
        || env::var("CIRCLECI").is_ok_and(|s| s == "true")
        || env::var("CIRRUS_CI").is_ok_and(|s| s == "true")
        || env::var("TRAVIS").is_ok_and(|s| s == "true")
        || env::var("bamboo.buildKey").is_ok()
        || env::var("bamboo_buildKey").is_ok()
        || env::var("CODEBUILD_BUILD_ID").is_ok()
        || env::var("GITLAB_CI").is_ok()
        || env::var("HEROKU_TEST_RUN_ID").is_ok()
        || env::var("BUILD_ID").is_ok()
        || env::var("BUILD_BUILDID").is_ok()
        || env::var("TEAMCITY_VERSION").is_ok()
}

use std::env;

pub fn is_ci() -> bool {
    // Match the CLI's isCI: an explicit CI=false overrides provider variables.
    if let Ok(ci) = env::var("CI")
        && !ci.is_empty()
    {
        return ci != "false";
    }
    env::var("TF_BUILD").is_ok_and(|s| s == "true")
        || env::var("GITHUB_ACTIONS").is_ok_and(|s| s == "true")
        || env::var("BUILDKITE").is_ok_and(|s| s == "true")
        || env::var("CIRCLECI").is_ok_and(|s| s == "true")
        || env::var("CIRRUS_CI").is_ok_and(|s| s == "true")
        || env::var("TRAVIS").is_ok_and(|s| s == "true")
        || [
            "bamboo.buildKey",
            "bamboo_buildKey",
            "CODEBUILD_BUILD_ID",
            "GITLAB_CI",
            "HEROKU_TEST_RUN_ID",
            "BUILD_ID",
            "BUILD_NUMBER",
            "BUILD_BUILDID",
            "TEAMCITY_VERSION",
            "JENKINS_URL",
            "HUDSON_URL",
        ]
        .iter()
        .any(|var| env::var_os(var).is_some_and(|value| !value.is_empty()))
}

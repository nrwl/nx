# CLI Overview

The Nx CLI provides the following commands:

- [generate](/{{framework}}/cli/generate): Runs a generator that creates and/or modifies files based on a generator from a collection.
- [serve](/{{framework}}/cli/serve): Builds and serves an application, rebuilding on file changes.
- [build](/{{framework}}/cli/build): Compiles an application into an output directory named dist/ at the given output path. Must be executed from within a workspace directory.
- [test](/{{framework}}/cli/test): Runs unit tests in a project using the configured unit test runner.
- [lint](/{{framework}}/cli/lint): Runs linting tools on application code in a given project folder using the configured linter.
- [e2e](/{{framework}}/cli/e2e): Builds and serves an app, then runs end-to-end tests using the configured E2E test runner.
- [run](/{{framework}}/cli/run): Runs an Architect target with an optional custom builder configuration defined in your project.
- [affected](/{{framework}}/cli/affected): Run task for affected projects
- [run-many](/{{framework}}/cli/run-many): Run task for multiple projects
- [affected:apps](/{{framework}}/cli/affected-apps): Print applications affected by changes
- [affected:libs](/{{framework}}/cli/affected-libs): Print libraries affected by changes
- [affected:build](/{{framework}}/cli/affected-build): Build applications and publishable libraries affected by changes
- [affected:test](/{{framework}}/cli/affected-test): Test projects affected by changes
- [affected:e2e](/{{framework}}/cli/affected-e2e): Run e2e tests for the applications affected by changes
- [affected:dep-graph](/{{framework}}/cli/affected-dep-graph): Graph dependencies affected by changes
- [print-affected](/{{framework}}/cli/print-affected): Graph execution plan
- [affected:lint](/{{framework}}/cli/affected-lint): Lint projects affected by changes
- [daemon:start](/{{framework}}/cli/daemon-start): EXPERIMENTAL: Start the project graph daemon server (either in the background or the current process)
- [daemon:stop](/{{framework}}/cli/daemon-stop): EXPERIMENTAL: Stop the project graph daemon server
- [dep-graph](/{{framework}}/cli/dep-graph): Graph dependencies within workspace
- [format:check](/{{framework}}/cli/format-check): Check for un-formatted files
- [format:write](/{{framework}}/cli/format-write): Overwrite un-formatted files
- [workspace-lint](/{{framework}}/cli/workspace-lint): Lint workspace or list of files. Note: To exclude files from this lint rule, you can add them to the ".nxignore" file
- [workspace-generator](/{{framework}}/cli/workspace-generator): Runs a workspace generator from the tools/generators directory
- [migrate](/{{framework}}/cli/migrate): Creates a migrations file or runs migrations from the migrations file.
- [report](/{{framework}}/cli/report): Reports useful version numbers to copy into the Nx issue template
- [list](/{{framework}}/cli/list): Lists installed plugins, capabilities of installed plugins and other available plugins.
- [clear-cache](/{{framework}}/cli/clear-cache): Clears all the cached Nx artifacts and metadata about the workspace.
- [connect-to-nx-cloud](/{{framework}}/cli/connect-to-nx-cloud): Makes sure the workspace is connected to Nx Cloud

# Environment Variables

### NX_BRANCH and NX_CI_EXECUTION_ID

{% callout type="info" %}
For most CI providers, `nx-cloud` is able to determine both `NX_BRANCH` and `NX_CI_EXECUTION_ID` automatically.
{% /callout %}

When running commands on CI, `nx-cloud` needs to know the current branch and the current CI execution ID (something that
uniquely identifies the current CI run or job). If you find you need to provide the `NX_BRANCH` and `NX_CI_EXECUTION_ID`
env variables manually you will need to set them on the main job _and_ on all agents. The value on the main job must match the value on the agent in each case.

{% callout type="warning" title="Version Control Integrations" %}
To make the GitHub, BitBucket and GitLab integrations work, `NX_BRANCH` must be set to the PR number, when available. Any other value will result in the integration failing and you won't get an Nx Cloud Report posted.
{% /callout %}

Nx Cloud uses `NX_CI_EXECUTION_ID` to match the agents and the main job. Sometimes you might have multiple
main jobs (e.g., when running CI on both Linux and Windows or when running the same commands against different versions
of Node.js or Java). In this case you can set the `NX_CI_EXECUTION_ENV` env variable on main jobs and agents. The main
job where the `NX_CI_EXECUTION_ENV` is set to, say, `macos`, will connect to the agents with the same env name.

### NX_CLOUD_ACCESS_TOKEN

You can also configure the access token by setting the `NX_CLOUD_ACCESS_TOKEN` environment
variable. `NX_CLOUD_ACCESS_TOKEN` takes precedence over the `accessToken` property. It's common to have a read-only
token stored in `nx.json` and a read-write token set via `NX_CLOUD_ACCESS_TOKEN` in CI. If you are using this
environment variable with Distributed Task Execution, the value on the main and agent jobs must match.

### NX_CLOUD_ENCRYPTION_KEY

You can set the `encryptionKey` property in `nx.json` or set the `NX_CLOUD_ENCRYPTION_KEY` environment variable to
enable the e2e encryption of your artifacts. In this case, the artifacts will be encrypted/decrypted on your machine.

### NX_CLOUD_NO_TIMEOUTS

By default, Nx Cloud requests will time out after 10 seconds. `NX_CLOUD_NO_TIMEOUTS` disables the timeout.

### NX_VERBOSE_LOGGING

Setting `NX_VERBOSE_LOGGING` to true will output the debug information about agents communicating with the main job.
This can be useful for debugging unexpected cache misses and issues with on-prem setups.

## Deprecated

### NX_RUN_GROUP

Older versions of `nx-cloud` used `NX_RUN_GROUP` instead of `NX_CI_EXECUTION_ID` and `NX_CI_EXECUTION_ENV`. It
served the same purpose.

### NX_CLOUD_DISTRIBUTED_EXECUTION_STOP_AGENTS_ON_FAILURE

Setting `NX_CLOUD_DISTRIBUTED_EXECUTION_STOP_AGENTS_ON_FAILURE` to `true` will tell Nx Cloud to stop agents if a command
fails. We recommend using `npx nx-cloud start-ci-run --stop-agents-on-failure=true` instead.

### NX_CLOUD_DISTRIBUTED_EXECUTION

Setting `NX_CLOUD_DISTRIBUTED_EXECUTION` to `false` disables distributed task execution. We recommend passing `--no-dte` or `--no-agents` instead.

## See Also

- [Nx Environment Variables](/reference/environment-variables)

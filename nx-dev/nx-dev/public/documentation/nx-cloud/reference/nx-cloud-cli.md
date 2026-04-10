# `nx-cloud` CLI

## npx nx-cloud login

To provision a local personal access token to access Nx Cloud features run `npx nx-cloud login`. This will open your browser to the Nx Cloud application and after signing in will generate a personal access token and save it in a configuration file locally called `nxcloud.ini`.

This command is the same as running `npx nx login`

{% tabs %}
{% tab label="macOS & Linux" %}

We look for this file at the following locations:

- `$XDG_CONFIG_HOME/nxcloud/nxcloud.ini`
- `$HOME/config/nxcloud/nxcloud.ini`
- `$HOME/.nxcloud.ini`

If we don't find an existing config file, we create one at `$HOME/config/nxcloud/nxcloud.ini`

{% /tab %}
{% tab label="Windows" %}

We look for this file within the `%LOCALAPPDATA%/nxcloud` directory and if it does not exist, we will create a new `nxcloud.ini` file there.

{% /tab %}
{% /tabs %}

The format of this file is as follows:

```ini
[https://cloud\.nx\.app]
personalAccessToken=SOME_ACCESS_TOKEN
```

If you have access to multiple instances of the Nx Cloud application (e.g. self-hosted Enterprise and our managed instance), each instance will be saved to this file under its URL.

Our managed instance at [https://cloud.nx.app](https://cloud.nx.app) is the default. To provision a personal access token from an alternative instance of Nx Cloud pass the URL as a positional parameter, e.g.

```bash
npx nx-cloud login https://nx-cloud.my-domain.app
```

## npx nx-cloud logout

To revoke a personal access token from your local environment, run `npx nx-cloud logout`. This will remove the personal access token from the locally initialized configuration file and also invalidate the token from the Nx Cloud application. You will be prompted to remove a single token or all tokens from your local environment.

## npx nx-cloud configure

To provision more than one personal access token for multiple contexts (e.g. home and work machines) you can use the personal access tokens page under your Nx Cloud profile. To save a personal access token to your local `nxcloud.ini` file without needing to edit the file yourself call `nx-cloud configure` like this:

```bash
npx nx-cloud configure --personalAccessToken=SOME_ACCESS_TOKEN
```

To configure multiple tokens for different instances of the Nx Cloud app, you can pass the URL as follows:

```bash
npx nx-cloud configure --personalAccessToken=SOME_ACCESS_TOKEN --nx-cloud-url=https://nx-cloud.my-domain.app
```

## npx nx-cloud convert-to-nx-cloud-id

When logging into Nx Cloud with a [Personal Access Token](/ci/recipes/security/personal-access-tokens), your `nx.json` file needs to include the `nxCloudId` property, which acts as a unique identifier for your workspace. If you have been using the previous `nxCloudAccessToken` to connect, simply run `npx nx-cloud convert-to-nx-cloud-id` to automatically update your configuration to use `nxCloudId`.

If you are connecting to Nx Cloud with a workspace that is version 19.6 or lower, this command will also install the latest version of the Nx Cloud npm package and add it into your `package.json`. Only Nx versions 19.7 and higher natively support the `nxCloudId` property in the `nx.json` file; for versions 19.6 and lower, the Nx Cloud npm package will be needed to use that property.

## npx nx-cloud start-ci-run

At the beginning of your main job, invoke `npx nx-cloud start-ci-run`. This tells Nx Cloud that the following series of
command correspond to the same CI run.

{% callout type="warning" title="Do not run start-ci-run locally" %}
`npx nx-cloud start-ci-run` generates a temporary marker file that can cause a local Nx repo to behave as if it is a part of a CI run. This can cause strange behavior like Nx commands timing out or throwing unexpected errors.
To discourage this from happening, this command will run a check to see if it is running in a CI environment. You can bypass this check with `npx nx-cloud start-ci-run --force`.

If you accidentally run this command locally, remove all generated marker files with `npx nx-cloud cleanup`.
{% /callout %}

You can configure your CI run by passing the following flags:

### --distribute-on

By default, `npx nx-cloud start-ci-run` is intended for use with [Nx Agents](/ci/features/distribute-task-execution) and expects `--distribute-on` to be configured. It will output a warning if this flag is not set. If you are running a distributed execution with a legacy setup without Nx Agents, you can pass `--distribute-on=manual` to disable this warning.

This command tells Nx Cloud how many agents to use (and what launch templates to use) to distribute tasks. E.g.,
`npx nx-cloud start-ci-run --distribute-on="8 linux-medium-js"` will distribute CI using 8 agents that are initialized
using the `linux-medium-js` launch template.

You can also [define the configuration in a file](/ci/features/dynamic-agents) and reference it as follows:
`npx nx-cloud start-ci-run --distribute-on=".nx/workflows/dynamic-changesets.yaml"`.

```yaml {% fileName=".nx/workflows/dynamic-changesets.yaml" %}
distribute-on:
  small-changeset: 3 linux-medium-js
  medium-changeset: 6 linux-medium-js
  large-changeset: 10 linux-medium-js
```

### --require-explicit-completion

By default, Nx Cloud will monitor the main CI job and once that completes it will complete the associated CIPE object on the
Nx Cloud side. You can disable this by passing `--require-explicit-completion`. In this case, you will have to add
`npx nx-cloud complete-ci-run`.

### --stop-agents-after

You can tell Nx Cloud to terminate agents after it sees a certain
target: `npx nx-cloud start-ci-run --stop-agents-after=e2e`.

The target name for `--stop-agents-after` should be the last target run within your pipeline. If not, Nx Cloud will end the CI pipeline execution, preventing the subsequent commands from running.

#### Incorrect example:

```yaml
- run: npx nx-cloud start-ci-run --stop-agents-after=build
- run: nx affected -t build
- run: nx affected -t lint
- run: nx affected -t test
```

If build tasks are all cached, then all build tasks will complete immediately causing lint and test tasks to fail with an error saying the CI pipeline execution has already been completed. Instead you should re-order your targets to make sure the build target is last.

#### Corrected example:

```yaml
- run: npx nx-cloud start-ci-run --stop-agents-after=build
- run: nx affected -t lint
- run: nx affected -t test
- run: nx affected -t build
```

### --stop-agents-on-failure

By default, a failure in one of the commands is going to terminate the whole CI run and will stop all the
agents. You can disable this as follows: `npx nx-cloud start-ci-run --stop-agents-on-failure=false`.

### --use-dte-by-default

By default, invoking `npx nx-cloud start-ci-run` will configure Nx to distribute all commands by default. You can
disable this as follows: `npx nx-cloud start-ci-run --use-dte-by-default=false`.

### --with-env-vars (Nx Agents Only)

By default, invoking `npx nx-cloud start-ci-run` will take all environment variables prefixed with `NX_` and send them over to Nx Agents.
This means that your access token, verbose logging configuration and other Nx-related environment variables will be the same on your
main CI jobs and the Nx Agent machines.

If you want to pass other environment variables from the main job to Nx Agents, you can do it as follows: `--with-env-vars="VAR1,VAR2"`.
This will set `VAR1` and `VAR2` on Nx Agents to the same values set on the main job before any steps run.

You can also pass `--with-env-vars="auto"` which will filter out all OS-specific environment variables and pass the rest to Nx Agents.

{% callout type="warning" title="Use Caution With 'auto'" %}
Using `--with-env-vars="auto"` will override any existing environment variables on the Nx Agent, some of which might be critical to the
functionality of that machine. In case of unexpected issues on Nx Agents, try fallback to the explicit variable definition using `--with-env-vars="VAR1,VAR2,..."`.
{% /callout %}

Note: none of the values passed to Nx Agents are stored by Nx Cloud.

### Enabling/Disabling Distribution

Invoking `npx nx-cloud start-ci-run` will tell Nx to distribute by default. You can enable/disable distribution for
individual commands as follows:

{% tabs %}
{% tab label="Nx >= 18" %}

- `nx affected -t build --agents` (explicitly enable distribution)
- `nx affected -t build --no-agents` (explicitly disable distribution)

{% /tab %}
{% tab label="Nx >= 14.7" %}

- `nx affected -t build --dte` (explicitly enable distribution)
- `nx affected -t build --no-dte` (explicitly disable distribution)

{% /tab %}
{% /tabs %}

## npx nx-cloud stop-all-agents

Same as `npx nx-cloud complete-ci-run`.

This command tells Nx Cloud to terminate all agents associated with this CI pipeline execution.
Invoking this command is not needed anymore. New versions of Nx Cloud can track when the main job terminates
and terminate associated agents automatically.

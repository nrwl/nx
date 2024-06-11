# `nx-cloud` CLI

## npx nx-cloud start-ci-run

At the beginning of your main job, invoke `npx nx-cloud start-ci-run`. This tells Nx Cloud that the following series of
command correspond to the same CI run.

{% callout type="warning" title="Do not run start-ci-run locally" %}
`nx-cloud start-ci-run` generates a temporary marker file that can cause a local Nx repo to behave as if it is a part of a CI run. This can cause strange behavior like Nx commands timing out or throwing unexpected errors.
To discourage this from happening, this command will run a check to see if it is running in a CI environment. You can bypass this check with `nx-cloud start-ci-run --force`.

If you accidentally run this command locally, remove all generated marker files with `nx-cloud cleanup`.
{% /callout %}

You can configure your CI run by passing the following flags:

### --distribute-on

Tells Nx Cloud how many agents to use (and what launch templates to use) to distribute tasks. E.g.,
`npx nx-cloud start-ci-run --distribute-on="8 linux-medium-js"` will distribute CI using 8 agents that are initialized
using the `linux-medium-js` launch template.

You can use different types of launch templates as follows:
`npx nx-cloud start-ci-run --distribute-on="5 linux-medium-js, 3 linux-large-js"`.

You can also define the configuration in a file and reference it as follows:
`npx nx-cloud start-ci-run --distribute-on=".nx/workflows/dynamic-changesets.yaml"`.

```yaml {% fileName=".nx/workflows/dynamic-changesets.yaml" %}
distribute-on:
  small-changeset: 3 linux-medium-js
  medium-changeset: 6 linux-medium-js
  large-changeset: 10 linux-medium-js
```

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

### --use-dte-by-default

By default, invoking `npx nx-cloud start-ci-run` will configure Nx to distribute all commands by default. You can
disable this as follows: `npx nx-cloud start-ci-run --use-dte-by-default=false`.

### --stop-agents-on-failure

By default, a failure in one of the commands is going to terminate the whole CI run and will stop all the
agents. You can disable this as follows: `npx nx-cloud start-ci-run --stop-agents-on-failure=false`.

### --stop-agents-after

By default, Nx Cloud won't terminate any agents until you invoke `npx nx-cloud stop-all-agents` because Nx Cloud
doesn't know if you will need agents to run another command. This can result in agents being idle at the end of a CI
run.

You can fix it by telling Nx Cloud that it can terminate agents after it sees a certain
target: `npx nx-cloud start-ci-run --stop-agents-after=e2e`.

The target name for `--stop-agents-after` should be the last target run within your pipeline. If not, Nx Cloud will end the CI pipeline execution, preventing the subsequent commands from running.

Incorrect example:

```yaml
- run: npx nx-cloud start-ci-run --stop-agents-after=build
- run: nx affected -t build
- run: nx affected -t lint
- run: nx affected -t test
```

If build tasks are all cached, then all build tasks will complete immediately causing lint and test tasks to fail with an error saying the CI pipeline execution has already been completed. Instead you should re-order your targets to make sure the build target is last.

Corrected example:

```yaml
- run: npx nx-cloud start-ci-run --stop-agents-after=build
- run: nx affected -t lint
- run: nx affected -t test
- run: nx affected -t build
```

### --require-explicit-completion

By default, Nx Cloud will monitor the main CI job and once it completes it will complete the associated CIPE object on the
Nx Cloud side. You can disable this by passing `--require-explicit-completion`. In this case, you will have to add
`npx nx-cloud complete-ci-run`.

## Enabling/Disabling Distribution

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

# `nx-cloud` CLI

## npx nx-cloud start-ci-run

At the beginning of your main job, invoke `npx nx-cloud start-ci-run`. This tells Nx Cloud that the following series of
command correspond to the same CI run.

You can configure your CI run by passing the following flags:

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

> Earlier versions of `nx-cloud` required you to set the `NX_CLOUD_DISTRIBUTED_EXECUTION` env variable to `true`
> to
> enable DTE, but in the latest version `npx nx-cloud start-ci-run` does it automatically.

## Enabling/Disabling DTE

Invoking `npx nx-cloud start-ci-run` will tell Nx to distribute by default. You can enable/disable distribution for
individual commands as follows:

- `nx affected -t build --dte` (explicitly enable distribution, Nx >= 14.7)
- `nx affected -t build --no-dte` (explicitly disable distribution, Nx >= 14.7)
- `NX_CLOUD_DISTRIBUTED_EXECUTION=true nx affected -t build` (explicitly enable distribution)
- `NX_CLOUD_DISTRIBUTED_EXECUTION=false nx affected -t build` (explicitly disable distribution)

## npx nx-cloud stop-all-agents

This command tells Nx Cloud to terminate all agents associated with this CI run.

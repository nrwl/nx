# Distributed Task Execution

> Before reading this guide, check out the [mental model guide](/using-nx/mental-model). It will help you understand how computation caching fits into the rest of Nx.

<div class="nx-cloud-section">

## Overview

Nx supports running commands across multiple machines. You can either set it up by hand (
see [here](/ci/distributed-builds)) or use Nx Cloud.

[Read the comparison of the two approaches.](https://blog.nrwl.io/distributing-ci-binning-and-distributed-task-execution-632fe31a8953?source=friends_link&sk=5120b7ff982730854ed22becfe7a640a)

When using the distributed task execution, Nx is able to run any task graph on many agents instead of locally.

For instance, `nx affected --build` won't run the build locally (which can take hours for large workspaces). Instead,
it will send the Task Graph to Nx Cloud. Nx Cloud Agents will then pick up the tasks they can run and execute them.

Note that this happens transparently. If an agent builds `app1`, it will fetch the outputs for `lib` if it doesn't have them
already.

As agents complete tasks, the main job where you invoked `nx affected --build` will start receiving created files and
terminal outputs.

After `nx affected --build` completes, the machine will have the build files and all the terminal outputs as if it ran
it locally.

![DTE](/shared/mental-model/dte.png)

## Example

[This is an example repo](https://github.com/vsavkin/interstellar) showing how easy it is to set up distributed task execution, showing the performance gains, and comparing to sharding/binnig.

These are the savings you get by enabling Distributed Task Execution in your CI config:

![DTE](/shared/using-nx/dte.png)

</div>
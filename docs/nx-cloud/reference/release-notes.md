# Enterprise Release Notes

### 2025.06.1

- Fix: GitHub connection issue on nx-api startup when Nx Agents are acrivated

### 2025.06

- Feat: Define your own custom resource classes (CPU, RAM etc.) for use with Nx Agents
  - See [configuration details](https://github.com/nrwl/nx-cloud-helm/blob/main/EXTERNAL-RESOURCE-CLASSES.md)
- Feat: Flaky task retry configuration
  - Configure in the workspace settings how Nx Cloud should handle flaky tasks
- Feat: Full GitLab integration
  - Allows automatic members sync to your Nx Cloud workspace
- Feat: Agent logs timestamps and full-screen mode
- Feat: Assignment rules updates
  - Parallelism configuration
  - Target globs
  - See [here](/ci/reference/assignment-rules#how-to-define-an-assignment-rule) for examples
- Feat: Parallel agent steps and step groups (docs [here](/ci/reference/launch-templates#launchtemplatestemplatenamegroupname))
- Feat: Reusable agent launch template snippets via yaml anchors
  - See example [here](/ci/reference/launch-templates#full-example)
  - Specifically how `common-init-steps: &common-init-steps` is defined
- Feat: Individual GitHub commit statuses for each run group
  - This is configurable in your workspace settings
  - See [here](/ci/recipes/source-control-integration/github#github-status-checks) for branch settings configuration
  - You might also need [to update your GitHub app permissions](/ci/recipes/enterprise/single-tenant/custom-github-app#configure-permissions-for-the-github-app)
- Misc: CIPE list is sortable by duration
- Fix: early DTE job termination improvements
- Fix: run details page performance improvements

### 2025.03.3

- Feat: provide prebuilt Java cert store to NxAPI
  - Full details [here](https://github.com/nrwl/nx-cloud-helm/blob/main/PROXY-GUIDE.md#pre-built-java-cacerts)

### 2025.03.2

- Feat: Nx Agents "bundled executors"

  - up until now, the "executor" binaries that run on each Nx Agent (and know how to parse your agents.yaml and run each step) had to be downloaded separately from an external bucket
  - this made the on-prem upgrade process more difficult, as it required a separate step to download the executor and then upload it in the correct folder on an internally available repository
  - now, the executors are available as Docker images that can be imported alongside all your other NxCloud images
  - to get started:

    - when upgrading to this version, make sure you also pull in the executor image `nxprivatecloud/nx-cloud-workflow-executor:2025.03.2`([link](https://hub.docker.com/repository/docker/nxprivatecloud/nx-cloud-workflow-executor/tags/2025.03.2/sha256-a42835a3126f21178af87f02b68d68fec1ff0654d37a57855a762c01e7795a6b))
    - as part of your controller [args](https://github.com/nrwl/nx-cloud-helm/blob/main/charts/nx-agents/values.yaml#L76) pass this option:

      ```
      args:
        # pass the internal image registry where the pods can pull the executor images from
        # for example: image-registry: us-east1-docker.pkg.dev/nxcloudoperations/nx-cloud-enterprise-public
        image-registry=<registry-where-nxcloud-images-are-hosted>

        # you can REMOVE the below option, as it's not needed anymore
        # kube-unix-init-container-name=...
      ```

    - you no longer need to upload the executor binary separately to a bucket
    - now whenever you start your agent pods, they will load the above image and copy the executor from there

### 2025.03.1

- Fix: use custom "github URL" (if defined) when checking out the repo on Nx Agents

### 2025.03

##### Assignment rules

Assignment rules allow you to control which tasks can run on which agents. Save on agent costs by provisioning different sizes of agents to suit the individual needs of your tasks. You can ensure resource intensive targets like `e2e-ci` and `build` have what they need by using larger agents. Lighter tasks like `lint` and `test` can run on smaller agents.

Assignment rules are defined in yaml files within your workspace's `.nx/workflows` directory. You can use assignment rules with DTE-agents or with dynamic Nx Agents. Note that additional configuration is required when using DTE agents.

Read the full docs [here](/ci/reference/assignment-rules#assignment-rules-beta).

Once you start using assignment rules, you'll be able to see all your configured "rules" in your CIPE "Analysis page".

##### DTE/Agent utilization visualization

Speaking about the CIPE "Analysis" page, the agent utilization graph has been completely revamped.

The new agent utilization visualization allows you to see when agents were actively executing tasks, and gaps when agents were idle. You can use this tool to optimize how work gets distributed, and modify your commands and dependencies to remove idle time. Tasks that hang will be highlighted in yellow, helping you debug OOM issues. If you’re using Nx Agents, you’ll also see set up steps on the visualization.

##### Workspace data caching

Before an Nx command is run, Nx will generate some metadata that it will use when evaluating tasks (i.e project graph) and store that data in the workspace-data folder. This short process is relatively quick for small repos and only needs to be performed upon the first call to Nx. However, for larger repos and cases where Nx is frequently generating this information from scratch, it becomes a large time sink. In CI, workspace-data needs to be generated each time a new pipeline is run and each agent needs to generate its own identical copy.

You can now set-up NxCloud to cache the default branch's workspace data and allow pipeline agents to retrieve it from the cache rather than regenerate this metadata each time.

To enable it, you need to set this env variable on the nx-api deployment:

- `NX_CLOUD_WORKSPACE_ARTIFACTS_STORAGE_BUCKET=<cloud-provider-bucket-name>`
- it will then use the same authentication mechanism you've set up for your main cache bucket
- if you do not use a cloud provider bucket such as S3, you can set this variable to `NX_CLOUD_WORKSPACE_ARTIFACTS_STORAGE_BUCKET=file-server` and it will use your local cluster file server

##### Misc Items

- a new version of the AMQ image was released with the latest security patches and fixes
- node modules caching fixes on Nx Agents
  - previously, we were always recommending caching the `node_modules` folder itself in your Nx Agents yaml configs
  - this does not work with `npm ci`, as it always deletes the local `node_modules` folder before starting the installation. Instead, NPM recommends caching the `$HOME/.npm` directory.
  - Yarn and PNPM also have their own dedicated folders they recommend for caching
  - Part of this release, we now fixed caching folders in the `$HOME` directory, so all the below options should work:
    - `~/.npm`
    - `~/.cache/yarn`
    - `.pnpm-store` (note PNPM on Nx Agents does not store its cache folder in the $HOME dir)
  - Please refer to the [custom launch templates docs](/ci/reference/launch-templates#full-example) for how you can setup your caching under these new recommendations
- Nx Agents `$HOME` directory mounting
  - previously, when your Nx Agents pods were starting up, we were mounting as a k8s volume just the folder in which you checkout your repo: `$HOME/workspace`
  - however, a lot of dependencies and third-party apps use `$HOME` folder to deposit a lot of files (Rust, NPM cache folders etc.)
  - this caused agents to fight for available space on the node itself, causing very hard to debug issues if the space requirements were too big
  - part of this release, we now mount the whole `$HOME` directory as a volume, ensuring each agent gets a predictable storage size allocated
  - this also enables Nx Agents to run in more restricted environments (such as OpenShift), where read-only file systems are enforced (due to mountable volumes being writeable)
  - to enable this:
    - ensure you use (or are extending from) one of our pre-built agents base images
      - this is the image you set in your `image:` portion of your `agents.yaml`
      - (you are most likely using one of our images, so you can probably skip this step)
    - if you had to import the above image into your own internal registry, ensure it is part of a repository called `nx-agents-base-images`
      - Example (see the `nx-agents-base-images` part in this path): `image: 'us-east1-docker.pkg.dev/nxcloudoperations/nx-cloud-enterprise-public/nx-agents-base-images:ubuntu22.04-node20.11-v12'`
    - enable the `--copy-home-dir-init-container` flag [on the `controller.deployment.args` section in your Nx Agents `helm-config.yaml`](https://github.com/nrwl/nx-cloud-helm/blob/main/charts/nx-agents/values.yaml#L69)
- increase restart amount for agents
  - if any of your agents go down (either because one of their init steps fails, due to networking issues for example) or they run out of memory, we now try to restart them up to `N` times, where `N` is the number of agents you have
  - this should result in more pipeline stability, though it is worth to still monitor the failed steps to ensure any persistent issues get addressed
- addresses various potential race conditions in the NxCloud runner when restoring items from the cache (this was mainly noticeable on very large workspaces)
- various UI issues with the "compare tasks diff" have now been addressed
  - this is the tool used to diagnose why a cache hit did not occur and what the differences are between two given hashes

### 2025.01.4

- Misc: adds new custom Nx Agents resource classes

### 2025.01.3

- Misc: adds new custom Nx Agents resource classes

### 2025.01.2

- Fix: issue with decoding certain branch names in the URL (fixes loading certain run pages)

### 2025.01.1

- Fix: adds data migrations for older organizations

### 2025.01

##### Affected project graph

The affected project graph for pull requests has now made it to the on-prem release! Read the full announcement [here](/blog/ci-affected-graph).

##### DTE improvements

- There have been a lot of performance improvements to the DTE algorithm and how tasks get sorted to ensure optimal distribution
- Improved early agent shutdown: we now look at more parameters to decide whether we can shutdown a DTE agent earlier
- Project graph integrity checks
  - both the main job and the agents require the exact same project graph for the DTE algorithm to run correctly
  - differences can appear, for example, if the agents or main job restore an older cached version of the project graph (instead of re-calculating the current one)
  - it can also happen if the main job and agents run off of different commits (maybe your main CI job does a `git merge` with `main` and your agents do not)
  - we now explicitly check if the agents and main job run on the same exact commit hash and also if they use the same project graph: otherwise we fail the DTE early
- `stop-agents-after` now supports target configs
  - if you are running two affected commands at different points in your main job, each triggering the same target but under different configurations
    - `nx affected -t build:config1`
    - `nx affected -t build:config2`
  - you can configure agents to wait for both of them to complete before ending the DTE
    - `--stop-agents-after=build:config1,build:config2,lint,test`

##### Nx Agents improvements

Previously, if an agent ran out of memory or crashed in the middle of its run, the logs would be lost.
Now, we have a dedicated long-running "log uploader" that can upload logs even if the main agent container crashed.
To enable, you will need to configure the following env var on your workflow controller:

```yaml
- name: LOG_UPLOADER_IMAGE
  value: 'us-east1-docker.pkg.dev/nxcloudoperations/nx-cloud/nx-cloud-workflow-log-uploader'
```

We now also make much fewer requests to GitHub (or your other VCS providers) during a CIPE start, so you should see improved Nx Agents startup times.

##### PR comments look refresh

The PR comment containing status updates about your CI execution has had make-over, showing a more clear breakdown of your runs, their duration and the status:

![new PR comment](/nx-cloud/reference/images/new_github_comment.png)

##### Misc Items

- while we do our best to infer your commit message to display on the CIPE page, if it ever doesn't look right, you can manually override in your CI pipeline by setting `NX_CLOUD_COMMIT_MESSAGE`
- improved workspace analytics controls
- we now print more information on the main CI job summary table, such as a direct link to the associated CIPE
- there is now a workspace level setting enabling or disabling flaky task retrying

### 2024.10.3

- Feat: Support NO_PROXY env var on pods

### 2024.10.2

- Fix: AWS S3 bucket connections when using STS role-based authentication

### 2024.10.1

- Fix: GitHub and external bucket connection issues when using a proxy

### 2024.10

This is a big release so let's go through the highlights first. There is also an important "Breaking changes" section at the end.

##### New Version Structure

We have changed our version structure to a more simplified tag: `YEAR.MM.PATCH_NUMBER`
The goal is to make it easier to spot how old/recent your existing NxCloud version is and compare it against newer deployments.

##### DTE Summary Table on Main Agent

When distributing with DTE, up until now, we have been replaying all your tasks logs "as they come in" from the DTE agents back onto your main job.

This is not that useful on big workspaces, with large task affected task graphs as it can be hard to follow all the outputs from all the agents streaming back concurrently.

This release contains the new "CI Table Log View" summary, and you can read all about it [here](/blog/improved-ci-log-with-nx-cloud).

If you prefer the old logs style, you can always disable the feature via your workspace's settings screen.

##### Personal Access Tokens

Up until now, for developers to get access to read (and maybe write) to the cache you always needed an access token to be made available locally: either
committed to the repo via `nx.json` or made available as an env variable via a `.local.env` file.

This flow was secure enough as is, even if you never rotated your access tokens, as someone would still need continuous hourly access to your source code if they wanted to retrieve any of the latest cached artifacts.

But given you already manage developer access to your NxCloud workspace via the web app, we wanted to tie local cache access to that mechanism as well.

This release contains the new ["Personal Access Tokens"](/blog/personal-access-tokens) feature that now asks developers to login locally before they can use the cache.
If they are a member of the workspace, they get a local token stored on their machine that will be used to access the cache.
The moment they get removed as a member from your workspace, they won't be able to read from the cache anymore.

Please read the full announcement post here, as it contains details on how to migrate your team to using [Personal Access Tokens](/blog/personal-access-tokens).

##### GitHub App Integration

If you are using GitHub, setting up a custom GitHub app for your org is the best way to take advantage of all the latest "GitHub-specific" features we offer.
Please see instructions [here](/ci/recipes/enterprise/single-tenant/custom-github-app) on setting up an app.
You will then need to make sure you set up your VCS integration again through your workspace's settings screen, and use the above app you created.

As part of this, you will also get the "GitHub membership management" feature, where everybody who is a collaborator of your GitHub repo will also get "read" access to your NxCloud workspace,
without you having to explicitly invite them.

##### Misc Items

- Improved docker agents support
  - We fixed a few issues related to running docker builds in Nx Agents
- Big DTE performance improvements
- Azure file storage for Nx Agents
- Auth session length has been extended to 7 days by default
  - Use NX_CLOUD_SESSION_MAX_AGE to configure this to a different value
- Various SAML fixes and improvements
  - One highlight is that users can now login from Okta directly (while before they had to initiate login through NxCloud web app)

##### Breaking Changes

Most workspaces will not be affected by this, but if you have these values configured in your `helm-config.yaml`:

- `github.pr.[...]`
- or `gitlab.mr.[...]`

they will stop working with this release (see [this](https://github.com/nrwl/nx-cloud-helm/pull/141/files) for details on what was removed).
Please go to your workspace settings and you should be able to configure all the above values when you setup a VCS integration.

_Terminal outputs_ in the web app will now be fully served from storage bucket (either S3/Gcloud/Azure, or your internal file-server). This means your NxCloud cluster needs to have an open/healthy connection to the bucket. You can test this by ssh'ing into the `nx-cloud-frontend` pod and trying to `wget` one of your bucket artefacts. Any proxy or firewall constraints will need to be handled. Additionally, if your bucket is hosted at a self-signed https URL, any fetch calls from the frontend pod to your bucket will fail. If you think any of this applies to you, please contact your DPE to discuss options.

### 2406.29.1.patch1

- Fix an issue with specifying custom AWS credentials in Minio instances
- Fix an issue with removing pending invites

### 2406.29.1

##### Full terminal outputs in the web app

Due to storage constraints in Mongo, long terminal outputs were sometimes truncated when viewed in the UI. With this update we are now loading all terminal outputs directly
from the storage bucket, removing the need to keep them in Mongo. You should now be able to view full, complete logs in the UI regardless of how large the output is.

##### OpenShift fixes for Agents

- the latest messagequeue image is now OpenShift ready
  - to use, just update to the latest Helm version `0.15.6` and make sure you are not passing in an explicit tag for the messagequeue
  - then use version `2406.29.1` for NxCloud. This should use the latest, OpenShift enabled messagequeue image
- when running Agents on OpenShift, they run as a specific user with ID 1000
  - to override this, make sure to set `NX_CLOUD_RUN_UNIX_PODS_AS_USER: <userId>` and `NX_CLOUD_RUN_UNIX_PODS_AS_GROUP: <groupId>` on the [workflow controller env vars](https://github.com/nrwl/nx-cloud-helm/blob/main/charts/nx-agents/values.yaml#L63)

##### Full Bitbucket Data Center (on-prem)

We now have full support for BitBucket Data Center (self-hosted):

- VCS integration for posting comments with live updates about your CI runs
- full agents integration
- more info about each one of your commits on the NxCloud web app
- you can even [set-up auth with BitBucket Data Center](/ci/recipes/enterprise/single-tenant/auth-bitbucket-data-center#bitbucket-data-center-auth)

##### Misc

- easier workspace setup experience for new customers
- the CIPE visualisation has been updated (elapsed task time)
- general web app performance improvements

##### Breaking changes

If you are using DTE, you will now need to pass the `--distribute-on="manual"` flag to your `npx nx-cloud start-ci-run` commands.

### 2405.02.15

##### Easy membership management via GitHub

A few months ago, we introduced a new feature to our managed SASS NxCloud product: easy membership management via GitHub. If you create a new workspace on [https://cloud.nx.app/](https://cloud.nx.app/) right now you will be guided through how to connect it to your GitHub repository. Now everyone that has access to your GitHub repository will also get access to your NxCloud workspace. If anyone loses access to GitHub (maybe they leave the company), they will also lose access to NxCloud. This makes membership management easy and straightforward, as you don't have to manually invite users anymore. Of course, setting up this connection also gives you NxCloud run status updates directly on your PRs - a feature we've had for a long time.

This feature has now been release for on-prem set-ups as well. To benefit from it, you'll need to create your own Github App with permissions to access your repository. Your on-prem NxCloud instance will then use this app to pull membership info from Github and check user permissions. You can find [the full setup instructions here](/ci/recipes/enterprise/single-tenant/custom-github-app).

##### DTE v2 enabled by default

After testing the improved task distribution algorithm (DTE v2) for the past few months, we are now enabling it by default for all customers. Expect quicker CI run times when using DTE, and better utilization of your agents with less idle time.

##### Nx Agents and breaking changes

If you are using Nx Agents, this release will contain a breaking change to the workflow controller.
Before upgrading to this version, you'll need to follow the new [Agents Guide](https://github.com/nrwl/nx-cloud-helm/blob/main/agents-guide/AGENTS-GUIDE.md) and deploy an instance of Valkey that your controller can connect to.

The reason we need Valkey is that the workflow controller now persistently stores information about your workflows for up to 8 hours, and these changes will be persisted regardless of the availability of the workflow controller pod, making your in-progress workflows more resilient to rolling kubernetes updates, and will fix some previous issues with agent statuses not syncing to the UI.

If you are not using Nx Agents, this does not affect you and you can upgrade to this version straight away.

##### UI improvements

- If you are using the new Crystal plugins in Nx 18, we've now added a "technologies label" to each task, so you can quickly see which tasks are Playwright based, Cypress, React etc.
- We've added toast notifications in the app. You'll see them confirming some of your actions, such as saving workspace changes.

##### Misc fixes

- We've fixed various bugs around the task distribution algorithm and Nx Agents. CIPEs using distribution should feel more stable and faster.
- We fixed a few issues relating to the GitLab and BitBucket integrations.

### 2404.05.9

##### DTE Algorithm V2 Experimental Flag

For the past 2 months, we've been re-writing our entire task distribution algorithm. The aim was to allocate tasks more efficiently to agents,
reduce total time spent by agents downloading artefacts and reduce idle agent time waiting for tasks.

While the features is still in its beta stage, initial tests do show a big improvement in overall CI completion time
(but this varies on a case by case basis).

If you are already using DTE or Nx Agents, you can enable this experimental feature by adding the following env var to your main job (the job
where you invoke `npx start-ci-run`):

```yaml
NX_CLOUD_DTE_V2: 'true'
```

##### Nx Agents On-Prem Availability

Since the previous release, we've been testing various options for deploying Nx Agents on-premise.

We now have a dedicate Helm chart dedicated to setting up an Nx Agents cluster on your infrastructure:

1. ⚠️ Please reach out to your DPE first so we can start an Nx Agents trial and discuss any limitations and requirements up-front
2. You can view the example `values.yaml` [here](https://github.com/nrwl/nx-cloud-helm/blob/main/charts/nx-agents/values.yaml)
3. Once we had a chance to look at your existing CI compute requirements, you deploy the chart via `helm install nx-cloud nx-cloud/nx-agents --values=helm-values.yml`

##### Audit logger

As an Enterprise installation admin, you can now view audit logs over NxCloud workspace events by visiting `https://<NXCLOUD-URL>/audit-log`.

This includes events such as when a workspace was created, when a new VCS integration was set-up and so on.

##### UI improvements

- Organizations can now be created directly from the "Connect a workspace" screen
- Full screen terminal outputs for your tasks

### 2402.27.3.patch3,4,5,6

- Feat: allows customising the base image for the agent init-container (in case it is self-hosted internally in the company)
- Feat: adds more logging to debug authorization errors for Github, Gitlab and SAML
- Fix: fixes an issue with using custom launch templates on GitLab

### 2402.27.3.patch3

- Feat: allows disabling the automated pod watcher which doesn't behave as expected in some k8s engines

### 2402.27.3.patch2

- Feat: allows volume class to be customised for Agents

### 2402.27.3.patch1

- Fixes an issue with the aggregator creating empty organisations during the first migration

### 2402.27.3

With this version you can take advantage of most features announced during our recent [launch week](/launch-nx).

##### Nx Agents

This release contains everything needed to run [Nx Agents](/ci/features/distribute-task-execution) on-prem. While the on-prem configuration is still experimental, we are actively running Nx Agents trials at the moment, and if you'd like to take part please reach out to your DPE.

If you already running DTE, there are a few advantages to upgrading to Agents:

- simplified CI config: you will need to maintain just a single, main CI job config. NxCloud will create needed CI agents for you as needed.
- [dynamic agent allocation based on PR size](/ci/features/dynamic-agents): instead of always launching all your agents NxCloud will now launch different number of agents dynamically based on your PR size
- access to [Spot instances](https://aws.amazon.com/ec2/spot/): if you are running your clusters on any of the popular cloud providers (AWS, Google Cloud, Azure etc.), you can now use their Spot instances for running your CI job. This is possible due to NxCloud's distribution model, which allows work on a reclaimed node to be re-distributed to the remaining agents.

We will shortly make available a new Helm chart that will allow you to deploy a separate Agents cluster to launch workflows: [https://github.com/nrwl/nx-cloud-helm](https://github.com/nrwl/nx-cloud-helm).

![agents_screen](/nx-cloud/reference/images/agents.webp)

##### Task Atomizer and task retries

If you combine this release + upgrade to the latest Nx 18, you will have access to both the [task atomizer](/ci/features/split-e2e-tasks) (which allows your e2e to be distributed among agents PER FILE, instead of previously per project) and the [flaky task retry functionality](/ci/features/flaky-tasks).

##### CIPE page improvements

Along with all the UI changes to support agents (following their logs and track how tasks get distributed,details of which you'll find demoed on [this page](/ci/features/distribute-task-execution)) this release also brings all the new improvements to the CI pipeline execution page, including the commit info panel at the top:

![cipe_top_half_screen](/nx-cloud/reference/images/cipe_top.webp)

### 2312.11.7.patch1

- re-enable path style access for s3 buckets
- fix an aggregator migration issue with old CIPE data

### 2312.11.7

##### Helm package compatibility

When upgrading to this version and anything above it, you will need to use Helm version 0.12.0+:

| Chart Version |         Compatible Images          |
| :-----------: | :--------------------------------: |
| <= `0.10.11`  | `2306.01.2.patch4` **and earlier** |
|  >= `0.11.0`  |     `2308.22.7` **and later**      |
|  >= `0.12.0`  |     `2312.11.7` **and later**      |

##### New UI features and improvements

On the UI, we replaced the runs overview with the new CI Pipeline Executions (CIPE for short) screen:

![cipe_screen](/nx-cloud/reference/images/cipe_screen.webp)

This screen organises your runs more logically, according to each invocation of your CI pipeline.
It provides more data around the committer name and commit message and a full analysis of your CIPE once it is completed.
And if you need to run your tasks on multiple environments, you can now switch between them on this page and view the results separately.
You can play around with an example on the [Nx Repo](https://staging.nx.app/orgs/62d013d4d26f260059f7765e/workspaces/62d013ea0852fe0a2df74438/overview)

There is also a new Analytics screen for your workspaces, to which we'll keep adding new features to better help you optimise your CI pipelines:

![analytics_screen](/nx-cloud/reference/images/analytics_screen.webp)

Here you can see:

- historical trends of CIPE Average duration
- historical trends of CIPE average daily count
- average daily time saved by DTE

Other improvements:

- better overall UI performance (navigating feel much snappier now)
- improved terminal output rendering
- members can now be invited as admins directly

##### The light runner

Nx Cloud works by using a local Node runner that wraps your Nx tasks and sends information about them to the Nx Cloud API. This is how it knows whether to pull something from the remote cache or run it.

Because they work together, sometimes changes to the API required updates to this local runner. This led to workspaces that did not update their local
runner version in `package.json` sometimes running into compatibility issues.

We overhauled this mechanism, and the runner is now bundled as part of the API itself, ensuring you get sent the correct runner code when you first start running Nx commands in your workspace.
This ensures you will always have the correct local runner version that is compatible with your on-prem Nx Cloud installation.

We've been testing this out on our Public Nx Cloud instance and it is now available for on-prem installations as well.

To enable the light runner feature, make sure you:

1. remove `useLightClient: false` from your `nx.json` (if you had it)
2. If you are on Nx version > 17, you can remove any `nx-cloud` or `@nrwl/nx-cloud` package in your `package.json` and it should just work
3. If you are on Nx version < 17, upgrade to `nx-cloud@16.5.2` or `@nrwl/nx-cloud@16.5.2`.

##### Nx Agents

This release is also the first one to support ["Nx Agents"](/ci/features/distribute-task-execution).

While currently experimental and disabled by default for on-prem users, we are looking for more on-prem workspaces to try it out with
so please reach out to your DPE contact or to [cloud-suppport@nrwl.io](mailto:cloud-support@nrwl.io) if you are interested in helping us shape this according to your needs!

##### Breaking changes - MongoDB migration

As a reminder, we now only support MongoDB 6+. If you are running an older version please refer to the upgrade instructions [here](/ci/reference/release-notes#breaking-changes).

### 2308.22.7.patch7

- Allows the frontend container to be ran with `runAsNonRoot: true`

### 2308.22.7.patch6

- Fixes a UI issue on the branch when running a task in a DTE context

### 2308.22.7.patch5

- Fixes a UI issue when navigating to branches containing slashes

### 2308.22.7.patch4

- Updates the frontend image to remove some vulnerability issues

### 2308.22.7.patch3

- Fixes a compatibility issue with the latest `nx-cloud` release

### 2308.22.7.patch2

- Fix: github member invites

### 2308.22.7.patch1

- Feature: self-signed certificate support for aggregator
  - This is needed if you are using self-signed certificate for your external Mongo instance
  - See [here](https://github.com/nrwl/nx-cloud-helm/blob/main/PROXY-GUIDE.md#supporting-self-signed-ssl-certificates) for usage details.
- Fix: aggregator issue when creating text Mongo indexes

### 2308.22.7

In our last big release, we announced a completely new UI, rebuilt from the ground up in React. In this release, the frontend team
has continued that effort and wrapped the React app with the [Remix](https://remix.run/) framework. This is the same technology that powers our public https://cloud.nx.app/
product. It's faster, it handles resource caching better, and should allow the frontend team to ship features quicker than ever before.

##### Helm package compatibility

When upgrading to this version and anything above it, you will need to use Helm version 0.11.1:

| Chart Version |         Compatible Images          |
| :-----------: | :--------------------------------: |
| <= `0.10.11`  | `2306.01.2.patch4` **and earlier** |
|  >= `0.11.0`  |     `2308.22.7` **and later**      |

##### VCS proxy support

- For the GitHub/Bitbucket/Gitlab integrations to work, Nx Cloud needs to make HTTP calls to GitHub/GitLab to post comments
- If are behind a proxy however, these requests might fail
- If you are using our [Helm chart](https://github.com/nrwl/nx-cloud-helm/), you can now configure this option to unblock the vcs integration and allow it to work with your proxy:
  ```yaml
  vcsHttpsProxy: '<your-proxy-address>'
  ```

##### Misc updates

- UI enhancements of the run details screen
- UI enhancements of the task details screen
- fixes and better error handling for the DTE screen
- failed runs are now sorted at the top
- web app performance improvements for large workspaces
- more structured NxAPI pod logs (allows for better debugging)

##### Bug fixes

- Fixed an issue with applying licenses on orgs owned by non-installation admin accounts

##### Breaking changes - MongoDB migration

In the last big release we announced [the deprecation of Mongo 4.2](/ci/reference/release-notes#breaking-changes)
With this release, we have now stopped supporting Mongo 4.2 completely. Please upgrade Mongo to version 6 before installing this new image. You will find instructions [here](/ci/reference/release-notes#breaking-changes).

### 2306.01.2.patch4

- Fixes an issue with new licenses expiring sooner than original end date

### 2306.01.2.patch3

- Fixes an issue with multiple admin organizations being created on new installations
- Fixes an issue where Enterprise licenses could not be applied on some new orgs

### 2306.01.2.patch2

- Fixes an issue with the `single-image` container where the aggregation would block the API from starting up

### 2306.01.2.patch1

- Fixes an issue where admin users were not being created on new installations.

### 2306.01.2

This is one of our biggest Nx Cloud On-Prem releases. It also marks a change in our release process which will be explained at the end.

##### Brand new UI

A few months ago we announced a complete re-design of the Nx Cloud UI! It's faster, easier to use and pleasant to look at! We're now bringing this to On-Prem users as well:

You can read more about it in our [announcement blog post](/blog/nx-cloud-3-0-faster-more-efficient-modernized).

##### Pricing updates

While before we provided you with a separate coupon for each workspace, we have now changed to "organization-wide licenses": you receive a single coupon for your whole organization, that gives you unlimited access for the agreed number of workspaces. You are then free to delete, create and re-shuffle your workspaces as often as you want without requiring new coupons for us (as long as you stay within your limit of workspaces).

You will see some updates in the UI to reflect this, however, **you don't need to do anything once you update your images!** We'll automatically migrate you to this, based on your current number of enabled workspaces!

##### Proxy updates

One of the features of Nx Cloud is its integrations with your repository hosting solution. When you open up a Pull Request, you can configure Nx Cloud to post a comment to it once your CI has finished running, with a summary of all the tasks that succeeded and failed on that code change, and a link to your branch on Nx Cloud so you can further analyse your run. Your developers save time, and allows them to skip digging through long CI logs.

Before, if you had a self-hosted instance of GitHub, Gitlab or Bitbucket, calls from Nx Cloud to your code-hosting provider would fail, because they'd be using a self-signed certificate, which Nx Cloud wouldn't recognise.

[We now support self-signed SVN certificates, via a simple k8s configMap.](https://github.com/nrwl/nx-cloud-helm/blob/main/PROXY-GUIDE.md#supporting-self-signed-ssl-certificates)

[We've also made updates to the runner, to support any internal proxies you might have within your intranet.](https://github.com/nrwl/nx-cloud-helm/blob/main/PROXY-GUIDE.md#supporting-self-signed-ssl-certificates)

##### DTE performance

We completely re-wrote our Task Distribution engine, which should result in much fewer errors due to agent timeouts, increased performance and more deterministic task distribution.

We've also added a new internal task queueing system, which should further improve the performance of DTE. While this is an implementation detail which will be automatically enabled in future releases, you can test it out today by setting [`enableMessageQueue: true`](https://github.com/nrwl/nx-cloud-helm/blob/main/charts/nx-cloud/values.yaml#L18) in your Helm config.

You can read more about the recent DTE improvements in our [Nx Cloud 3.0 blog post](/blog/nx-cloud-3-0-faster-more-efficient-modernized).

##### Misc updates

- We have fixed issues related to OpenShift deployments. [Special thanks to minijus](https://github.com/nrwl/nx-cloud-helm/pull/32) for his work on the Helm charts and helping us test the changes.

##### Breaking changes

Nx Cloud uses MongoDB internally as its data store. While we've always used Mongo 4.2, in the latest release we started targeting Mongo 6.0. It's a much lighter process, with improved performance, and quicker reads and writes.

While you can still upgrade to this new image even if you are on Mongo 4.2 (nothing will break), **we strongly recommend you upgrade your Database to Mongo 6.0 to make sure nothing breaks in the future.** [We wrote a full guide on how you can approach the upgrade here](https://github.com/nrwl/nx-cloud-helm/blob/main/MONGO-OPERATOR-GUIDE.md#upgrading-to-mongo-6).
If you need assistance, please get in touch at [cloud-support@nrwl.io](mailto:cloud-support@nrwl.io).

###### Migration from Community Edition to Enterprise

On May 16th, 2023 we announced our plans to sunset the Community Edition of Nx Cloud On-Prem to align with our new pricing plans. If you are on the Community Edition, please follow these steps to migrate:

1. Use this image: `2306.01.2.patch3`
2. Switch to private Enterprise by setting `NX_CLOUD_MODE=private-enterprise` (or `mode: 'private-enterprise'` if using Helm).
3. Reach out to us at [cloud-support@nrwl.io](mailto:cloud-support@nrwl.io). You will get a FREE, unlimited-use coupon for the next 3 months so you can trial Nx Enterprise.

##### New release process

With this update, we are also changing our release process:

1. We'll start adding release notes with every new version published
2. We switch to using [calver](https://calver.org/) versioning for our images
3. We stopped publishing the `latest` tag.
4. We will be emailing Enterprise admins with every new release. If you do not get these emails, please send us an email at [cloud-support@nrwl.io](mailto:cloud-support@nrwl.io) to get added

Any questions at all or to report issues with the new release [please get in touch!](mailto:cloud-support@nrwl.io)

### 13-02-2023T23-45-24

- Feat: Targettable agents for DTE. You can now ask specific agents to pick up specific tasks (via `--targets
- Fix: DTE fixes for 404 not found artefacts errors
- Fix: issue when using GitHub integration with self-hosted GitHub instances

### 26-01-2023T21-22-48

- Misc: Fixes to the Gitlab integration

### 05-01-2023T17-53-45

- Misc: This release contains small bug fixes and UI improvements.

### 14-12-2022T19-43-44

- Feat: IAM Role Auth. We have now deprecated "aws_access_key_id" and "aws_access_key_secret" in favor of service accounts and IAM roles for accessing AWS resources. See the [new guide here](https://github.com/nrwl/nx-cloud-helm/blob/main/aws-guide/AWS-GUIDE.md) for details.

### 13-10-2022T16-45-30

- Misc: This release mostly contains improvements that apply to the Public SASS version of Nx Cloud. No significant changes for the On-Prem version.

### 13-10-2022T16-45-30

- Feat: Private Cloud now runs completely as Kubernetes cluster. See the [Helm example repo](https://github.com/nrwl/nx-cloud-helm) for more details

### 05-08-2022T15-42-20

- Fix: issue with retrieving hashes during reads
- Feat: added route to display container version at `/version`
- Misc: forward api errors to stderr so k8s clusters can process them better

### 02-08-2022T16-11-36

- Note: The version naming scheme for the containers was changed to better track date/time of releases and to support embedding of the version inside the web UI
- Feat: view the container version under the `/errors` route
- Feat: BitBucket login (note: does not support self-hosted instances of BitBucket Server)
- Feat: New system-ui font scheme
- Fix: branch screen sorting performance improvements

### 2.4.11

- Fixes an intermittent container start-up issue when running a self-contained Mongo instance
- Fixes an issue with the self-hosted file-server where it would fail to create the initial directories

### 2.4.10

- Fix an issue with the admin password not being set correctly

### 2.4.9

- Align all Nx Cloud images to this version. No new fixes or features included.

### 2.4.8

{% callout type="caution" title="IMPORTANT" %}
The default container mode has changed from `COMMUNITY` to `ENTERPRISE`. If you are running a Community version of the container, you will need to make sure the `NX_CLOUD_MODE=private-community` is explicitly set (otherwise your container will fail to start-up).
{% /callout %}

- Fix: Web app performance improvements
- Fix: issue with GitHub logged in admins not being able to download logs
- Fix: issue with billing page when multiple access tokens were attached to the same org
- Fix: multiple Mongo DBs used to be created if a default DB was not provided in the connection string. Now it always defaults to the provided `NX_CLOUD_MONGO_DB_NAME`

### 2.4.7

- Misc: performance improvements to DB indexes
- Misc: improvements to hash differ to use regex
- Misc: export more collections for debug purposes (workspaces and organizations)

### 2.4.6

- Fix: issue with navigating to organizations/workspaces in the web app

### 2.4.5

- Feat: filters to branch and run list pages
- Fix: improved `MD5` cache artifact archiving
- Misc: various UI and UX improvements to the Nx Cloud dashboards

### 2.4.4

- Fix: Missing artefact retrieval error when using read-tokens
- Fix: Performance improvements to the branch page and run groups sorting
- Fix: better handling of artefact `.tar` archiving

### 2.4.3

- Feat: Billing page messaging improvements
- Fix: runs sorting on branch page

### 2.4.2

- Feat: DTE post-run report
- Feat: Hash Detail tool flow improvements

### 2.4.1

- Feat: Admins can now easily export debug info for error investigation
- Fix: branch screen run group sorting

### 2.4.0

- Feat: [GitLab Auth Support](https://nx.app/docs/private-cloud-gitlab-auth)/private-cloud-gitlab-auth
- Feat: Hash diffing tool improvements
- Feat: show message on branch page if workspace is unclaimed
- Fix: Agent out of memory warning
- Feat: cache inner runs
- Fix: include correct GitHub workflows path
- Fix: default to most recent run group on branch page
- Fix: handle DTEs with no tasks
- Fix: await process checkout sessions

### 2.3.1

- Feat: Increase file-server default cached artifact limit. If you are not using an external file storage (such as S3), then the cached assets will now be kept by default from 2 weeks to 4 weeks, increasing the chance of cache hits.
- Feat: "Download cache usage" data from the "Time saved" workspace page

### 2.3.0

- Feat: GitHub Integration - no token is now necessary in "`nx.json`" for the GitHub integration to work (you still need to provide as an env var for caching to work). To connect your workspace to GitHub without an access token in "`nx.json`" just pass in the "`NX_CLOUD_INTEGRATION_DEFAULT_WORKSPACE_ID=<your-workspace-id>`" env var
- Misc: better error handling (report less false positives)
- Fix: Scheduled tasks locking

### 2.2.16

- Misc: DB performance improvements (old records clean-up aggregator, indexes etc.)

### 2.2.15

- Feat: Add options to control database load
- Fix: Better exception handling in the API

### 2.2.14

- Feat: Optimize event processing to increase the throughput of workspaces with a very high number of agents.
- Fix: Gracefully recover when stats aggregation fails

### 2.2.13

- Feat: Hash diffing tool enhancements

### 2.2.12

- Feat: DTE visualisation improvements for larger workspaces
- Fix: billing page not displaying subscriptions for Private Community

### 2.2.11

- Feat: Better error handling for scheduled tasks
- Fix: branch screen not loading

### 2.2.10

- Feat: Various UI improvements to the Nx Cloud screens
- Feat: Hash detail diff tool
- Feat: GitHub app comment revamp
- Feat: DTE visualisation

### 2.2.9

- Fix: DTE bug fixes caused by incorrectly batched tasks

### 2.2.8

- Fix: various DTE bug fixes
- Feat: Add `NX_CLOUD_DISTRIBUTED_EXECUTION_AGENT_COUNT` env var for more explicitly optimising DTEs
- Feat: Send GitHub workspace membership invites by email
- Fix: improve container start-up time
- Feat: If Mongo connection fails during container start-up it keeps retrying up to a max number of times (configurable via `MONGO_MAX_RETRIES`)
- Feat: expose "/ping" endpoint (can be useful for K8s readinessProbe)
  - `curl --fail http://localhost:8081/nx-cloud/ping --header "authorization: your-nx-cloud-access-token"`
- Feat: billing estimator (on billing page)
- Fix: ignore ending slash on `NX_CLOUD_APP_URL` (in case it's added by mistake)

### 2.2.7

- Feat: `VERBOSE=1` env variable option to output extra information during container initialisation
- Feat: `MONGO_REPAIR=1` env variable option to trigger a [Mongo Repair](https://docs.mongodb.com/manual/tutorial/recover-data-following-unexpected-shutdown/) if the container data gets corrupted

### 2.2.3

- Fix: Reset the memory limits to best work on an instance with 8GB of RAM.
- Fix: Set the default `NX_CLOUD_MODE` to "community".

### 2.2

- [Nx Cloud 2.2](https://blog.nrwl.io/%EF%B8%8F-nx-cloud-2-2-%EF%B8%8F-b7656ed5ce7c)

### 2.0

- [Overview of Nx Cloud 2.0](https://blog.nrwl.io/introducing-nx-cloud-2-0-f1e5c2002a65)

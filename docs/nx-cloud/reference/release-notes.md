# Enterprise Release Notes

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

### 2406.29.1 and older

If you require older release notes please refer to [this link](https://github.com/nrwl/nx/blob/af1b16a6cac7706a7f5b3e40fbf7be55b83116f7/docs/nx-cloud/reference/release-notes.md).

# Connect to Nx Cloud

Create an account on [nx.app](https://nx.app). There are several ways to connect your repository to Nx Cloud.

## Connect Directly Through Source Control Integrations

The recommended way to set up Nx Cloud is to connect using a source control integration. Choose your provider below and follow the recipe to enable source control integration for your repository.

{% cards cols="3"  %}

{% link-card title="GitHub" url="ci/recipes/source-control-integration/github" icon="github" appearance="small" /%}
{% link-card title="GitLab" url="/ci/recipes/source-control-integration/gitlab" icon="gitlab" appearance="small" /%}
{% link-card title="Bitbucket" url="/ci/recipes/source-control-integration/bitbucket-cloud" icon="bitbucket" appearance="small" /%}

{% /cards %}

Once the source control integration is connected, it will send a pull request to your repository that will add the `nxCloudAccessToken` property to `nx.json`.

![Nx Cloud Setup PR](/nx-cloud/tutorial/nx-cloud-setup-pr.png)

This wires up all the CI for you and configures access. Folks who can see your repository can see your workspace on nx.app.

## Manually Connect Your Workspace

You can also manually connect your workspace to Nx Cloud. Without source control integration, [Nx Agents](/ci/features/distribute-task-execution) will not function, but [Nx Replay](/ci/features/remote-cache) will still work.

Run the following command in your repository:

```shell
pnpm nx connect
```

Click the link in the terminal to claim your workspace on [nx.app](https://nx.app).

The command generates an `nxCloudAccessToken` property inside of `nx.json`. This is a read-only token that should be committed to the repository.

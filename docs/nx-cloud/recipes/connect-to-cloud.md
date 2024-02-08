# Connect to Nx Cloud

Create an account on [nx.app](https://nx.app). There are several ways to connect your repository to Nx Cloud.

#### Connect Directly Through GitHub

If your repository is hosted on GitHub, we recommend you create an Nx Cloud organization based on your GitHub organization.

![Connect Your VCS Account](/nx-cloud/tutorial/connect-vcs-account.png)

After that, connect you repository.

![Connect Your Repository](/nx-cloud/tutorial/connect-repository.png)

This will send a pull request to your repository that will add the `nxCloudAccessToken` property to `nx.json`.

![Nx Cloud Setup PR](/nx-cloud/tutorial/nx-cloud-setup-pr.png)

This wires up all the CI for you and configures access. Folks who can see your repository can see your workspace on nx.app.

## Manually Connect Your Workspace

If your repository is hosted on a different source control provider, you can also connect to Nx Cloud manually. You'll need to add a source control integration later to enable [Nx Agents](/ci/features/distribute-task-execution).

Run the following command in your repository:

```shell
pnpm nx connect
```

Click the link in the terminal to claim your workspace on [nx.app](https://nx.app).

The command generates an `nxCloudAccessToken` property inside of `nx.json`. This is a read-only token that should be committed to the repository.

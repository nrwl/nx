# Enable Azure DevOps PR Integration

## Get Started

The Nx Cloud + Azure Devops Integration lets you access the result of every run—with all its logs and build insights—straight from your PR.

## Connecting Your Workspace

![Access VCS Setup](/nx-cloud/set-up/access-vcs-setup.webp)

Once on the VCS Integrations setup page, select "Azure DevOps". You will be prompted to enter the name of your organization and project.

Identifying your organization and project can be done by looking at the URL of your project summary page.

```
https://dev.azure.com/[organization]/[project]
```

For example, the url `https://dev.azure.com/nrwl/my-monorepo-project` has an organization name of "nrwl", and a project name of "large-monorepo".

You will also need to provide the id of your Azure Git repository, this can either be the internal GUID identifier, if known, or you can use the name of the repository from the URL you use to access it.

For example, a URL of `https://dev.azure.com/nrwl/_git/large-monorepo` has the repository id of "large-monorepo".

![Add Azure DevOps Repository](/nx-cloud/set-up/add-azure-devops-repository.webp)

### Configuring Authentication

#### Using a Personal Access Token

To use a Personal Access Token for authentication, one must be generated with proper permissions. The minimum required permissions are shown in the screenshot below.

![Work Items - Read, Code - Read, Build - Read & execute, Release - Read, write, & execute](/nx-cloud/set-up/minimal-ado-access-token.webp)

Once this token is created paste the value and then click "Connect".

This will verify that Nx Cloud can connect to your repo. Upon a successful test, your configuration is saved, and setup is complete.

Please note that Azure DevOps will impose rate limits which can degrade the performance of the integration leading to missing data or functionality. To mitigate the impact, we recommend you assign the [Basic + Test plan](https://learn.microsoft.com/en-us/azure/devops/organizations/billing/buy-basic-access-add-users?view=azure-devops#assign-basic-or-basic--test-plans) to the user whose token you utilise for this integration.

### Advanced Configuration

If your company runs a self-hosted Azure DevOps installation, you may need to override the default URL that Nx Cloud uses to connect to the Azure Devops API. To do so, check the box labeled "Override Azure DevOps API URL" and enter the correct URL for your organization.

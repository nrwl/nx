# Enable Bitbucket Cloud PR Integration

## Get Started

The Nx Cloud + Bitbucket Cloud Integration lets you access the result of every run—with all its logs and build insights—straight from your PR.

## Connecting Your Workspace

![Access VCS Setup](/nx-cloud/set-up/access-vcs-setup.png)

Once on the VCS Integrations setup page, select "Bitbucket Cloud" in the platforms dropdown. You will be prompted to enter the name of your workspace, and its repository slug.

Identifying your workspace name and repository slug can be done by looking at the URL from Bitbucket.

```
https://bitbucket.org/[workspace]/[repository-slug]/src/main/
```

For example, the url `https://bitbucket.org/nrwl/large-monorepo/src/main/` has a workspace name of "nrwl", and a repository slug of "large-monorepo".

![Add Bitbucket Cloud Repository](/nx-cloud/set-up/add-bitbucket-cloud-repository.png)

### Configuring Authentication

#### Using an App Password

To use an app password for authentication, one must be generated with proper permissions. The minimum required permissions are write access to PRs.

![PR write access is checked in the App Password creation screen on Bitbucket](/nx-cloud/set-up/minimal-bitbucket-cloud-app-password.png)

Once the app password is created, verify the username is correct, paste the value, and then click "Test Connection". This will verify that Nx Cloud can connect to your repo. Upon a successful test, your configuration is saved, and setup is complete.

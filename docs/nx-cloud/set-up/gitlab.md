# Enable GitLab Integration

## Get Started

The Nx Cloud GitLab Integration lets you access the result of every run—with all its logs and build insights—straight from your Merge Requests.

## Connecting Your Workspace

![Access VCS Setup](/nx-cloud/set-up/access-vcs-setup.webp)

Once on the VCS Integrations setup page, select "GitLab". You will be prompted to enter your project's ID.

![Locate Gitlab Project ID](/nx-cloud/set-up/find-gitlab-project-id.png)

To locate the ID for your project, visit the home page of your repository on GitLab. The value can be found underneath the name of your project, and has a clickable button to copy to your clipboard.

![Add GitLab Repository](/nx-cloud/set-up/add-gitlab-repository.webp)

### Configuring Authentication

#### Using a Personal Access Token

To use a Personal Access Token for authentication, one must be generated with proper permissions. The minimum required permissions are shown in the screenshot below.

![Minimum GitLab Personal Access Token Permissions](/nx-cloud/set-up/minimal-gitlab-access-token.png)

Once this token is created, select the radio button for providing a personal access token, paste the value, and then click "Connect".

This will verify that Nx Cloud can connect to your repo. Upon a successful test, your configuration is saved, and setup is complete.

### Advanced Configuration

If your company runs a self-hosted GitLab installation, you may need to override the default URL that Nx Cloud uses to connect to the GitLab API. To do so, check the box labeled "Override GitLab API URL" and enter the correct URL for your organization.

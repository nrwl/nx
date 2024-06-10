# Setting up a dedicated Nx Cloud VM

## AWS EC2

1. Login to your AWS Console and select [the top image published here](https://console.aws.amazon.com/ec2/v2/home?home#Images:visibility=public-images;imageName=nx-cloud;owner=623002322076;sort=desc:imageName)
2. Launch a new instance from that AMI
3. Recommended instance type: `t3.2xlarge`
4. You will need to SSH into the instance once it's created:
   - Use an existing SSH key-pair that you already have installed locally.
   - [Or create a new one and download the keys locally](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-key-pairs.html?icmpid=docs_ec2_console#having-ec2-create-your-key-pair)
     - Then select your new SSH pair from the list
5. Networking:
   - Allow the instance to receive HTTP and HTTPS traffic
   - Allow SSH from your current IP
6. Leave the storage options as they are
7. "Launch instance"
8. Wait 10 minutes, then navigate to your instance's IP in the browser. You should see the Nx Cloud dashboard!

![Nx Cloud landing page](/nx-cloud/enterprise/on-premise/images/nx-cloud-landing.png)

### Your Nx Cloud URL

1. At this point, your instance will have a public IP accessible from the browser.
   - You can consider this IP the URL of Nx Cloud, and proceed with the below steps and all will work fine!
2. You might want, however, to add a Load Balancer in front of the instance, with an explicit domain (e.g. https://my-nxcloud.my-org.com).
   - This is strongly recommended because you will be able to upgrade/restart/re-configure your Nx Cloud EC2 instance while keeping the Nx Cloud URL static.
   - Create an [application load balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-application-load-balancer.html)
   - You will need to create a certificate for your domain to assign to the LB
   - And you will need to target your EC2 instance from the LB
   - You should now have a permanent domain pointing to your Nx Cloud instance

Once you have your Nx Cloud URL proceed to the below steps!

### Configuring your Nx Cloud instance

1. Create a new `myconfiguration.yaml` file with the below contents

```yaml
# This is all you need to get the baseline of your nx-cloud instance configured!

# Set the external URL your instance is running on. This is the URL from the previous step
nxCloudAppURL: 'https://nx-cloud.on.my-domain.ca' # make sure no backslash is at the end

secret:
  # set your initial admin password for logging into the app
  adminPassword: 'correcthorsebatterystaple'
```

2. Apply the configuration:

```bash
scp -i ./<path-to-your-ssh-pem-file>.pem -r ./myconfiguration.yaml nx-cloud@<your-instance-ip>:~/config/user/update.yaml
```

That's it! After a few minutes, you should be able to log-in with:

- username: `admin`
- password: `<the-password-you-set-above>`

### Applying the license

Once you log-in, you will see an organisation has been created for you.

1. You can rename it or create a new organization.
2. Navigate to your new organization's page and send us it's id
   - It should look something like this: https://your-url.com/orgs/649f240f7fb955000c1fd10b/workspaces
3. We will then give you a License Key which you can apply on your org's billing page

### Connecting to your instance

In your Nx workspace, you can enable Nx Cloud by running:

```bash
NX_CLOUD_API="https://nx-cloud.on.my-domain.ca" npx nx connect
```

If it doesn't work, there might be an issue with unrecognized certificates on your instance. You can try running with:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 NX_CLOUD_API="https://nx-cloud.on.my-domain.ca" npx nx connect
```

Although we have [a full guide here](https://github.com/nrwl/nx-cloud-helm/blob/main/PROXY-GUIDE.md#nxcloud-runner-proxy-issues) for dealing with self-signed certificates.

### Advanced configuration and auth

You can optionally enable authentication using your preferred SSO provider:

- GitHub
- Bitbucket
- GitLab
- SAML (Okta, Azure AD etc.)
- And even [Nx Agents](/ci/features/distribute-task-execution#distribute-task-execution-nx-agents)
  - Follow [the guide here](https://github.com/nrwl/nx-cloud-helm/blob/main/agents-guide/AGENTS-GUIDE.md) for setting up an Nx Agents cluster

```yaml
# This is all you need to get the baseline of your nx-cloud instance configured!

# only use this if you'd like to use any of the newer Nx Cloud version from here: https://nx.dev/ci/reference/release-notes#docker-containers
# global.imageTag: ''

# Set the external URL your instance is running on
nxCloudAppURL: 'https://nx-cloud.on.my-domain.ca' # make sure no backslash is at the end

# Uncomment (along with github secrets below) to enable working with GitHub pull requests or github auth
#github:
#  auth:
#    enabled: false
#  pr:
#    apiUrl: '' # this is only needed if you have a self-hosted github instance

#gitlab:
#  apiUrl: '' # this is only needed if you have a self-hosted gitlab instance
#  auth:
#    enabled: false

# we do not support self-hosted bitbucket instances
#bitbucket:
#  auth:
#    enabled: false

#saml:
#  auth:
#    enabled: false

# for enabling Nx Agents
#nxCloudWorkflows:
#  enabled: true
#  externalName: your-agents-cluster-address.com

# Provide plaintext values for your application to use. We will extract them,
# store them within the application runtime, and scrub the plaintext ones from
# the filesystem
secret:
  # set your initial admin password for logging into the app
  # see here: https://nx.dev/ci/recipes/enterprise/on-premise/auth-single-admin
  adminPassword: 'correcthorsebatterystaple'

  # If you want to enable GitHub Login, just provide your client id & secret, we handle the rest
  # see here: https://nx.dev/ci/recipes/enterprise/on-premise/auth-github
  githubAuthClientId: 'my_client_id'
  githubAuthClientSecret: 'my_client_secret'

  # The same goes for GitLab authentication
  # see here: https://nx.dev/ci/recipes/enterprise/on-premise/auth-gitlab
  # gitlabAppId: 'my_gitlab_app_id'
  # gitlabAppSecret: 'my_gitlab_app_secret'

  # Bitbucket too! If these are uncommented, BB auth is automatically enabled
  # see here: https://nx.dev/ci/recipes/enterprise/on-premise/auth-bitbucket
  # bitbucketAppId: 'bitbucket_app_id'
  # bitbucketAppSecret: 'bitbucket_app_secret'

  # SAML auth
  # see here: https://nx.dev/ci/recipes/enterprise/on-premise/auth-saml
  # samlEntryPoint: 'your_saml_entry_point'
  # samlCert: 'saml_cert'
```

### Upgrades

We send out emails with every new Nx Cloud release to all our Enterprise customers:

1. You can view your current version at the `/version` route: https://your-nx-cloud-url.com/version
2. [And these are the latest Nx Cloud releases](/ci/reference/release-notes)

To upgrade to a newer version, add the below line to your `myconfiguration.yml` file:

```yaml
global:
  imageTag: '2306.01.2'
global:
  imageTag: '2405.02.15' # set the version of nx-cloud you'd like
helmVersion: '0.15.3' # helm version
```

And apply the changes:

```bash
scp -r ./myconfiguration.yaml nx-cloud@<your-instance-ip>:~/config/user/update.yaml
```

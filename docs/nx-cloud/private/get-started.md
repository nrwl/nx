# Running Nx Cloud on Prem

Nx Cloud can be deployed to your cloud, which gives you full control of your data, with no external API calls.

This solution is included as part of the Nx Enterprise package. You can learn more about it at [nx.app/enterprise](https://nx.app/enterprise).

Nx Cloud can be deployed in two ways:

- Using Kubernetes (several containers working together)
- Using a single standalone container (NOT RECOMMENDED)

The flags and the capabilities are the same between the two, but the Kubernetes setup is more robust and better
documented.

## Resources

- [Kubernetes Setup Instructions](/nx-cloud/private-cloud/kubernetes-setup)
- [Nx Cloud K8s Example + All Config Options](https://github.com/nrwl/nx-cloud-helm)
- [Nx Cloud K8s Example + All Config Options (no Helm)](https://github.com/nrwl/nx-cloud-helm/tree/main/no-helm)
- [Standalone Container](/nx-cloud/private-cloud/standalone)
- [GitHub PR Integration](/nx-cloud/set-up/github)
- [Auth (Basic)](/nx-cloud/private-cloud/auth-single-admin)
- [GitHub Auth](/nx-cloud/private-cloud/auth-github)
- [GitLab Auth](/nx-cloud/private-cloud/auth-gitlab)
- [BitBucket Auth](/nx-cloud/private-cloud/auth-bitbucket)
- [SAML Auth](/nx-cloud/private-cloud/auth-saml)
- [Advanced Configuration](/nx-cloud/private-cloud/advanced-config)

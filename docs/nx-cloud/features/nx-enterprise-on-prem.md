# Running Nx Cloud Enterprise

We offer multiple ways of running Nx Cloud for our Enterprise customers. The below options are listed in recommended order, from easiest to most complex in terms of set-up and maintenance for your team. Please carefully consider your organization's requirements and level of infrastructure expertise before deciding on a deployment option.

{% call-to-action title="Get in Touch" icon="nxcloud" description="Get the package that best fits your needs" url="/enterprise" /%}

## Managed Setup

### Multi-tenant

The quickest and easiest way to start using Nx Cloud is by utilizing our pre-existing secure, multi-tenant managed clusters:

- [https://nx.app/](https://nx.app/)
- [https://eu.nx.app/](https://eu.nx.app/) if you have special restrictions and your data needs to be hosted in Europe.

You get the **same level of security**, **dedicated support**, and **predictable seat-based pricing** as all our other hosting options. But you won't have to manage the instance yourself.

We also offer an uptime SLA guarantee of 99.98% for our Enterprise customers, SOC certificates on request, and we're happy to meet with your security teams if they have questions, or fill in security questionnaires. We also maintain a [Status Page here](https://status.nx.app/).

To start with this option, it's as easy as creating an account on [nx.app](https://cloud.nx.app) and connecting your repository.

### Single-tenant instance

If you have very specific requirements, then we can also offer to host Nx Cloud for you in an isolated/single-tenant cluster.

We'll be able to discuss specific requirements such as:

- SAML/SSO
- Specific regions you want your data to be in
- Network isolation / dedicated VPCs
- Dedicated instances
- Different storage encryption than what is available on our multi-tenant instances
- Custom storage replication / redundancy requirements
- Custom Node types for Nx agents
- Static IPs (if you need to open up connections in your corporate network)
- VPC peering on GCloud or AWS Private Link

This would be a "best of both worlds" option, as it would free you up from managing the instance yourself, but you will get to define specific parameters of how it should it run.
Your data and the Nx Cloud will run in complete isolation and will only serve your company. There will be no external API calls to any services outside of the clusters we set-up for you.

Once you let us know you'd like this option, depending on the agreed requirements, it might take a few days to get it set up.

## On-prem, managed by your organization

If you would like to host Nx Cloud yourself, within your organization's infrastructure, we currently offer two options. Please reach out to your DPE first to discuss them in detail. We can then help suggest a recommended route.

### Self-contained VM

The quickest one is setting it up as a ["self-contained VM"](/ci/recipes/enterprise/on-premise/ami-setup) on Amazon EC2.

### Multi-node setup with Kubernetes

We also offer a multi-node Kubernetes setup, that is deployed via Helm. You can head over to our [Helm repository](https://github.com/nrwl/nx-cloud-helm/) to explore this option.

## Resources

- [Integration with your source control provider](/ci/recipes/source-control-integration)
- [On-Prem specific features](/ci/recipes/enterprise/on-premise/auth-single-admin)

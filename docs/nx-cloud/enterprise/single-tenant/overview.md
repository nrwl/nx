# Single Tenant Nx Cloud Hosting

We offer multiple ways of running Nx Cloud for our Enterprise customers. The below options are listed in recommended order, from easiest to most complex in terms of set-up and maintenance for your team. Please carefully consider your organization's requirements and level of infrastructure expertise before deciding on a deployment option.

{% call-to-action title="Get in Touch" icon="nxcloud" description="Get the package that best fits your needs" url="/enterprise" /%}

## Multi-tenant

The quickest and easiest way to start using Nx Cloud is by utilizing our pre-existing secure, multi-tenant managed clusters:

- [https://nx.app/](https://nx.app/)
- Enterprise customers can contact their developer productivity engineer (DPE) to configure the EU hosted version of Nx Cloud.

We also offer an uptime SLA guarantee of 99.98% for our Enterprise customers, SOC certificates on request, and we're happy to meet with your security teams if they have questions, or fill in security questionnaires. We also maintain a [Status Page here](https://status.nx.app/).

To start with this option, it's as easy as creating an account on [nx.app](https://cloud.nx.app) and connecting your repository.

## Single Tenant Instance

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

This option allows you to define specific parameters of how the instance should run.
Your data and the Nx Cloud will run in complete isolation and will only serve your company. There will be no external API calls to any services outside of the clusters we set-up for you.

Once you let us know you'd like this option, depending on the agreed requirements, it might take a few days to get it set up.

### More Stable Version of Nx Cloud

The Nx Cloud software that is used in single tenant instances trails the version used in the multi-tenant instance by about month. This allows single tenant customers to benefit from an extra month of real world validation of any new features before enabling those features.

### Easy Set Up

While the multi-tenant option requires no set up at all, single tenant Nx Cloud still has a simple set up process from your perspective. Since the Nx Cloud team manages the instance, your infrastructure team members do not need to become experts in the specific configuration required to make sure all the parts of Nx Cloud work together correctly. Our team will provision and configure all the hardware required to get your Nx Cloud instance ready. This process usually takes a few days.

### Nx Maintenance Team

Our team will also manage changes to the Nx Cloud instance.

- As your usage grows, we will take care of allocating and scaling resources.
- When new features are available for Nx Cloud, our team will automatically enable them for you so that you can always have access to the best version of Nx Cloud.
- If you encounter issues with your Nx Cloud instance, we have full access to the set up and can diagnose the problems for you.

{% call-to-action title="Get in Touch" icon="nxcloud" description="Get the package that best fits your needs" url="/enterprise" /%}

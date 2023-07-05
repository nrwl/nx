# Running Nx Cloud Enterprise

We offer multiple ways of running NxCloud for our Enterprise customers. The below options are listed in recommended order, from easiest to most complex in
terms of set-up and maintenance for your team. Please carefully consider your organization's requirements and level of infrastructure expertise before deciding on
a deployment option.

Also, please make sure to [get in touch with us first](https://nx.app/enterprise?utm_source=nx.dev) so we can start creating an Enterprise package
that best fits your needs, and discuss any questions you might have!

## Clusters managed by us

### Multi-tenant

The quickest way and easiest way to get up and running with NxCloud is using one of our existing secure, multi-tenant managed clusters:

- https://nx.app/
- Or, if you'd like all of your data to be hosted in Europe, you can use https://eu.nx.app/

You get the same level of security, dedicated support, SSO/SAML auth options and predictable seat-based pricing as all our other hosting options, but you won't have
to manage the instance yourself.

We also offer an uptime SLA guarantee of 99.98% for our Enterprise customers, SOC certificates on request, and we're happy to meet with your security teams if they
have questions, or fill in security questionnaires. We also maintain a [Status Page here](https://status.nx.app/).

To start with this option, it's as easy as running `npx nx connect` in your Nx workspace!

### Single-tenant instance

If you have very specific requirements, then we can also offer to host NxCloud for you in an isolated/single-tenant cluster.

We'll be able to discuss specific requirements such as:

- Specific regions you want your data to be in
- Network isolation / dedicated VPCs
- Dedicated instances
- Storage encryption
- Storage replication / redundancy

This would be a "best of both worlds" option, as it would free you up from managing the instance yourself, but you will get to define specific parameters of how it should it run.
Your data and the NxCloud will run in complete isolation and will only serve your company. There will be no external API calls to any services outside of the cluster we set-up for you.

Once you let us know you'd like this option, depending on the agreed requirements, it might take a few days to get it set up.

## On-prem, managed by your organization

#### Self-contained VM

If you would like to host NxCloud yourself, within your organization's infrastructure, the easiest way to set it up is as a self-contained VM.

Refer to our ["Self-contained VM" guide](/nx-cloud/private-cloud/ami-setup) for instructions on running NxCloud on Amazon EC2.

#### Multi-node setup with Kubernetes

The options above remove most of the maintenance burden required on your part, so we strongly recommend them! They also don't require too much infrastructure expertise.

We do offer, however, a multi-node Kubernetes setup, that is deployed via Helm. You can head over to our [Helm repository](https://github.com/nrwl/nx-cloud-helm/) to explore this option.

## Resources

- [GitHub PR Integration](/nx-cloud/set-up/github)
- [Auth (Basic)](/nx-cloud/private-cloud/auth-single-admin)
- [GitHub Auth](/nx-cloud/private-cloud/auth-github)
- [GitLab Auth](/nx-cloud/private-cloud/auth-gitlab)
- [BitBucket Auth](/nx-cloud/private-cloud/auth-bitbucket)
- [SAML Auth](/nx-cloud/private-cloud/auth-saml)
- [Advanced Configuration](/nx-cloud/private-cloud/advanced-config)

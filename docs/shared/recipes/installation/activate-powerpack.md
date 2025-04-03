---
title: Activate Nx Powerpack
description: Learn how to obtain and register an Nx Powerpack license to unlock enterprise features like conformance rules and code ownership.
---

# Activate Powerpack

Nx Powerpack unlocks features of Nx that are particularly useful for larger organizations. Powerpack is available for Nx version 19.8 and higher. The features include the ability to:

- [Run language-agnostic conformance rules](/nx-enterprise/powerpack/conformance)
- [Define code ownership at the project level](/nx-enterprise/powerpack/owners)

{% callout type="deepdive" title="Looking for self-hosted caching?" %}

Self-hosted caching is now free for everyone. [Read more about remote caching options here](/recipes/running-tasks/self-hosted-caching).

{% /callout %}

Activating Powerpack is a two-step process.

## Step 1: Get an Activation Key

You can [purchase a license](https://cloud.nx.app/powerpack/purchase?utm_source=nx-docs&utm_medium=referral&utm_campaign=powerpack-purchase&utm_content=link&utm_term=purchase-license) online.

If you're an existing Nx Cloud user, you can buy Nx Powerpack on [the Nx Cloud organization settings page](https://cloud.nx.app/go/organization/powerpack). The license will be available automatically.

{% callout type="deepdive" title="Need a trial?" %}

If you are unsure how to proceed, starting with a trial process is recommended, and we will accommodate your organization's needs. You can reach out here to [get a free trial license](https://cloud.nx.app/powerpack/request/trial?utm_source=nx-docs&utm_medium=referral&utm_campaign=powerpack-trial&utm_content=link&utm_term=free-trial-license-for-larger-teams) or read more [about how trials work](/nx-enterprise/powerpack/licenses-and-trials).

{% /callout %}

## Step 2: Register the Activation Key

{% tabs %}
{% tab label="Closed Source Repository" %}

To register the activation key in your repository, run the `nx register` command.

```shell
nx register YOUR_ACTIVATION_KEY
```

The key will be saved in your repository and should be committed so that every developer has access to the Powerpack features. **Only one developer needs to run this. The rest of the team will gain access to Nx Powerpack features once they pull the changes including the checked-in file.**

Another option is to use an environment variable in CI.

```{% fileName=".env" %}
NX_KEY=YOUR_ACTIVATION_KEY
```

**Whether you use the `nx register <your-key>` command or set the environment variable, Nx Powerpack does not make any requests to external APIs. No data is collected or sent anywhere.**

{% /tab %}
{% tab label="Open Source Repository" %}

Use an environment variable for your activation key such that it is not committed to the repository.

```{% fileName=".env" %}
NX_KEY=YOUR_ACTIVATION_KEY
```

{% /tab %}
{% /tabs %}

# Activate Powerpack

Nx Powerpack unlocks features of Nx that are particularly useful for larger organizations. Powerpack is available for Nx version 19.8 and higher. The features include the ability to:

- [Run language-agnostic conformance rules](/nx-enterprise/powerpack/conformance)
- [Define code ownership at the project level](/nx-enterprise/powerpack/owners)
- [Self-hosted remote cache storage](/nx-enterprise/powerpack/custom-caching)

Activating Powerpack is a two-step process.

## Get a License Key

1. Small teams can [immediately get a free Nx Powerpack license for remote cache](https://cloud.nx.app/powerpack/request/free?utm_source=nx-docs&utm_medium=referral&utm_campaign=powerpack-free-license&utm_content=link&utm_term=free-license-for-remote-cache). _[Read more about who qualifies.](/nx-enterprise/powerpack/free-licenses-and-trials)_
2. Open-source projects can [register for a free OSS license](https://forms.gle/mWjQo6Vrv5Kt6WYh9) as well.
3. Larger teams can immediately [get a free trial license](https://cloud.nx.app/powerpack/request/trial?utm_source=nx-docs&utm_medium=referral&utm_campaign=powerpack-trial&utm_content=link&utm_term=free-trial-license-for-larger-teams). _[Read more about how trials work](/nx-enterprise/powerpack/free-licenses-and-trials)._
4. You can also [purchase a license](https://cloud.nx.app/powerpack/purchase?utm_source=nx-docs&utm_medium=referral&utm_campaign=powerpack-purchase&utm_content=link&utm_term=pruchase-license) online.

**If you are unsure how to proceed, starting with a trial process is recommended, and we will accommodate your organization's needs.**

## Register the License Key

{% tabs %}
{% tab label="Closed Source Repository" %}

To register the license key in your repository, run the `nx activate-powerpack` command.

```shell
nx activate-powerpack YOUR_LICENSE_KEY
```

The license will be saved in your repository and should be committed so that every developer has access to the Powerpack features. **Only one developer needs to run this. The rest of the team will gain access to Nx Powerpack features once they pull the changes including the checked-in file.**

Another option is to register the license key as an environment variable in CI.

```{% fileName=".env" %}
NX_POWERPACK_LICENSE=YOUR_LICENSE_KEY
```

**Whether you use the `active-powerpack` command or set the environment variable, Nx Powerpack does not make any requests to external APIs. No data is collected or sent anywhere.**

{% /tab %}
{% tab label="Open Source Repository" %}

Register the license key as an environment variable that is not committed to the repository.

```{% fileName=".env" %}
NX_POWERPACK_LICENSE=YOUR_LICENSE_KEY
```

{% /tab %}
{% /tabs %}

### Buying and Registering Nx Powerpack When Using Nx Cloud

Nx Cloud users can buy Nx Powerpack on the organization settings page. The license will be available automatically.

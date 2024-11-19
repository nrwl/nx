# Activate Powerpack

Nx Powerpack unlocks features of Nx that are particularly useful for larger organizations. Powerpack is available for Nx version 19.8 and higher. The features include the ability to:

- [Run language-agnostic conformance rules](/nx-enterprise/powerpack/conformance)
- [Define code ownership at the project level](/nx-enterprise/powerpack/owners)
- [Change the remote cache storage location](/nx-enterprise/powerpack/custom-caching)

Activating Powerpack is a two step process.

## 1. Purchase a License

You'll need to [purchase a license](https://cloud.nx.app/powerpack/purchase) online. The license is a seat-based license. If you are a small team, the purchase form has an option to apply for a free license. If you have an open-source repository, you can [register for a free OSS license](https://forms.gle/mWjQo6Vrv5Kt6WYh9) as well.

{% call-to-action title="Buy a Powerpack License" icon="nx" description="Unlock all the features of Nx" url="https://cloud.nx.app/powerpack/purchase" /%}

Once you've completed the purchase, you will receive a license key.

## 2. Register the License Key

{% tabs %}
{% tab label="Closed Source Repository" %}

To register the license key in your repository, run the `nx activate-powerpack` command.

```shell
nx activate-powerpack YOUR_LICENSE_KEY
```

The license will be saved in your repository and should be committed so that every developer has access to the Powerpack features.

{% /tab %}
{% tab label="Open Source Repository" %}

Register the license key as an environment variable that is not committed to the repository.

```{% fileName=".env" %}
NX_POWERPACK_LICENSE=YOUR_LICENSE_KEY
```

{% /tab %}
{% /tabs %}

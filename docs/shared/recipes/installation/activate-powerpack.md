# Activate Powerpack

Nx Powerpack unlocks features of Nx that are particularly useful for larger organizations. The features include the ability to:

- [Run language-agnostic conformance rules](/features/powerpack-features/conformance)
- [Define code ownership at the project level](/features/powerpack-features/owners)
- [Change the remote cache storage location](/features/powerpack-features/custom-caching)

Activating Powerpack is a two step process.

## 1. Purchase a License

You'll need to [purchase a license](https://nx.app/nx-powerpack/purchase) online. The license cost depends on the

{% call-to-action title="Buy a Powerpack License" icon="nx" description="Unlock all the features of Nx" url="https://nx.app/nx-powerpack/purchase" /%}

Once you've completed the purchase, you will receive a license key.

## 2. Register the License Key

To register the license key in your repository, run the `nx activate-powerpack` command.

```shell
nx activate-powerpack YOUR_LICENSE_KEY
```

The license will be saved in your repository and should be committed so that every developer has access to the Powerpack features.

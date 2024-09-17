# Nx Powerpack

[Nx Powerpack](/concepts/powerpack) is a set of paid features of Nx that are particularly useful for larger organizations.

The feature set will continue to grow over time, but it currently consists of the following:

- [Run language-agnostic conformance rules](/features/powerpack-features/conformance)
- [Define code ownership at the project level](/features/powerpack-features/owners)
- [Change the remote cache storage location](/features/powerpack-features/custom-caching)

Powerpack is an extension of the Nx CLI, so it can be enabled with or without the use of [Nx Cloud](https://nx.app). Without Nx Cloud, Powerpack features are fully enabled to work in a single repository and in an offline-friendly way. For those with Nx Cloud enabled, we are actively working on integrating these Powerpack features with Nx Cloud to improve the experience for organizations with multiple repositories.

{% call-to-action title="Buy a Powerpack License" icon="nx" description="Unlock all the features of Nx" url="https://nx.app/nx-powerpack/purchase" /%}

## Business Motivation

Nx Powerpack fills a gap between the free open-source Nx CLI and the CI-focused Nx Cloud product. Powerpack enables Nx to justify committing time and effort to features that are valuable to a subset of the Nx user-base, but don't make sense as part of the open-source product. Nx is able to build commercial features that are not explicitly CI-focused and organizations are able to use premium Nx features even if they are not ready to use Nx Cloud in their CI process. Because purchasing Powerpack does not require a contract, many organizations can activate it without an extensive procurement process.

## Technical Details

There are three systems that work together to enable the Powerpack feature set.

### 1. Nx Powerpack License

When you [purchase a license](https://nx.app/nx-powerpack/purchase), it is encoded with your seat count, an expiration date and information about your organization. If your seat count changes or the expiration date arrives, you'll need to generate a new license and follow the [license activation process](/recipes/installation/activate-powerpack).

### 2. Nx Core Scaffolding

The core of Nx has the ability to register a license for a repository with the `nx activate-powerpack` command. Once Powerpack is activated, Nx core is responsible for validating the license and unlocking the features of Powerpack-enabled plugins.

### 3. Powerpack-Enabled Plugins

Nx provides commercial plugins that have their functionality enabled by the presence of a Powerpack license. These plugins are installed in the same way any Nx plugin is installed. Refer to the individual plugin documentation for usage and configuration instructions.

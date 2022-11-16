# Integrated Repos vs. Package-Based Repos

There are two styles of monorepos that you can build with Nx: integrated repos and package-based repos. At the most basic level, package-based repos utilize Nx's core features while integrated repos also use the plugin features. But the difference is more about the mindset than the features used and the style choice is on a spectrum - not a boolean.

- Package-based repos focus on flexibility and ease of adoption.
- Integrated repos focus on efficiency and ease of maintenance.

{% cards %}
{% card title="Packaged based vs Integrated Style - Use Nx however it works best for you" description="Choose your style and what works best for you!" type="video" url="https://youtu.be/ArmERpNvC8Y" /%}
{% card title="Getting Started with Package-Based Repos" description="Walkthrough for creating a package-based monorepo with Nx" type="video" url="https://youtu.be/hzTMKuE3CDw" /%}
{% card title="Getting Started with Integrated Repos" description="Walkthrough for creating an integrated monorepo with Nx" type="video" url="https://youtu.be/weZ7NAzB7PM" /%}
{% /cards %}

## Package-Based Repos

A package-based repo is a collection of packages that depend on each other via `package.json` files and nested `node_modules`. With this set up, you typically have a different set of dependencies for each project. Build tools like Jest and Webpack work as usual, since everything is resolved as if each package was in a separate repo and all of its dependencies were published to npm. It's very easy to move an existing package into a package-based repo, since you generally leave that package's existing build tooling untouched. Creating a new package inside the repo is just as difficult as spinning up a new repo, since you have to create all the build tooling from scratch.

Lerna, Yarn, Lage, [Turborepo](/more-concepts/turbo-and-nx) and Nx (without plugins) support this style.

## Integrated Repos

An integrated repo contains projects that depend on each other through standard import statements. There is typically a single version of every dependency defined at the root. Sometimes build tools like Jest and Webpack need to be wrapped in order to work correctly. It's harder to add an existing package to this style of repo, because the build tooling for that package may need to be modified. It's very simple to add a brand new project to the repo, because all the tooling decisions have already been made.

Bazel and Nx (with plugins) support this style.

## How to Choose

You can be successful working in either style repo. Typically, organizations that are just getting started with a monorepo begin with a package-based repo, because they want something that works quickly and that can demonstrate the value of a monorepo without a lot of upfront cost. However, if an organization is bought in to the idea of a monorepo and especially once they start to scale up, an integrated repo becomes more valuable. When making a new project is simple, every new route or feature can be its own project and sharing code across applications becomes simple and maintainable. Integrated repos restrict some of your choices in order to allow Nx to help you more.

The comparison between package-based repos and integrated repos is similar to the comparison between JSDoc and TypeScript. The former is easier to adopt and provides some good benefits. The latter takes more work but provides more value, especially at a larger scale.

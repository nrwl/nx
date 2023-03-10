export const content = `
The Nx plugin for Rspack.

[Rspack](https://www.rspack.dev/) is a fast build tool written in [Rust](https://www.rust-lang.org/) that is interoperable with the Webpack ecosystem.

Why should you use this plugin?

- Instant dev server start
- Lightning fast Hot-Module Reloading
- _Fast_ builds using Rspack.
- Out-of-the-box support for TypeScript, JSX, CSS, and more.
- Compatible with the Webpack ecosystem.

Read more about it in the [Rspack documentation](https://www.rspack.dev/).

## Setting up a new Nx workspace with Rspack

You can create a new React workspace that uses Rspack using this command:

\`\`\`shell
npx create-nx-workspace@latest --preset=@nrwl/rspack
\`\`\`

You will be prompted for a repository name, which will be used for the folder and application name.

## Add Rspack to an existing workspace

There are a number of ways to use Rspack in your existing workspace.


First, make sure \`@nrwl/rspack\` is installed.

{% tabs %}
{% tab label="npm" %}
\`\`\`bash
npm i -D @nrwl/rspack@latest
\`\`\`
{% /tab %}
{% tab label="yarn" %}
\`\`\`bash
yarn add -D @nrwl/rspack@latest
\`\`\`
{% /tab %}
{% tab label="pnpm" %}
\`\`\`bash
pnpm add -D @nrwl/rspack@latest
\`\`\`
{% /tab %}
{% /tabs %}

### Generate a new React project using Rspack

The easiest way to generate a new application that uses Rspack is by using the \`@nrwl/rspack:app\` generator.

\`\`\`bash
nx g @nrwl/rspack:app my-app --style=css
\`\`\`

Then you should be able to serve, test, and build the application.

\`\`\`bash
nx serve my-app
nx test my-app
nx build my-app
\`\`\`

### Generate a non-React project using Rspack

You can generate a [Web](/packages/web) application, and then use the \`@nrwl/rspack:configuration\` generator to configure the build and serve targets.

Make sure you have the Web plugin installed.

{% tabs %}
{% tab label="npm" %}
\`\`\`bash
npm i -D @nrwl/web@latest
\`\`\`
{% /tab %}
{% tab label="yarn" %}
\`\`\`bash
yarn add -D @nrwl/web@latest
\`\`\`
{% /tab %}
{% tab label="pnpm" %}
\`\`\`bash
pnpm add -D @nrwl/web@latest
\`\`\`
{% /tab %}
{% /tabs %}

Then generate the application.

\`\`\`bash
nx g @nrwl/web:app my-app --style=css
\`\`\`

Finally, configure Rspack for the new project.

\`\`\`bash
nx g @nrwl/rspack:configuration --project=my-app
\`\`\`

### Modify an existing React or Web project to use Rspack

You can use the \`@nrwl/rspack:configuration\` generator to change your React or Web project to use Rspack.
This generator will modify your project's configuration to use Rspack, and it will also install all the necessary dependencies.

You can read more about this generator on the [\`@nrwl/rspack:configuration\`](/packages/rspack/generators/configuration) generator page.

### Initialize Rspack

If you do not want to create any new projects or convert any existing projects yet, you can still use Nx to install all the necessary dependencies for Rspack.
This, for example, could be useful if you want to set up Rspack manually for a project.

\`\`\`bash
nx g @nrwl/rspack:init
\`\`\`
`;

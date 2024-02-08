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
npx create-nx-workspace@latest --preset=@nx/rspack
\`\`\`

You will be prompted for a repository name, which will be used for the folder and application name.

## Add Rspack to an existing workspace

There are a number of ways to use Rspack in your existing workspace.


First, make sure \`@nx/rspack\` is installed.

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the \`@nx/rspack\` version that matches the version of \`nx\` in your repository.  If the version numbers get out of sync, you can encounter some difficult to debug errors.  You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

\`\`\`bash
nx add @nx/rspack
\`\`\`


### Generate a new React project using Rspack

The easiest way to generate a new application that uses Rspack is by using the \`@nx/rspack:app\` generator.

\`\`\`bash
nx g @nx/rspack:app my-app --style=css
\`\`\`

Then you should be able to serve, test, and build the application.

\`\`\`bash
nx serve my-app
nx test my-app
nx build my-app
\`\`\`

### Generate a non-React project using Rspack

You can generate a [Web](/nx-api/web) application, and then use the \`@nx/rspack:configuration\` generator to configure the build and serve targets.

Make sure you have the Web plugin installed.

\`\`\`bash
nx add @nx/web
\`\`\`

Then generate the application.

\`\`\`bash
nx g @nx/web:app my-app --style=css
\`\`\`

Finally, configure Rspack for the new project.

\`\`\`bash
nx g @nx/rspack:configuration --project=my-app
\`\`\`

### Modify an existing React or Web project to use Rspack

You can use the \`@nx/rspack:configuration\` generator to change your React or Web project to use Rspack.
This generator will modify your project's configuration to use Rspack, and it will also install all the necessary dependencies.

You can read more about this generator on the [\`@nx/rspack:configuration\`](/nx-api/rspack/generators/configuration) generator page.

### Initialize Rspack

If you do not want to create any new projects or convert any existing projects yet, you can still use Nx to install all the necessary dependencies for Rspack.
This, for example, could be useful if you want to set up Rspack manually for a project.

\`\`\`bash
nx g @nx/rspack:init
\`\`\`
`;

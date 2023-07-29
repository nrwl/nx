export const content = `
# Configure Rspack on your Nx workspace

You can configure Rspack using a \`rspack.config.js\` file in your project. You can set the path to this file in your \`project.json\` file, in the \`build\` target options:

\`\`\`json
//...
"my-app": {
    "targets": {
        //...
        "build": {
            "executor": "@nx/rspack:rspack",
            //...
            "options": {
                //...
                "rspackConfig": "apps/my-app/rspack.config.js"
            },
            "configurations": {
                ...
            }
        },
    }
}
\`\`\`

In that file, you can add the necessary configuration for Rspack. You can read more on how to configure Rspack in the [Rspack documentation](https://www.rspack.dev/).

### Basic configuration for Nx

You should start with a basic Rspack configuration for Nx in your project, that looks like this:

\`\`\`js {% fileName="apps/my-app/rspack.config.js" %}
const { composePlugins, withNx } = require('@nx/rspack');

module.exports = composePlugins(withNx(), (config, { options, context }) => {
  // customize Rspack config here
  return config;
});
\`\`\`

The \`withNx()\` plugin adds the necessary configuration for Nx to work with Rspack. The \`composePlugins\` function allows you to add other plugins to the configuration.

#### The \`composePlugins\` function

The \`composePlugins\` function takes a list of plugins and a function, and returns a Rspack \`Configuration\` object. The \`composePlugins\` function is an enhanced version of the Rspack configuration function, which allows you to add plugins to the configuration, and provides you with a function which accepts two arguments:

1. \`config\`: The Rspack configuration object.
2. An object with the following properties:
   - \`options\`: The options passed to the \`@nx/rspack:rspack\` executor.
   - \`context\`: The context passed of the \`@nx/rspack:rspack\` executor.

This gives you the ability to customize the Rspack configuration as needed, and make use of the options and context passed to the executor, as well.

### Add configurations for other functionalities

In addition to the basic configuration, you can add configurations for other frameworks or features. The \`@nx/rspack\` package provides plugins such as \`withWeb\` and \`withReact\`. This plugins provide features such as TS support, CSS support, JSX support, etc. You can read more about how these plugins work and how to use them in our [Rspack Plugins guide](/packages/rspack/documents/rspack-plugins).

You may still reconfigure everything manually, without using the Nx plugins. However, these plugins ensure that you have the necessary configuration for Nx to work with your project.

## Customize your Rspack config

For most apps, the default configuration of Rspack is sufficient, but sometimes you need to tweak a setting in your Rspack config. This guide explains how to make a small change without taking on the maintenance burden of the entire Rspack config.

### Configure Rspack for React projects

React projects use the \`withReact\` plugin that adds the necessary configuration for React to work with Rspack. You can use this plugin to add the necessary configuration to your Rspack config.

\`\`\`js {% fileName="apps/my-app/rspack.config.js" %}
const { composePlugins, withNx, withReact } = require('@nx/rspack');

// Nx plugins for Rspack.
module.exports = composePlugins(
  withNx(),
  withReact(),
  (config, { options, context }) => {
    // Update the Rspack config as needed here.
    // e.g. config.plugins.push(new MyPlugin())
    return config;
  }
);
\`\`\`

`;

export const content = `
# Rspack plugins

Nx uses enhanced Rspack configuration files (e.g. \`rspack.config.js\`). These configuration files export a _plugin_ that takes in a rspack
configuration object and returns an updated configuration object. Plugins are used by Nx to add
functionality to the Rspack build.

This guide contains information on the plugins provided by Nx. For more information on customizing Rspack configuration, refer to the
[Nx Rspack configuration guide](/packages/rspack/documents/rspack-config-setup).

## withNx

The \`withNx\` plugin provides common configuration for the build, including TypeScript support and linking workspace libraries (via tsconfig paths).

### Example

\`\`\`js
const { composePlugins, withNx } = require('@nrwl/rspack');

module.exports = composePlugins(withNx(), (config) => {
  // Further customize Rspack config
  return config;
});
\`\`\`

## withWeb

The \`withWeb\` plugin adds support for CSS/SASS/Less stylesheets, assets (such as images and fonts), and \`index.html\` processing.

### Options

#### stylePreprocessorOptions

Type: \`{ includePaths: string[] }\`

Options to pass to style preprocessors. \`includePaths\` is a list of paths that are included (e.g. workspace libs with stylesheets).

### Example

\`\`\`js
const { composePlugins, withNx, withWeb } = require('@nrwl/rspack');

module.exports = composePlugins(
  // always pass withNx() first
  withNx(),
  // add web functionality
  withWeb({
    stylePreprocessorOptions: ['ui/src'],
  }),
  (config) => {
    // Further customize Rspack config
    return config;
  }
);
\`\`\`

## withReact

The \`withReact\` plugin adds support for React JSX and [Fast Refresh](https://github.com/pmmmwh/react-refresh-webpack-plugin)
### Example

\`\`\`js
const { composePlugins, withNx, withReact } = require('@nrwl/rspack');

module.exports = composePlugins(
  withNx(), // always pass withNx() first
  withReact({
    stylePreprocessorOptions: ['ui/src'],
  }),
  (config) => {
    // Further customize Rspack config
    return config;
  }
);
\`\`\`
`;

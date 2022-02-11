# Node Plugin

The Node Plugin contains generators and executors to manage Node applications within an Nx workspace. It provides:

## Setting Up Node

To add the Node plugin to an existing workspace, run one of the following:

```bash
# For npm users
npm install -D @nrwl/node

# For yarn users
yarn add -D @nrwl/node
```

### Creating Applications

You can add a new application with the following:

```bash
nx g @nrwl/node:application my-new-app
```

You can run your application with `nx serve my-new-app`, which starts it in watch mode.

### Creating Libraries

Node libraries are a good way to separate features within your organization. To create a Node library run the following command:

```bash
nx g @nrwl/js:node my-new-lib

# If you want the library to be buildable or publishable to npm
nx g @nrwl/node:lib my-new-lib --buildable
nx g @nrwl/node:lib my-new-lib \
--publishable \
--importPath=@myorg/my-new-lib
```

## Using Node

### Testing Projects

You can run unit tests with:

```bash
nx test my-new-app
nx test my-new-lib
```

Replace `my-new-app` with the name or your project. This command works for both applications and libraries.

### Building Projects

Node applications can be build with:

```bash
nx build my-new-app
```

And if you generated a library with `--buildable`, then you can build a library as well:

```bash
nx build my-new-lib
```

The output is in the `dist` folder. You can customize the output folder by setting `outputPath` in the project's `project.json` file.

### Application Proxies

Generating Node applications has an option to configure other projects in the workspace to proxy API requests. This can be done by passing the `--frontendProject` with the project name you wish to enable proxy support for.

```bash
nx g @nrwl/node:application my-new-app \
--frontendProject my-react-app
```

### Debugging

Debugging is set to use a random port that is available on the system. The port can be changed by setting the port option in the `serve` architect in the project.json. Or by running the serve command with `--port <number>`.

For additional information on how to debug Node applications, see the [Node.js debugging getting started guide](https://nodejs.org/en/docs/guides/debugging-getting-started/#inspector-clients).

## More Documentation

- [Using Cypress](/cypress/overview)
- [Using Jest](/jest/overview)

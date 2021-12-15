# Fastify Plugin

The Fastify plugin contains generators to add a new Fastify application to an Nx workspace.

## Adding the Fastify plugin

Adding the Fastify plugin to a workspace can be done with the following:

```bash
#yarn
yarn add -D @nrwl/fastify
```

```bash
#npm
npm install -D @nrwl/fastify
```

> Note: You can create new workspace that has Fastify and React set up by doing `npx create-nx-workspace@latest --preset=react-fastify`

## Applications

Generating new applications can be done with the following:

```bash
nx generate @nrwl/fastify:application <fastify-app>
```

This creates the following app structure:

```treeview
my-org/
├── apps/
    └── fastify-app/
        ├── jest.config.js
        ├── src/
        │   ├── app/
        │   ├── assets/
        │   ├── environments/
        │   │   ├── environment.prod.ts
        │   │   └── environment.ts
        │   └── main.ts
        ├── tsconfig.app.json
        ├── tsconfig.json
        ├── tsconfig.spec.json
        └── tslint.json
```

The `main.ts` content should look similar to this:

```typescript
import * as fastify from 'fastify';

const app = fastify();

app.get('/api', (req, res) => {
  res.send({ message: 'Welcome to fastify-app!' });
});

const port = process.env.port || 3333;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
server.on('error', console.error);
```

#### Application Proxies

Generating Fastify applications has an option to configure other projects in the workspace to proxy API requests. This can be done by passing the `--frontendProject` with the project name you wish to enable proxy support for.

```bash
nx generate @nrwl/fastify:application <fastify-app> --frontendProject my-react-app
```

### Application commands

When a Fastify application is added to the workspace.json (or angular.json), the following architect commands are available for execution:

#### build

```bash
nx build <fastify-app>
```

The build command will compile the application using Webpack. It supports a production configuration by building with the following command:

```bash
nx build <fastify-app> --configuration=production
```

Additional configurations can be added in the workspace.json. Changing the `--configuration` flag with the new configuration name will run that config.

#### serve

```bash
nx serve <fastify-app>
```

The serve command runs the `build` target, and executes the application.

By default, the serve command will run in watch mode. This allows code to be changed, and the Fastify application to be rebuilt automatically.
Fastify applications also have the `inspect` flag set, so you can attach your debugger to the running instance.

##### Debugging

Debugging is set to use a random port that is available on the system. The port can be changed by setting the port option in the `serve` architect in the workspace.json. Or by running the serve command with `--port <number>`.

For additional information on how to debug Node applications, see the [Node.js debugging getting started guide](https://fastifyjs.org/en/docs/guides/debugging-getting-started/#inspector-clients).

##### Waiting for other builds

Setting the `waitUntilTargets` option with an array of projects (with the following format: `"project:architect"`) will execute those commands before serving the Fastify application.

#### lint

The lint command will run linting within the scope of the Fastify app.

```bash
nx lint <fastify-app>
```

#### test

Test will execute Jest tests within the scope of the Fastify app.

```bash
nx test <fastify-app>
```

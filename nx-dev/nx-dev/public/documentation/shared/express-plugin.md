# Express Plugin

The Express plugin contains generators to add a new Express application to an Nx workspace.

## Adding the Express plugin

Adding the Express plugin to a workspace can be done with the following:

```bash
yarn add -D @nrwl/express
```

```bash
npm install -D @nrwl/express
```

> Note: You can create new workspace that has Express and React set up by doing `npx create-nx-workspace@latest --preset=react-express`

## Applications

Generating new applications can be done with the following:

```bash
nx generate @nrwl/express:application <express-app>
```

This creates the following app structure:

```treeview
my-org/
├── apps/
    └── express-app/
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
import * as express from 'express';

const app = express();

app.get('/api', (req, res) => {
  res.send({ message: 'Welcome to express-app!' });
});

const port = process.env.port || 3333;
const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api`);
});
server.on('error', console.error);
```

#### Application Proxies

Generating Express applications has an option to configure other projects in the workspace to proxy API requests. This can be done by passing the `--frontendProject` with the project name you wish to enable proxy support for.

```bash
nx generate @nrwl/express:application <express-app> --frontendProject my-react-app
```

### Application commands

When a Express application is added to the workspace.json (or angular.json), the following architect commands are available for execution:

#### build

```bash
nx build <express-app>
```

The build command will compile the application using Webpack. It supports a production configuration by building with the following command:

```bash
nx build <express-app> --configuration=production
```

Additional configurations can be added in the workspace.json. Changing the `--configuration` flag with the new configuration name will run that config.

#### serve

```bash
nx serve <express-app>
```

The serve command runs the `build` target, and executes the application.

By default, the serve command will run in watch mode. This allows code to be changed, and the Express application to be rebuilt automatically.
Express applications also have the `inspect` flag set, so you can attach your debugger to the running instance.

##### Debugging

Debugging is set to use a random port that is available on the system. The port can be changed by setting the port option in the `serve` architect in the workspace.json. Or by running the serve command with `--port <number>`.

For additional information on how to debug Node applications, see the [Node.js debugging getting started guide](https://expressjs.org/en/docs/guides/debugging-getting-started/#inspector-clients).

##### Waiting for other builds

Setting the `waitUntilTargets` option with an array of projects (with the following format: `"project:architect"`) will execute those commands before serving the Express application.

#### lint

The lint command will run linting within the scope of the Express app.

```bash
nx lint <express-app>
```

#### test

Test will execute Jest tests within the scope of the Express app.

```bash
nx test <express-app>
```

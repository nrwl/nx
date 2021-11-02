# Node Plugin

The Node Plugin contains generators and executors to manage Node applications within an Nx workspace.

## Installing the Node Plugin

Installing the Node plugin to a workspace can be done with the following:

```bash
#yarn
yarn add -D @nrwl/node
```

```bash
#npm
npm install -D @nrwl/node
```

## Applications

Generating new applications can be done with the following:

```bash
nx generate @nrwl/node:application <node-app>
```

This creates the following app structure:

```treeview
my-org/
├── apps/
    └── node-app/
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

From here files can be added within the `app` folder.
Make sure to import any files within the `main.ts` file so that they can be executed when the application is ran.

#### Application Proxies

Generating Node applications has an option to configure other projects in the workspace to proxy API requests. This can be done by passing the `--frontendProject` with the project name you wish to enable proxy support for.

```bash
nx generate @nrwl/node:application <node-app> --frontendProject my-react-app
```

### Application commands

When a Node application is added to the workspace.json (or angular.json), the following architect commands are available for execution:

#### build

```bash
nx build <node-app>
```

The build command will compile the application using Webpack. It supports a production configuration by building with the following command:

```bash
nx build <node-app> --configuration=production
```

Additional configurations can be added in the workspace.json. Changing the `--configuration` flag with the new configuration name will run that config.

#### serve

```bash
nx serve <node-app>
```

The serve command runs the `build` target, and executes the application.

By default, the serve command will run in watch mode. This allows code to be changed, and the Node application to be rebuilt automatically.
Node applications also have the `inspect` flag set, so you can attach your debugger to the running instance.

##### Debugging

Debugging is set to use a random port that is available on the system. The port can be changed by setting the port option in the `serve` architect in the workspace.json. Or by running the serve command with `--port <number>`.

For additional information on how to debug Node applications, see the [Node.js debugging getting started guide](https://nodejs.org/en/docs/guides/debugging-getting-started/#inspector-clients).

#### lint

The lint command will run linting within the scope of the Node app.

```bash
nx lint <node-app>
```

#### test

Test will execute Jest tests within the scope of the Node app.

```bash
nx test <node-app>
```

## Libraries

Node libraries are a good way to separate features within your organization. To create a Node library run the following command:

```bash
nx generate @nrwl/node:library <node-lib>
```

#### Buildable libraries

Libraries can also be enabled to be built separately from apps. To create a buildable library, add the `--buildable` flag to the generate command above.

```bash
nx generate @nrwl/node:library <node-lib> --buildable
```

### Library commands

When a Node library is added to the workspace.json (or angular.json), the following architect commands are available for execution:

#### lint

The lint command will run linting within the scope of the Node library.

```bash
nx lint <node-lib>
```

#### test

Test will execute Jest tests within the scope of the Node library.

```bash
nx test <node-lib>
```

#### build

The build command will only be available if the library was generated with the `--buildable` flag.

Buildable Node libraries use TypeScript to compile the source. The tsconfig files that are generated with the library allow customization of the compiled output.

```bash
nx build <node-lib>
```

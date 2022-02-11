# Nest Plugin

![NestJS logo](/shared/nest-logo.png)

Nest.js is a framework designed for building scalable server-side applications. In many ways, Nest is familiar to Angular developers:

- It has excellent TypeScript support.
- Its dependency injection system is similar to the one in Angular.
- It emphasises testability.
- Its configuration APIs are similar to Angular as well.

Many conventions and best practices used in Angular applications can be also be used in Nest.

## Installing the Nest Plugin

Installing the Nest plugin to a workspace can be done with the following:

```bash
yarn add -D @nrwl/nest
```

```bash
npm install -D @nrwl/nest
```

## Applications

Generating new applications can be done with the following:

```bash
nx generate @nrwl/nest:application <nest-app>
```

This creates the following app structure:

```treeview
my-org/
├── apps/
    └── nest-app/
        ├── jest.config.js
        ├── src/
        │   ├── app/
        │   │   ├── app.controller.ts
        │   │   ├── app.controller.spec.ts
        │   │   ├── app.module.ts
        │   │   ├── app.service.ts
        │   │   └── app.service.spec.ts
        │   ├── assets/
        │   ├── environments/
        │   └── main.ts
        ├── tsconfig.app.json
        ├── tsconfig.json
        ├── tsconfig.spec.json
        └── tslint.json
```

The `main.ts` content should look similar to this:

```typescript
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const port = process.env.port || 3333;
  await app.listen(port, () => {
    console.log('Listening at http://localhost:' + port + '/' + globalPrefix);
  });
}

bootstrap();
```

#### Application Proxies

Generating Nest applications has an option to configure other projects in the workspace to proxy API requests. This can be done by passing the `--frontendProject` with the project name you wish to enable proxy support for.

```bash
nx generate @nrwl/nest:application <nest-app> --frontendProject my-angular-app
```

### Application commands

When a Nest application is added, the following architect commands are available for execution:

#### build

```bash
nx build <nest-app>
```

The build command will compile the application using Webpack. It supports a production configuration by building with the following command:

```bash
nx build <nest-app> --configuration=production
```

Additional configurations can be added in the project.json. Changing the `--configuration` flag with the new configuration name will run that config.

#### serve

```bash
nx serve <nest-app>
```

The serve command runs the `build` target, and executes the application.

By default, the serve command will run in watch mode. This allows code to be changed, and the Nest application to be rebuilt automatically.
Nest applications also have the `inspect` flag set, so you can attach your debugger to the running instance.

##### Debugging

Debugging is set to use a random port that is available on the system. The port can be changed by setting the port option in the `serve` architect in the project.json. Or by running the serve command with `--port <number>`.

For additional information on how to debug Node applications, see the [Node.js debugging getting started guide](https://nestjs.org/en/docs/guides/debugging-getting-started/#inspector-clients).

##### Waiting for other builds

Setting the `waitUntilTargets` option with an array of projects (with the following format: `"project:architect"`) will execute those commands before serving the Nest application.

#### lint

The lint command will run linting within the scope of the Nest app.

```bash
nx lint <nest-app>
```

#### test

Test will execute Jest tests within the scope of the Nest app.

```bash
nx test <nest-app>
```

## Libraries

Nest libraries are a good way to separate features within your organization. To create a Nest library run the following command:

```bash
nx generate @nrwl/nest:library <nest-lib>
```

Nest libraries can also be generated with an included controller, service or making the module global with their respective flags.

```bash
nx generate @nrwl/nest:library <nest-lib> [--controller] [--service] [--global]

```

#### Buildable libraries

Libraries can also be enabled to be built separately from apps. To create a buildable library, add the `--buildable` flag to the generate command above.

```bash
nx generate @nrwl/nest:library <nest-lib> --buildable
```

### Library commands

When a Nest library is added, the following architect commands are available for execution:

#### lint

The lint command will run linting within the scope of the Nest library.

```bash
nx lint <nest-lib>
```

#### test

Test will execute Jest tests within the scope of the Nest library.

```bash
nx test <nest-lib>
```

> Note: By default, Nest libraries are generated with Jest's test environment set to `node`

#### build

The build command will only be available if the library was generated with the `--buildable` flag.

Buildable Nest libraries use TypeScript to compile the source. The tsconfig files that are generated with the library allow customization of the compiled output.

```bash
nx build <nest-lib>
```

## Nest Generators

The Nest plugin for Nx extends the generators provided by Nest. Any commands that can be used with the Nest CLI can also be used with the `nx` command. The `--sourceRoot` flag should be used for all Nest generators.

> The `--sourceRoot` command should point to the source directory of a Nest library or application within an Nx workspace.

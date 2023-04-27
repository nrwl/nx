# Migrating an Angular application manually

{% callout type="note" title="Older Angular Versions" %}
If you are using older versions of Angular (version 13 or lower), make sure to use the appropriate version of Nx that matches your version of Angular. See the [Nx and Angular Version Compatibility Matrix](/packages/angular/documents/angular-nx-version-matrix) to find the correct version. The generated files will also be slightly different.
{% /callout %}

If you are unable to automatically transform your Angular CLI workspace to an [Nx Integrated workspace](/recipes/adopting-nx-angular/angular-integrated), there are some manual steps you can take to move your project(s) into an Nx workspace.

### Generating a new workspace

To start, run the command to generate an Nx workspace with an Angular application.

**Using `npx`**

```shell
npx create-nx-workspace myorg --preset=angular-standalone
```

**Using `npm init`**

```shell
npm init nx-workspace myorg --preset=angular-standalone
```

**Using `yarn create`**

```shell
yarn create nx-workspace myorg --preset=angular-standalone
```

When prompted for the `application name`, enter the _project name_ from your current `angular.json` file.

A new Nx workspace with your `org name` as the folder name, and your `application name` as the root-level application is generated.

```text
<workspace name>/
├── e2e/
│   ├── src/
│   ├── .eslintrc.json
│   ├── cypress.config.ts
│   ├── project.json
│   └── tsconfig.json
├── src/
│   ├── app/
│   ├── assets/
│   ├── favicon.ico
│   ├── index.html
│   ├── main.ts
│   ├── styles.css
│   └── test-setup.ts
├── .eslintrc.json
├── .eslintrc.base.json
├── .gitignore
├── .prettierignore
├── .prettierrc
├── jest.config.app.ts
├── jest.config.ts
├── jest.preset.js
├── nx.json
├── package.json
├── project.json
├── README.md
├── tsconfig.app.json
├── tsconfig.base.json
├── tsconfig.editor.json
├── tsconfig.json
└── tsconfig.spec.json
```

### Review Angular installed packages versions

Creating an Nx workspace with the latest version will install the Angular packages on their latest versions. If you're using a [lower version that's supported by the latest Nx](/packages/angular/documents/angular-nx-version-matrix), make sure to adjust the newly generated `package.json` file with your versions.

### Copying over application files

Your application code is self-contained within the `src` folder of your Angular CLI workspace.

- Copy the `src` folder from your Angular CLI project to the `apps/<app name>` folder, overwriting the existing `src` folder.
- Copy any project-specific configuration files, such as `browserslist`, or service worker configuration files into their relative path under `src` in the root of the repo.
- Transfer the `assets`, `scripts`, `styles`, and build-specific configuration, such as service worker configuration, from your Angular CLI `angular.json` to the root-level `project.json` file.

Verify your application runs correctly by running:

```shell
ng serve <app name>
```

### Updating your unit testing configuration

Nx uses Jest by default. If you have any custom Jest configuration, you need to update the workspace Jest configuration also.

Verify your tests run correctly by running:

```shell
ng test <app name>
```

If you are using `Karma` for unit testing:

- Copy the `karma.conf.js` file to the root folder.
- Copy the `test.ts` file to your `src` folder.
- Copy the `test` target in your `architect` configuration from your Angular CLI `angular.json` file into the `targets` configuration in the `project.json` file in your Nx workspace.
- Run `nx format` to change `architect` to `targets` and `builder` to `executor`.

> Jest will be used by default when generating new applications. If you want to continue using `Karma`, set the `unitTestRunner` to `karma` in the `generators` section of the `nx.json` file.

- Update `test-setup.ts` to `test.ts` in the `files` array of the `tsconfig.spec.json` file.

```json {% fileName="tsconfig.spec.json" %}
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../dist/out-tsc",
    "types": ["jasmine", "node"]
  },
  "files": ["src/test.ts", "src/polyfills.ts"],
  "include": ["**/*.spec.ts", "**/*.test.ts", "**/*.d.ts"]
}
```

Verify your tests run correctly by running:

```shell
ng test <app name>
```

### Updating your E2E testing configuration

Nx uses Cypress by default. If you are already using Cypress, copy your E2E setup files into the `apps/<app name>-e2e` folder and verify your tests still run correctly by running:

```shell
ng e2e <app name>-e2e
```

If you are using `Protractor` for E2E testing:

- Delete the `e2e` folder that was generated to use Cypress.
- Copy the `e2e` folder from your Angular CLI workspace into the root folder.
- Create the project configuration file at `e2e/project.json`.
- Copy the project configuration for `e2e` from the Angular CLI workspace `angular.json` file to `e2e/project.json` and adjust the file paths to be relative to `e2e`.
- Run `nx format` to change `architect` to `targets` and `builder` to `executor`.

Create a `tsconfig.json` file under `e2e` folder:

```json {% fileName="e2e/tsconfig.json" %}
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "../dist/out-tsc"
  }
}
```

Update the `tsconfig.app.json` to extend the root `tsconfig.json`:

```json {% fileName="tsconfig.app.json" %}
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist/out-tsc",
    "module": "commonjs",
    "target": "es5",
    "types": ["jasmine", "jasminewd2", "node"]
  }
}
```

Verify your E2E tests run correctly by running:

```shell
ng e2e e2e
```

> Cypress will be used by default when generating new applications. If you want to continue using `Protractor`, set the `e2eTestRunner` to `protractor` in the `generators` section of the `nx.json` file.

### Updating your linting configuration

For lint rules, migrate your existing rules into the root `.eslintrc.base.json` file.

Verify your lint checks run correctly by running:

```shell
npm run lint
```

OR

```shell
yarn lint
```

Learn more about the advantages of Nx in the following guides:

[Using Cypress for e2e tests](/packages/cypress) \
[Using Jest for unit tests](/packages/jest) \
[Rebuilding and Retesting What is Affected](/concepts/affected)

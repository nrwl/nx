# Migrating an Angular application manually

{% callout type="note" title="Older Angular Versions" %}
If you are using older versions of Angular (version 13 or lower), make sure to use the appropriate version of Nx that matches your version of Angular. See the [Nx and Angular Version Compatibility Matrix](/nx-api/angular/documents/angular-nx-version-matrix) to find the correct version. The generated files will also be slightly different.
{% /callout %}

If you are unable to automatically transform your Angular CLI workspace to an [Nx workspace](/recipes/angular/migration/angular), there are some manual steps you can take to move your project(s) into an Nx workspace.

### Generating a new workspace

To start, run the following command to generate an Nx workspace with an Angular application:

{% tabs %}
{%tab label="npm"%}

```shell
npx create-nx-workspace <application-name> --preset=angular-standalone
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn create nx-workspace <application-name> --preset=angular-standalone
```

{% /tab %}
{% /tabs %}

Replace `<application-name>` with the project name from your current `angular.json` file.

{% callout type="note" title="Test runners" %}
Nx generators support the following test runners:

- Unit Testing: Jest
- E2E Testing: Cypress and Playwright

If your Angular CLI application doesn't use any of those, you can skip generating them by providing the following flags when creating the workspace: `--unit-test-runner=none` and/or `e2e-test-runner=none`.
{% /callout %}

A new Nx workspace with `<application-name>` as the folder name, and a root-level application with the same name is generated.

```text
<application-name>/
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
├── tsconfig.editor.json
├── tsconfig.json
└── tsconfig.spec.json
```

### Adjust the workspace name

The `angular-standalone` preset used to generate the new Nx workspace creates a workspace with the same name as the initial Angular application at the root. If you plan to migrate multiple projects or generate extra projects, you probably want to update the generated workspace name to something more generic. Make sure to rename the folder containing the workspace and the name in the root `package.json` file.

### Review installed packages

Creating an Nx workspace with the latest version will install the Angular packages on their latest versions. If you're using a [lower version that's supported by the latest Nx](/nx-api/angular/documents/angular-nx-version-matrix), make sure to adjust the newly generated `package.json` file with your versions.

You should add to the Nx workspace `package.json` file any extra packages you're using in your Angular CLI repo.

### Copying over application files

Your application source code is self-contained within the `src` folder of your Angular CLI workspace.

- Delete the `src` folder that was generated in the new Nx workspace.
- Copy the `src` folder from your Angular CLI project to the root of the workspace, overwriting the existing `src` folder.
- Copy any project-specific root configuration files from your Angular CLI project, such as `browserslist`, or service worker configuration files to the root of the workspace.
- Update the `tsconfig.app.json` with the relevant options from the same file in your Angular CLI workspace.
- Copy the configuration for the `build` and `serve` targets from the Angular CLI workspace `angular.json` file into the `targets` configuration in the root `project.json` file.
- Rename `builder` to `executor`.

Verify your application runs correctly by running:

```shell
nx serve
```

### Updating your unit testing configuration

{% tabs %}
{% tab label="Jest" %}

- Update the workspace `jest.config.ts` file with the relevant Jest configuration from your Angular CLI workspace.
- Update the `tsconfig.spec.json` with the relevant options from the same file in your Angular CLI workspace.
- Copy the configuration for the `test` target from the Angular CLI workspace `angular.json` file into the `targets` configuration in the root `project.json` file.
- Rename `builder` to `executor`.

{% /tab %}

{% tab label="Karma" %}

- If you generated the workspace with Jest:
  - Delete the `jest.preset.js` and `jest.config.ts` from the workspace root.
  - Delete the Jest-related dependencies from the workspace `package.json`.
- Copy the `karma.conf.js` file to the root folder.
- Update the `tsconfig.spec.json` with the relevant content from the same file in your Angular CLI workspace.
- Copy the configuration for the `test` target from the Angular CLI workspace `angular.json` file into the `targets` configuration in the root `project.json` file.
- Rename `builder` to `executor`.

{% callout type="note" title="Karma" %}
The `@nx/angular` plugin generators only support generating projects with Jest. If you want to continue using Karma, you could create a simple [local Nx plugin](/extending-nx/tutorials/create-plugin) with a [custom generator](/extending-nx/recipes/local-generators) to set it up.
{% /callout %}

{% /tab %}
{% /tabs %}

Verify your tests run correctly by running:

```shell
nx test
```

### Updating your E2E testing configuration

{% tabs %}
{% tab label="Cypress" %}

- Copy the `e2e` folder from your Angular CLI project to the root of the workspace, overwriting the existing `e2e` folder.
- Copy the configuration for the `e2e` target from the Angular CLI workspace `angular.json` file into the `targets` configuration in the `e2e/project.json` file.
- Rename `builder` to `executor`.

{% /tab %}

{% tab label="Protractor" %}

- If you generated the workspace with Cypress:
  - Delete the `e2e` folder that was generated to use Cypress.
  - Delete the Cypress-related dependencies from the workspace `package.json`.
- Copy the `e2e` folder from your Angular CLI workspace into the root folder.
- Create the project configuration file at `e2e/project.json`.
- Copy the configuration for the `e2e` target from the Angular CLI workspace `angular.json` file into the `targets` configuration in the `e2e/project.json` file.
- Rename `builder` to `executor`.

{% callout type="note" title="Protractor" %}
The `@nx/angular` plugin generators only support generating projects with Cypress and Playwright. If you want to continue using Protractor, you could create a simple [local Nx plugin](/extending-nx/tutorials/create-plugin) with a [custom generator](/extending-nx/recipes/local-generators) to set it up.
{% /callout %}

{% /tab %}
{% /tabs %}

Verify your tests still run correctly by running:

```shell
nx e2e e2e
```

### Updating your linting configuration

Nx generators use ESLint by default. If you are already using ESLint:

- Update the `eslintrc.json` with the relevant content from the same file (or similar ESLint configuration file) in your Angular CLI workspace.
- Copy the configuration for the `lint` target from the Angular CLI workspace `angular.json` file into the `targets` configuration in the root `project.json` file.
- Rename `builder` to `executor`.

Verify your lint checks run correctly by running:

```shell
nx lint
```

### Extra targets

If you have other targets in your Angular CLI `angular.json` file not covered by this recipe, make sure to follow a similar process:

- Copy/update relevant files.
- Copy the configuration for the target from the Angular CLI workspace `angular.json` file into the `targets` configuration in the root `project.json` file.
- Rename `builder` to `executor`.

Verify the target runs correctly by running:

```shell
nx <target>
```

Learn more about the advantages of Nx in the following guides:

[Using Cypress for e2e tests](/nx-api/cypress) \
[Using Jest for unit tests](/nx-api/jest) \
[Rebuilding and Retesting What is Affected](/ci/features/affected)


The @nx/vue plugin provides various generators to help you create and configure vue projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `application`
Create a Vue application for Nx.

### Examples

###### Simple Application

Create an application named `my-app`:

```shell
nx g @nx/vue:app apps/my-app
```

###### Specify style extension

Create an application named `my-app` in the `my-dir` directory and use `scss` for styles:

```shell
nx g @nx/vue:app apps/my-dir/my-app --style=scss
```

###### Add tags

Add tags to the application (used for linting).

```shell
nx g @nx/vue:app apps/my-app --tags=scope:admin,type:ui
```

**Usage:**
```bash
nx generate @nx/vue:application [options]
```

**Aliases:** `app`

**Arguments:**
```bash
nx generate @nx/vue:application <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--bundler` | string | The bundler to use. | `"vite"` |
| `--e2eTestRunner` | string | Test runner to use for end to end (E2E) tests. | `"playwright"` |
| `--inSourceTests` | boolean | When using Vitest, separate spec files will not be generated and instead will be included within the source files. Read more on the Vitest docs site: https://vitest.dev/guide/in-source.html | `false` |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"none"` |
| `--name` | string | The name of the application. |  |
| `--rootProject` | boolean | Create a application at the root of the workspace | `false` |
| `--routing` | boolean | Generate application with routes. | `false` |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--strict` | boolean | Whether to enable tsconfig strict mode or not. | `true` |
| `--style` | string | The file extension to be used for style files. | `"css"` |
| `--tags` | string | Add tags to the application (used for linting). |  |
| `--unitTestRunner` | string | Test runner to use for unit tests. | `"none"` |
| `--useProjectJson` | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file. |  |

## `component`
Create a Vue Component for Nx.

**Usage:**
```bash
nx generate @nx/vue:component [options]
```

**Aliases:** `c`

**Arguments:**
```bash
nx generate @nx/vue:component <path> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--export` | boolean | When true, the component is exported from the project `index.ts` (if it exists). | `false` |
| `--fileName` | string | Create a component with this file name. |  |
| `--inSourceTests` | boolean | When using Vitest, separate spec files will not be generated and instead will be included within the source files. Read more on the Vitest docs site: https://vitest.dev/guide/in-source.html | `false` |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--routing` | boolean | Generate a library with routes. |  |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipTests` | boolean | When true, does not create `spec.ts` test files for the new component. | `false` |

## `library`
Create a Vue Library for an Nx workspace.

**Usage:**
```bash
nx generate @nx/vue:library [options]
```

**Aliases:** `lib`

**Arguments:**
```bash
nx generate @nx/vue:library <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--appProject` | string | The application project to add the library route to. |  |
| `--bundler` | string | The bundler to use. Choosing 'none' means this library is not buildable. | `"none"` |
| `--component` | boolean | Generate a default component. | `false` |
| `--importPath` | string | The library name used to import it, like `@myorg/my-awesome-lib`. |  |
| `--inSourceTests` | boolean | When using Vitest, separate spec files will not be generated and instead will be included within the source files. | `false` |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"none"` |
| `--minimal` | boolean | Create a Vue library with a minimal setup, no separate test files. | `false` |
| `--name` | string | Library name |  |
| `--publishable` | boolean | Create a publishable library. |  |
| `--routing` | boolean | Generate library with routes. |  |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--skipTsConfig` | boolean | Do not update `tsconfig.json` for development experience. | `false` |
| `--strict` | boolean | Whether to enable tsconfig strict mode or not. | `true` |
| `--tags` | string | Add tags to the library (used for linting). |  |
| `--unitTestRunner` | string | Test runner to use for unit tests. | `"none"` |
| `--useProjectJson` | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file. |  |

## `setup-tailwind`
Adds the Tailwind CSS configuration files for a given Vue project and installs, if needed, the packages required for Tailwind CSS to work.

**Usage:**
```bash
nx generate @nx/vue:setup-tailwind [options]
```

**Arguments:**
```bash
nx generate @nx/vue:setup-tailwind <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--skipFormat` | boolean | Skips formatting the workspace after the generator completes. |  |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--stylesheet` | string | Path to the styles entry point relative to the workspace root. This option is only needed if the stylesheet location cannot be found automatically. |  |

## `stories`
Generate stories/specs for all components declared in a project.

This generator will generate stories for all your components in your project. The stories will be generated using [Component Story Format 3 (CSF3)](https://storybook.js.org/blog/storybook-csf3-is-here/).

You can also use this generator to generate stories for your **Nuxt** project:

```bash
nx g @nx/vue:stories project-name
```

or

```bash
nx g @nx/nuxt:stories project-name
```

You can read more about how this generator works, in the [Storybook for Vue overview page](/recipes/storybook/overview-vue#auto-generate-stories).

When running this generator, you will be prompted to provide the following:

- The `name` of the project you want to generate the configuration for.
- Whether you want to set up [Storybook interaction tests](https://storybook.js.org/docs/angular/writing-tests/interaction-testing) (`interactionTests`). If you choose `yes`, a `play` function will be added to your stories, and all the necessary dependencies will be installed. You can read more about this in the [Nx Storybook interaction tests documentation page](/recipes/storybook/storybook-interaction-tests#setup-storybook-interaction-tests)..

You must provide a `name` for the generator to work.

By default, this generator will also set up [Storybook interaction tests](https://storybook.js.org/docs/angular/writing-tests/interaction-testing). If you don't want to set up Storybook interaction tests, you can pass the `--interactionTests=false` option, but it's not recommended.

There are a number of other options available. Let's take a look at some examples.

### Examples

#### Ignore certain paths when generating stories

```bash
nx g @nx/vue:stories --name=ui --ignorePaths=libs/ui/src/not-stories/**,**/**/src/**/*.other.*
```

This will generate stories for all the components in the `ui` project, except for the ones in the `libs/ui/src/not-stories` directory, and also for components that their file name is of the pattern `*.other.*`.

This is useful if you have a project that contains components that are not meant to be used in isolation, but rather as part of a larger component.

By default, Nx will ignore the following paths:

```text
*.stories.ts, *.stories.tsx, *.stories.js, *.stories.jsx, *.stories.mdx
```

but you can change this behaviour easily, as explained above.

#### Generate stories using JavaScript instead of TypeScript

```bash
nx g @nx/vue:stories --name=ui --js=true
```

This will generate stories for all the components in the `ui` project using JavaScript instead of TypeScript. So, you will have `.stories.js` files next to your components.

**Usage:**
```bash
nx generate @nx/vue:stories [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--project` | string [**required**] | Project for which to generate stories. |  |
| `--ignorePaths` | array | Paths to ignore when looking for components. | `["*.stories.ts,*.stories.tsx,*.stories.js,*.stories.jsx,*.stories.mdx"]` |
| `--interactionTests` | boolean | Set up Storybook interaction tests. | `true` |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |

## `storybook-configuration`
Set up Storybook for a Vue project.

This generator will set up Storybook for your **Vue** project. You can also use this generator to generate Storybook configuration for your **Nuxt** project.

```bash
nx g @nx/vue:storybook-configuration project-name
```

or

```bash
nx g @nx/nuxt:storybook-configuration project-name
```

You can read more about how this generator works, in the [Storybook for Vue overview page](/recipes/storybook/overview-vue#generate-storybook-configuration-for-a-vue-project).

When running this generator, you will be prompted to provide the following:

- The `name` of the project you want to generate the configuration for.
- Whether you want to set up [Storybook interaction tests](https://storybook.js.org/docs/vue/writing-tests/interaction-testing) (`interactionTests`). If you choose `yes`, a `play` function will be added to your stories, and all the necessary dependencies will be installed. Also, a `test-storybook` target will be generated in your project's `project.json`, with a command to invoke the [Storybook `test-runner`](https://storybook.js.org/docs/vue/writing-tests/test-runner). You can read more about this in the [Nx Storybook interaction tests documentation page](/recipes/storybook/storybook-interaction-tests#setup-storybook-interaction-tests)..
- Whether you want to `generateStories` for the components in your project. If you choose `yes`, a `.stories.ts` file will be generated next to each of your components in your project.

You must provide a `name` for the generator to work.

By default, this generator will also set up [Storybook interaction tests](https://storybook.js.org/docs/vue/writing-tests/interaction-testing). If you don't want to set up Storybook interaction tests, you can pass the `--interactionTests=false` option, but it's not recommended.

There are a number of other options available. Let's take a look at some examples.

### Examples

#### Generate Storybook configuration

```bash
nx g @nx/vue:storybook-configuration ui
```

This will generate Storybook configuration for the `ui` project using TypeScript for the Storybook configuration files (the files inside the `.storybook` directory, eg. `.storybook/main.ts`).

#### Ignore certain paths when generating stories

```bash
nx g @nx/vue:storybook-configuration ui --generateStories=true --ignorePaths=libs/ui/src/not-stories/**,**/**/src/**/*.other.*,apps/my-app/**/*.something.ts
```

This will generate a Storybook configuration for the `ui` project and generate stories for all components in the `libs/ui/src/lib` directory, except for the ones in the `libs/ui/src/not-stories` directory, and the ones in the `apps/my-app` directory that end with `.something.ts`, and also for components that their file name is of the pattern `*.other.*`.

This is useful if you have a project that contains components that are not meant to be used in isolation, but rather as part of a larger component.

By default, Nx will ignore the following paths:

```text
*.stories.ts, *.stories.tsx, *.stories.js, *.stories.jsx, *.stories.mdx
```

but you can change this behaviour easily, as explained above.

#### Generate stories using JavaScript instead of TypeScript

```bash
nx g @nx/vue:storybook-configuration ui --generateStories=true --js=true
```

This will generate stories for all the components in the `ui` project using JavaScript instead of TypeScript. So, you will have `.stories.js` files next to your components.

#### Generate Storybook configuration using JavaScript

```bash
nx g @nx/vue:storybook-configuration ui --tsConfiguration=false
```

By default, our generator generates TypeScript Storybook configuration files. You can choose to use JavaScript for the Storybook configuration files of your project (the files inside the `.storybook` directory, eg. `.storybook/main.js`).

**Usage:**
```bash
nx generate @nx/vue:storybook-configuration [options]
```

**Arguments:**
```bash
nx generate @nx/vue:storybook-configuration <project> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--configureStaticServe` | boolean | Specifies whether to configure a static file server target for serving storybook. Helpful for speeding up CI build/test times. | `true` |
| `--generateStories` | boolean | Automatically generate `*.stories.ts` files for components declared in this project? | `true` |
| `--ignorePaths` | array | Paths to ignore when looking for components. | `["*.stories.ts,*.stories.tsx,*.stories.js,*.stories.jsx,*.stories.mdx"]` |
| `--interactionTests` | boolean | Set up Storybook interaction tests. | `true` |
| `--js` | boolean | Generate JavaScript story files rather than TypeScript story files. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"eslint"` |
| `--tsConfiguration` | boolean | Configure your project with TypeScript. Generate main.ts and preview.ts files, instead of main.js and preview.js. | `true` |

## Getting Help

You can get help for any generator by adding the `--help` flag:

```bash
nx generate @nx/vue:<generator> --help
```

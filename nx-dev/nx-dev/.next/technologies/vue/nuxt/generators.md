
The @nx/nuxt plugin provides various generators to help you create and configure nuxt projects within your Nx workspace.
Below is a complete reference for all available generators and their options.

## `application`
Create a Nuxt Application for Nx.

Your new Nuxt application will be generated with the following directory structure, following the suggested [directory structure](https://nuxt.com/docs/guide/directory-structure) for Nuxt applications:

```text
my-nuxt-app
├── nuxt.config.ts
├── project.json
├── src
│   ├── app.vue
│   ├── assets
│   │   └── css
│   │       └── styles.css
│   ├── components
│   │   └── NxWelcome.vue
│   ├── pages
│   │   ├── about.vue
│   │   └── index.vue
│   ├── public
│   │   └── favicon.ico
│   └── server
│       ├── api
│       │   └── greet.ts
│       └── tsconfig.json
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.spec.json
└── vitest.config.ts
```

Your new app will contain the following:

- Two pages (home and about) under `pages`
- A component (`NxWelcome`) under `components`
- A `greet` API endpoint that returns a JSON response under `/api/greet`
- Configuration for `vitest`
- Your app's entrypoint (`app.vue`) will contain the navigation links to the home and about pages, and the `nuxt-page` component to display the contents of your pages.

### Examples

###### Create app in a nested directory

```shell
nx g @nx/nuxt:app apps/nested/myapp
```

###### Create app with vitest configured

```shell
nx g @nx/nuxt:app apps/nested/myapp --unitTestRunner=vitest
```

###### Use plain JavaScript (not TypeScript)

```shell
nx g @nx/nuxt:app apps/myapp --js
```

### Generate pages and components

You can use the the [`@nx/vue:component` generator](/nx-api/vue/generators/component) to generate new pages and components for your application. You can read more on the [`@nx/vue:component` generator documentation page](/nx-api/vue/generators/component), but here are some examples:

###### New page

```shell
nx g @nx/nuxt:component my-app/src/pages/my-page
```

###### New component

```shell
nx g @nx/nuxt:component my-app/src/components/my-cmp
```

**Usage:**
```bash
nx generate @nx/nuxt:application [options]
```

**Aliases:** `app`

**Arguments:**
```bash
nx generate @nx/nuxt:application <directory> [options]
```

#### Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `--e2eTestRunner` | string | Test runner to use for end to end (E2E) tests. | `"playwright"` |
| `--js` | boolean | Generate JavaScript files rather than TypeScript files. | `false` |
| `--linter` | string | The tool to use for running lint checks. | `"none"` |
| `--name` | string | The name of the application. |  |
| `--rootProject` | boolean | Create an application at the root of the workspace. | `false` |
| `--setParserOptionsProject` | boolean | Whether or not to configure the ESLint `parserOptions.project` option. We do not do this by default for lint performance reasons. | `false` |
| `--skipFormat` | boolean | Skip formatting files. | `false` |
| `--skipPackageJson` | boolean | Do not add dependencies to `package.json`. | `false` |
| `--style` | string | The file extension to be used for style files. | `"css"` |
| `--tags` | string | Add tags to the application (used for linting). |  |
| `--unitTestRunner` | string | Test runner to use for unit tests. | `"none"` |
| `--useAppDir` | boolean | Use Nuxt 4 app/ directory structure instead of src/ directory. Defaults to true for Nuxt v4, false for Nuxt v3. |  |
| `--useProjectJson` | boolean | Use a `project.json` configuration file instead of inlining the Nx configuration in the `package.json` file. |  |

## `storybook-configuration`
Set up Storybook for a Nuxt project.

This generator calls the `@nx/vue:storybook-configuration` generator under the hood. It will set up Storybook for your **Nuxt** project.

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
nx g @nx/nuxt:storybook-configuration ui
```

This will generate Storybook configuration for the `ui` project using TypeScript for the Storybook configuration files (the files inside the `.storybook` directory, eg. `.storybook/main.ts`).

#### Ignore certain paths when generating stories

```bash
nx g @nx/nuxt:storybook-configuration ui --generateStories=true --ignorePaths="libs/ui/src/not-stories/**,**/**/src/**/*.other.*,apps/my-app/**/*.something.ts"
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
nx g @nx/nuxt:storybook-configuration ui --generateStories=true --js=true
```

This will generate stories for all the components in the `ui` project using JavaScript instead of TypeScript. So, you will have `.stories.js` files next to your components.

#### Generate Storybook configuration using JavaScript

```bash
nx g @nx/nuxt:storybook-configuration ui --tsConfiguration=false
```

By default, our generator generates TypeScript Storybook configuration files. You can choose to use JavaScript for the Storybook configuration files of your project (the files inside the `.storybook` directory, eg. `.storybook/main.js`).

**Usage:**
```bash
nx generate @nx/nuxt:storybook-configuration [options]
```

**Arguments:**
```bash
nx generate @nx/nuxt:storybook-configuration <project> [options]
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
nx generate @nx/nuxt:<generator> --help
```

---
title: 'Create Your Own create-react-app CLI'
slug: 'create-your-own-create-react-app-cli'
authors: ['Emily Xiong']
cover_image: '/blog/images/2023-08-10/1*j2QU-hjxt-1krFST8CGFiA.png'
tags: [nx]
---

Most technologies have a CLI to create a new workspace. In fact, it is so prevalent that NPM and other package managers support it natively. For example:

- Nx has [create-nx-workspace](/getting-started/installation)
- React has, well, had [create-react-app](https://create-react-app.dev/)
- Angular has [Angular CLI](https://angular.io/cli)
- Vite has [create-vite](https://vitejs.dev/guide/#scaffolding-your-first-vite-project)

Having a CLI to quickly scaffold a starting project is great for onboarding new people, but it can also be a burden for framework authors as they want to rather focus on building the framework. Additionally, building **and supporting** a good CLI is another beast to tackle. And this is where Nx comes in.

Nx has had support for [creating custom “presets”](/extending-nx/recipes/create-preset) for a while, allowing plugin authors to fully customize the workspace structure from the ground up. To use them you had to go via the `create-nx-workspace` command though, passing the name of your plugin as the `--preset` . This works, but you might want to have a more “branded command” experience, like `npx create-my-own-app` .

And this is exactly what we’re going to explore in this article. We will write our own CLI. And out of nostalgia, let’s build our own version of Create-React-App.

If you want to check out the final result, here’s the corresponding Github repo: [https://github.com/nrwl/nx-recipes/tree/main/nx-devkit-create-own-cli](https://github.com/nrwl/nx-recipes/tree/main/nx-devkit-create-own-cli)

**Prefer a video? We got you covered!**

{% youtube src="https://www.youtube.com/watch?v=ocllb5KEXZk" /%}

## What is Nx and what is an Nx plugin?

But before we jump right into the topic, what is Nx? And more specifically, what are Nx Plugins?

Nx is an open-source build system that provides tools and techniques to enhance developer productivity. [Check out this 10 min video overview](https://youtu.be/-_4WMl-Fn0w) of Nx if you want to learn more.

Our example, in particular, uses Nx as a dev tool for creating a CLI and plugin. Nx plugins are npm packages that provide integrations between Nx and other technologies. You can use Nx without them, but they can provide great value if applied properly. `my-own-react` is the plugin to integrate React and Nx.

## Step 1: Create a CLI workspace

Create a new Nx workspace that is preconfigured for plugin development, using the below command:

```shell
npx create-nx-plugin my-own-react --create-package-name=create-my-own-react-app
```

Note, if you already have an existing Nx plugin workspace, instead of creating a new workspace, you can simply run the following in your plugin repository to generate the create CLI:

```
nx g @nx/plugin:create-package <cli name> --project=<existing plugin name> --e2eProject e2e
```

![](/blog/images/2023-08-10/1*dL5XHPOGCtfFyTHhloaYcQ.avif)
_Project graph of the workspace_

The resulting workspace contains 2 projects: a CLI and an Nx plugin.

- **create-my-own-react-app:** The CLI project. It contains the code to run when developers invoke `npx create-my-own-react-app`. This will set up a workspace for the developer.
- **my-own-react:** Nx plugin to integrate react with Nx. It will contain the code for creating and serving an app. It is under the src folder. This will be installed in the user’s workspace.

### CLI Package Structure

Let’s focus on the `create-my-own-react-app` project which is our CLI.

![](/blog/images/2023-08-10/1*00F7H_Z13uonZiflZSQd8Q.avif)

The `index.ts` file is the key part here. It is the one that gets invoked when someone runs `npx create-my-own-react-app` later once we publish it.

```

#!/usr/bin/env node

import { createWorkspace } from 'create-nx-workspace';

async function main() {
 const name = process.argv\[2\]; // TODO: use libraries like yargs or enquirer to set your workspace name
 if (!name) {
 throw new Error('Please provide a name for the workspace');
 }

console.log(`Creating the workspace: ${name}`);

// This assumes "my-own-react" and "create-my-own-react-app" are at the same version
 // eslint-disable-next-line @typescript-eslint/no-var-requires
 const presetVersion = require('../package.json').version;

// TODO: update below to customize the workspace
 const { directory } = await createWorkspace(`my-own-react@${presetVersion}`, {
 name,
 nxCloud: false,
 packageManager: 'npm',
 });

console.log(`Successfully created the workspace: ${directory}.`);
}

main();

```

The main chunk of code is `` createWorkspace(`my-own-react@${presetVersion}`) ``. This function creates an Nx workspace with the `my-own-react` plugin installed.

2. `createWorkspace` will also generate the preset generator defined by `my-own-react` located at `src/generators/preset/generator.ts`. This is the logic which scaffolds a project which uses your technology.

## Step 2: Run the CLI Locally

To properly test your CLI you can either publish it to NPM as a beta version or use a local npm registry like [Verdaccio](https://verdaccio.org/). Luckily our Nx workspace already comes with a feature to make that a seamless process.

1.  First, start a local Verdaccio-based npm registry using the following command:

```shell
npx nx local-registry
```

This will start the local registry on port 4873 and configure npm to use it instead of the real npm registry.

2\. In the second terminal, run the command to publish all the projects:

```shell
npx nx run-many --targets publish --ver 1.0.0 --tag latest
```

_(Note,_ `_publish_` _is a target defined in the_ `_project.json_` _of our projects.)_

This command will publish both `my-own-react` and `create-my-own-react-app` packages to your local registry. If open the running Verdaccio registry at [http://localhost:4873](http://localhost:4873) you should see the published packages.

![](/blog/images/2023-08-10/1*_D72hvW4nrl_DSYyMQU0DQ.avif)

3\. Now, you can run `npx create-my-own-react-app` just like a developer using our CLI would. For example, go to the tmp directory and create a `my-own-react` workspace named `test`:

```shell
cd tmp
npx create-my-own-react-app@1.0.0 test
```

What you’ll get is an Nx workspace with the base setup and a `test` library project with a single TS file. Because that’s exactly what our current `preset` generator does.

![](/blog/images/2023-08-10/1*v70qP_BS6LJm3NMAYkv2KQ.avif)

Let’s fix that in the next step.

### Step 3: Change the CLI to Setup a React App

In this step, we dive a bit more into the actual Nx plugin development to create our CRA replica.

We’ll go rather quickly but if you want a slower walkthrough you might be interested in this video that leverages a generator for automating the creation of projects. Exactly what we’re going to do in our preset now.

{% youtube src="https://youtu.be/myqfGDWC2go" /%}

To do this, we will fill in the preset generator under `src/generators/preset`

A generator is a function that makes modifications to a file system representation known as the `Tree`. These modifications will then be applied to the real file system. In our case, the preset generator will create the files for a React app.

Currently, the file at `src/generators/preset/generator.ts` looks like:

```
import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  Tree,
} from '@nx/devkit';
import * as path from 'path';
import { PresetGeneratorSchema } from './schema';

export async function presetGenerator(
  tree: Tree,
  options: PresetGeneratorSchema
) {
  const projectRoot = `libs/${options.name}`;
  addProjectConfiguration(tree, options.name, {
    root: projectRoot,
    projectType: 'library',
    sourceRoot: `${projectRoot}/src`,
    targets: {},
  });
  generateFiles(tree, path.join(__dirname, 'files'), projectRoot, options);
  await formatFiles(tree);
}

export default presetGenerator;
```

The preset generator does 2 things:

- Create an Nx project using the`addProjectConfiguration` function. This creates a `project.json` file which allows Nx to run commands on it.
- Generates files in the project using the`generateFiles` function. This uses the templates under `src/generators/preset/files` which are interpolated to become the files that are generated for the user.
- Format the generated files with `prettier` with the`formatFiles` function

![](/blog/images/2023-08-10/1*38RvkLIwUAvVDDrEp5sFPQ.avif)
_preset generator_

The `addProjectConfiguration` and `generateFiles` functions are from [@nx/devkit](/nx-api/devkit/documents/nx_devkit), a library that contains utility functions for writing plugins for Nx. For the future, see the [complete list of utility functions](/nx-api/devkit/documents/nx_devkit).

1.  Change the project which is created with `addProjectConfiguration`:

```
const projectRoot = '.';
addProjectConfiguration(tree, options.name, {
  root: projectRoot,
  projectType: 'application',
  targets: {}
});
```

- The `projectRoot` will be ‘.’, the root of a workspace
- The `projectType` changes to `application`

2\. Next, change the files generated into the project under `src/generators/preset/files`. We will use the same template as `create-react-app` .

Rename the existing `index.ts.template` to `src/generators/preset/files/src/index.tsx.template` and add the following content:

```
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
     <div className="App">
      <header className="App-header">
        <svg className="App-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 841.9 595.3"><g fill="#61DAFB"><path d="M666.3 296.5c0-32.5-40.7-63.3-103.1-82.4 14.4-63.6 8-114.2-20.2-130.4-6.5-3.8-14.1-5.6-22.4-5.6v22.3c4.6 0 8.3.9 11.4 2.6 13.6 7.8 19.5 37.5 14.9 75.7-1.1 9.4-2.9 19.3-5.1 29.4-19.6-4.8-41-8.5-63.5-10.9-13.5-18.5-27.5-35.3-41.6-50 32.6-30.3 63.2-46.9 84-46.9V78c-27.5 0-63.5 19.6-99.9 53.6-36.4-33.8-72.4-53.2-99.9-53.2v22.3c20.7 0 51.4 16.5 84 46.6-14 14.7-28 31.4-41.3 49.9-22.6 2.4-44 6.1-63.6 11-2.3-10-4-19.7-5.2-29-4.7-38.2 1.1-67.9 14.6-75.8 3-1.8 6.9-2.6 11.5-2.6V78.5c-8.4 0-16 1.8-22.6 5.6-28.1 16.2-34.4 66.7-19.9 130.1-62.2 19.2-102.7 49.9-102.7 82.3 0 32.5 40.7 63.3 103.1 82.4-14.4 63.6-8 114.2 20.2 130.4 6.5 3.8 14.1 5.6 22.5 5.6 27.5 0 63.5-19.6 99.9-53.6 36.4 33.8 72.4 53.2 99.9 53.2 8.4 0 16-1.8 22.6-5.6 28.1-16.2 34.4-66.7 19.9-130.1 62-19.1 102.5-49.9 102.5-82.3zm-130.2-66.7c-3.7 12.9-8.3 26.2-13.5 39.5-4.1-8-8.4-16-13.1-24-4.6-8-9.5-15.8-14.4-23.4 14.2 2.1 27.9 4.7 41 7.9zm-45.8 106.5c-7.8 13.5-15.8 26.3-24.1 38.2-14.9 1.3-30 2-45.2 2-15.1 0-30.2-.7-45-1.9-8.3-11.9-16.4-24.6-24.2-38-7.6-13.1-14.5-26.4-20.8-39.8 6.2-13.4 13.2-26.8 20.7-39.9 7.8-13.5 15.8-26.3 24.1-38.2 14.9-1.3 30-2 45.2-2 15.1 0 30.2.7 45 1.9 8.3 11.9 16.4 24.6 24.2 38 7.6 13.1 14.5 26.4 20.8 39.8-6.3 13.4-13.2 26.8-20.7 39.9zm32.3-13c5.4 13.4 10 26.8 13.8 39.8-13.1 3.2-26.9 5.9-41.2 8 4.9-7.7 9.8-15.6 14.4-23.7 4.6-8 8.9-16.1 13-24.1zM421.2 430c-9.3-9.6-18.6-20.3-27.8-32 9 .4 18.2.7 27.5.7 9.4 0 18.7-.2 27.8-.7-9 11.7-18.3 22.4-27.5 32zm-74.4-58.9c-14.2-2.1-27.9-4.7-41-7.9 3.7-12.9 8.3-26.2 13.5-39.5 4.1 8 8.4 16 13.1 24 4.7 8 9.5 15.8 14.4 23.4zM420.7 163c9.3 9.6 18.6 20.3 27.8 32-9-.4-18.2-.7-27.5-.7-9.4 0-18.7.2-27.8.7 9-11.7 18.3-22.4 27.5-32zm-74 58.9c-4.9 7.7-9.8 15.6-14.4 23.7-4.6 8-8.9 16-13 24-5.4-13.4-10-26.8-13.8-39.8 13.1-3.1 26.9-5.8 41.2-7.9zm-90.5 125.2c-35.4-15.1-58.3-34.9-58.3-50.6 0-15.7 22.9-35.6 58.3-50.6 8.6-3.7 18-7 27.7-10.1 5.7 19.6 13.2 40 22.5 60.9-9.2 20.8-16.6 41.1-22.2 60.6-9.9-3.1-19.3-6.5-28-10.2zM310 490c-13.6-7.8-19.5-37.5-14.9-75.7 1.1-9.4 2.9-19.3 5.1-29.4 19.6 4.8 41 8.5 63.5 10.9 13.5 18.5 27.5 35.3 41.6 50-32.6 30.3-63.2 46.9-84 46.9-4.5-.1-8.3-1-11.3-2.7zm237.2-76.2c4.7 38.2-1.1 67.9-14.6 75.8-3 1.8-6.9 2.6-11.5 2.6-20.7 0-51.4-16.5-84-46.6 14-14.7 28-31.4 41.3-49.9 22.6-2.4 44-6.1 63.6-11 2.3 10.1 4.1 19.8 5.2 29.1zm38.5-66.7c-8.6 3.7-18 7-27.7 10.1-5.7-19.6-13.2-40-22.5-60.9 9.2-20.8 16.6-41.1 22.2-60.6 9.9 3.1 19.3 6.5 28.1 10.2 35.4 15.1 58.3 34.9 58.3 50.6-.1 15.7-23 35.6-58.4 50.6zM320.8 78.4z"/><circle cx="420.9" cy="296.5" r="45.7"/><path d="M520.5 78.1z"/></g></svg>
        <p>
          Welcome <%= name %>!
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  </React.StrictMode>
);
```

Add another file to generate a CSS template at `src/generators/preset/files/src/index.css.template`:

```
.App {
  text-align: center;
}

.App-logo {
  height: 40vmin;
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  .App-logo {
    animation: App-logo-spin infinite 20s linear;
  }
}

.App-header {
  background-color: #282c34;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
  color: white;
}

.App-link {
  color: #61dafb;
}

@keyframes App-logo-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
```

And finally, another file to host the actual HTML template: `src/generators/preset/files/public/index.html.template`:

```shell
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="Web site created using create-react-app"
    />
    <title>React App</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <!--
      This HTML file is a template.
      If you open it directly in the browser, you will see an empty page.
      You can add webfonts, meta tags, or analytics to this file.
      The build step will place the bundled scripts into the <body> tag.
      To begin the development, run `npm start` or `yarn start`.
      To create a production bundle, use `npm run build` or `yarn build`.
    -->
  </body>
</html>
```

3\. Our application uses some npm dependencies so add those to the workspace as well with the [addDependenciesToPackageJson](/nx-api/devkit/documents/nx_devkit) function to the end of the export default function in `src/generators/preset/generator.ts`:

```
import {
  addDependenciesToPackageJson,
  ...
} from '@nx/devkit';
...

export default async function (tree: Tree, options: PresetGeneratorSchema) {
  ...
  return addDependenciesToPackageJson(
    tree,
    {
      react: 'latest',
      'react-dom': 'latest',
      'react-scripts': 'latest',
    },
    {
      "@types/react": "latest",
      "@types/react-dom": "latest",
    }
  );
}
```

This line will add the latest `react`, `react-dom`, `react-scripts`, and their types to the `package.json` in the generated workspace.

### Final Preset Generator

Now `src/generators/preset/generator.ts` should look like this:

```
import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  Tree,
} from '@nx/devkit';
import * as path from 'path';
import { PresetGeneratorSchema } from './schema';

export default async function (tree: Tree, options: PresetGeneratorSchema) {
  const projectRoot = `.`;

  addProjectConfiguration(tree, options.name, {
    root: projectRoot,
    projectType: 'application',
    targets: {},
  });

  generateFiles(tree, path.join(__dirname, 'files'), projectRoot, options);
  await formatFiles(tree);

  return addDependenciesToPackageJson(
    tree,
    {
      react: 'latest',
      'react-dom': 'latest',
      'react-scripts': 'latest',
    },
    {
      "@types/react": "latest",
      "@types/react-dom": "latest",
    }
  );
}
```

## Step 4: Run the New Version that Creates the React App

Now you can publish a new version of `my-own-react` and `create-my-own-react-app` and run it again:

```shell
cd ..
npx nx run-many --targets publish --ver 1.0.1 --tag latest
cd tmp
npx create-my-own-react-app@1.0.1 test2
```

The CLI now creates a workspace with the dependencies we want and the code for the react application just like `create-react-app`:

![](/blog/images/2023-08-10/1*gZ7ocdR49soEahM8TlGA4A.avif)

## Step 5: Add a Serve Target

The workspace setup is done, what we’re missing though is a way to easily serve our app. To stick to what CRA does we simply need to run `react-scripts start` , but ideally, we want to make that more convenient for the developer by pre-generating that script into the workspace.

We have two possibilities:

- add the script to the root-level`package.json` using the `updateJson` function exposed by `@nx/devkit`
- add a target to the `project.json` using the `addProjectConfiguration` function exposed by `@nx/devkit`

Nx can use both. The `project.json` is Nx’s variant of a more evolved package.json scripts declaration, that allows to specify metadata in a structured way.

To keep things simple, let’s just generate a new script for the root-level `package.json`. We need to modify our `src/generators/preset/generator.ts` as follows:

```shell
import {
  updateJson,
  ...
} from '@nx/devkit';
...

export default async function (tree: Tree, options: PresetGeneratorSchema) {
  ...
  addProjectConfiguration(...);

  updateJson(tree, 'package.json', (json) => {
    json.scripts = json.scripts || {};

    // generate a start script into the package.json
    json.scripts.start = 'npx react-scripts start';
    return json;
  });

  ...
}
```

Note, we want to keep our `project.json` file even though it doesn’t have any targets defined. That way Nx recognizes it as a proper project and applies caching and other optimization strategies.

### Adding the target to the `project.json` rather than `package.json`

Alternatively, we could have adjusted the already present `addProjectConfiguration` function to add the `react-scripts` command:

```shell
import {
  ...
  addProjectConfiguration,
  ...
} from '@nx/devkit';
...

export default async function (tree: Tree, options: PresetGeneratorSchema) {
  ...

  addProjectConfiguration(tree, options.name, {
    root: projectRoot,
    projectType: 'application',
    targets: {
      serve: {
        command: "npx react-scripts start",
      }
    },
  });

  ...
}
```

## Step 6: Run it Again to Get a React App That Can Be Served

To test our changes, let’s publish a new version and run it again.

```shell
npx nx run-many --targets publish --ver 1.0.2 --tag latest
```

Once we generate a new workspace with the new preset version (npx create-my-own-react-app@1.0.2 test3), we should now see our `package.json` `start`script being generated.

![](/blog/images/2023-08-10/1*Rb6xWqUiK51DsZsAGdtNbQ.avif)

To run the app we either run

- `npm start`
- or `npx nx start` which would automatically pick up the `start` script in the `package.json`

![](/blog/images/2023-08-10/1*qVf6zEOndAgYkIRgZxTYZA.avif)
![](/blog/images/2023-08-10/1*K7YZDNyIWp0Bu9tLl5VixA.avif)
_serve output_

## Step 7: Add a Prompt to the CLI to Customize the Starter App

Now, you have a CLI that creates a workspace that users can use to get started with React. But that’s not all. Let’s take it a step further and make it interactive by adding a prompt that can let different users customize the kind of workspace that they want to create.

Take a look at the CLI code at `create-my-own-react-package/bin/index.ts`, you will notice it is pretty barebone. It reads the`name` from the command’s arguments.

You can use libraries like [enquirer](https://github.com/enquirer/enquirer) (or even fancier ones like [Clack](https://www.npmjs.com/package/@clack/prompts)) to prompt developers for options. For this example, prompt developers to select a light or dark theme for the starter app.

1.  Install `enquirer` with `npm i enquirer`
2.  Change `create-my-own-react-package/bin/index.ts` to import `enquirer` and prompt developers to enter the mode option:

```
#!/usr/bin/env node

import { createWorkspace } from 'create-nx-workspace';
import { prompt } from 'enquirer';

async function main() {
  let name = process.argv[2];
  if (!name) {
    const response = await prompt<{ name: string }>({
      type: 'input',
      name: 'name',
      message: 'What is the name of the workspace?',
    });
    name = response.name;
  }
  let mode = process.argv[3];
  if (!mode) {
    mode = (
      await prompt<{ mode: 'light' | 'dark' }>({
        name: 'mode',
        message: 'Which mode to use',
        initial: 'dark' as any,
        type: 'autocomplete',
        choices: [
          { name: 'light', message: 'light' },
          { name: 'dark', message: 'dark' },
        ],
      })
    ).mode;
  }

  console.log(`Creating the workspace: ${name}`);

  // This assumes "my-own-react" and "create-my-own-react-app" are at the same version
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const presetVersion = require('../package.json').version;

  // TODO: update below to customize the workspace
  const { directory } = await createWorkspace(`my-own-react@${presetVersion}`, {
    name,
    nxCloud: false,
    packageManager: 'npm',
    mode,
  });

  console.log(`Successfully created the workspace: ${directory}.`);
}

main();
```

You can assemble options for `createWorkspace`; however, you’d like and they will be passed to the `my-own-react` preset.

3\. Change `src/generators/preset` to accept this option and apply it.

In `src/generators/preset/schema.d.ts`, add it to the type for the options:

```
export interface PresetGeneratorSchema {
  name: string;
  mode: 'light' | 'dark';
}
```

Also, change the CSS for `.App-header` in the CSS template file`src/generators/preset/files/src/index.css.template`:

```
.App-header {
  background-color: <%= mode === 'dark' ? '#282c34' : 'white' %>;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
  color: <%= mode === 'dark' ? 'white' : '#282c34' %>;
}
```

Now if you republish the projects and regenerate an app with the light mode, you should see the background color and text color of the header got changed:

![](/blog/images/2023-08-10/1*tifthl0LFTk1i3PcZWUo_A.avif)
![](/blog/images/2023-08-10/1*ruXAwt1cxeZsdN2AkZqPzA.avif)
_serve output_

## Step 8: E2E Testing

This is how users start using your technology so you should write e2e tests to ensure this does not break. This workspace was also generated with a testing file `packages/my-own-react-e2e/tests/create-my-own-react-app.spec.ts`.

You can modify this e2e test to test your CLI. Then, run it using the command `npx nx e2e my-own-react-e2e`. Before the tests run, as a global setup, a local registry is started and the packages are published.

The default test works like this:

1.  Creates a test workspace at `tmp/`using the `create-my-own-react-app` CLI
2.  Runs `npm ls my-own-react` to validate that the plugin is installed in the test workspace
3.  Cleans up the test workspace

Make sure `dark` is passed into `create-my-own-react-app` :

```
exec1-app ${projectName} dark`, {
  cwd: dirname(projectDirectory),
  stdio: 'inherit',
});
```

Add to a test to check `react` and `react-dom` are installed:

```
 it('react and react-dom should be installed', () => {
    projectDirectory = createTestProject('dark');

    // npm ls will fail if the package is not installed properly
    execSync('npm ls react', {
      cwd: projectDirectory,
      stdio: 'inherit',
    });
    execSync('npm ls react-dom', {
      cwd: projectDirectory,
      stdio: 'inherit',
    });
  });
```

## Recap and next steps

Recap:

- We learned about what an Nx Plugin is and generated a new plugin workspace
- We generated a new CLI package into the workspace: `create-my-own-react-app` . This allows our users to easily scaffold a new workspace
- We adjusted the preset generator to setup a CRA-like React setup
- We wrote some e2e tests to ensure that things do not break

This should give you a good insight into how to get started. But there’s more to explore:

- We could provide more [generators](/plugins/recipes/local-generators\) to our users that help with setting up new components, adding unit tests, configuring the React Router etc.
- Add a generator to add other Nx plugins such as Jest, ESLint, or Cypress
- We could also include “[executors](/extending-nx/recipes/local-executors)”, which are wrappers around tasks to abstract the lower-level details of it
- etc.

Now clearly this was a simple example of how you could build your own CRA using Nx. If you want to see a real-world React setup powered by Nx, check out our React Tutorial: [/getting-started/tutorials/react-standalone-tutorial](/getting-started/tutorials/react-standalone-tutorial)

## Learn more

- 🧠 [Nx Docs](/getting-started/intro)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- 🚀 [Speed up your CI](/nx-cloud)

---
title: 'Server-side rendering (SSR) with Angular for Nx workspaces'
slug: 'server-side-rendering-ssr-with-angular-for-nx-workspaces'
authors: ['Benjamin Cabanes']
cover_image: '/blog/images/2022-03-14/1*eOsf4SjQilvuMClPC0Isyw.png'
tags: [nx]
---

Nx is a Smart, Fast and Extensible Build System, which we developed at [Nrwl](/company) based on our experience working at Google, and helping Fortune 500 enterprises build ambitious Angular applications.

_Small heads up! This article is about SSR, Nx and Angular. If you are looking for a way to implement SSR with React, Nx has first-class Next.js support. Next.js is a framework to build server-rendered applications, static websites, and more using React._ [_Read more about Nx’s Next.js support here_](/nx-api/next)_._

**In this article, we will manually add the SSR feature to our Angular application in an Nx workspace.**

This article is not about SSR per sé and assumes you are familiar with the concept as well as with [Angular](https://angular.io) and Nx. If you are not sure, please read about it on the official Angular documentation: [https://angular.io/guide/universal](https://angular.io/guide/universal).

## Hands on

### Creating our Nx Workspace

First things first, let’s create our Nx workspace and having it generate our Angular application at the same time using the Angular preset `--preset=angular.`

```shell
yarn create nx-workspace happynrwl --preset=angular --appName=tuskdesk
```

Once done, we will be able to check everything is working by running: `yarn start`, we should see the welcome page from Nx.

![](/blog/images/2022-03-14/1*hJpbF0NwLQgKc8cDM1GW0Q.avif)
_Nx Welcome page_

### SSR setup

The gist of enabling SSR for an Angular app can be sum up by having 3 (three) targets:

- `build` target building the application (already have this by default)
- `server` target building the \`main.server.ts\` containing our Angular Platform Server
- `serve-ssr` target which is a combination of the two (2) but serves the application in developer mode

To achieve this, we will use the [@schematics/angular](https://www.npmjs.com/package/@schematics/angular) and the [@universal package](https://github.com/angular/universal), both maintained by the Angular team.

### Adding the Angular Universal dependencies

We will use Angular Universal’s executors & builders, we need to be sure to have these packages in our workspace as dependencies.

```shell
yarn add [@nguniversal/express-engine](http://twitter.com/nguniversal/express-engine)
```

And then:

```shell
yarn add --dev [@nguniversal/builders](http://twitter.com/nguniversal/builders)
```

### Initializing with the universal schematic

Let’s use the Angular Universal schematic to initialize our SSR setup for the `tuskdesk` application by running the following in the terminal:

```shell
yarn nx generate [@schematics/angular](http://twitter.com/schematics/angular):universal --project=tuskdesk
```

We need to amend the `outputPath` option of the generated `build` target to `"outputPath": "dist/apps/tuskdesk/browser"`.

After running this command, you should have 3 new files:

```
apps/tuskdesk/src/app/app.server.module.ts // ng app module for SSR
apps/tuskdesk/src/main.server.ts // app’s entry point for SSR
apps/tuskdesk/tsconfig.server.json // tsconfig for SSR
```

We also should have `apps/tuskdesk/project.json` updated with the `server` target.

Since our Nx workspace has an architecture a little bit different from the AngularCLI and we want to keep things simple, we will make few adjustments.

### Adding SSR server files

We need to add the node server using express that will handle our requests to actually do the server-side rendering.

To create this file, run the following in a terminal:

```
touch apps/tuskdesk/src/ssr.server.ts
```

Open and paste the following code:

The code is mostly [the same as the original here](https://github.com/angular/universal/blob/master/modules/express-engine/schematics/install/files/__serverFileName%40stripTsExtension__.ts), we are mainly updating the paths to match our workspace architecture.

We also need to update our `tsconfig.server.json` to handle the `ssr.server.ts` we just created:

```json
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "outDir": "../../out-tsc/server",
    "target": "es2019",
    "types": ["node"]
  },
  "files": ["src/main.server.ts", "src/ssr.server.ts"],
  "angularCompilerOptions": {
    "entryModule": "./src/app/app.server.module#AppServerModule"
  }
}
```

Note the addition of the `src/ssr.server.ts` on the `files` property.

### Adding project targets

At this point, we have already one of the 3 needed targets, the `build` is done and working. We need to have `server` and `serve-ssr` to complete the job.

Open the `apps/tuskdesk/project.json` and replace the existing `server` target with the following:

```
"server": {
  "executor": "[@angular](http://twitter.com/angular)-devkit/build-angular:server",
  "options": {
    "outputPath": "dist/apps/tuskdesk/server",
    "main": "apps/tuskdesk/src/ssr.server.ts",
    "tsConfig": "apps/tuskdesk/tsconfig.server.json"
  },
  "configurations": {
    "production": {
      "outputHashing": "media",
      "fileReplacements": [
        {
          "replace": "apps/tuskdesk/src/environments/environment.ts",
          "with": "apps/tuskdesk/src/environments/environment.prod.ts"
        }
      ]
    },
    "development": {
      "optimization": false,
      "sourceMap": true,
      "extractLicenses": false
    }
  },
  "defaultConfiguration": "production"
},
```

Then we need to add the ability to serve our SSR application, let’s add the `serve-ssr` target:

```
"serve-ssr": {
  "executor": "[@nguniversal/builders](http://twitter.com/nguniversal/builders):ssr-dev-server",
  "configurations": {
    "development": {
      "browserTarget": "tuskdesk:build:development",
      "serverTarget": "tuskdesk:server:development"
    },
    "production": {
      "browserTarget": "tuskdesk:build:production",
      "serverTarget": "tuskdesk:server:production"
    }
  },
  "defaultConfiguration": "development"
}
```

**We are using the official executors (or builders) from the Angular Universal package. This is possible because Nx support Angular as a first class citizen!**

> Nx does not get in the way when using official schematics and builders, it uses them seamlessly. Using Nx gives you the best developer experience for your Angular project.

We have effectively created all the targets we needed to enable SSR for our Angular application in our Nx workspace. _Let’s test everything!_

### Serve the application with SSR

To run the application in SSR mode, we need to run the `serve-ssr` target:

```shell
yarn nx run tuskdesk:serve-ssr
```

Let’s try it, load the application on the [http://localhost:4200](http://localhost:4200) and deactivate JavaScript in the browser’s options.

![](/blog/images/2022-03-14/1*tVi2fRPw3IA4rjmKI4LVmw.avif)
_Angular app with SSR setup in Nx workspace_

## What we learned

In this article we learned how to add SSR capabilities to an Angular application in an Nx workspace, using the official Angular universal packages, executors and generators.

We have seen:

- How to use Nx to generate the workspace with an Angular application ready to serve
- How we can use existing generators/schematics and their executors/builders from Angular
- Setup our SSR node server that handle the rendering of our Angular application
- How seamless the Nx experience is when using official Angular schematics & builders.

Some useful links:

- Angular Universal guide (official) [https://angular.io/guide/universal](https://angular.io/guide/universal)
- Angular Universal Github repository (official) [https://github.com/angular/universal](https://github.com/angular/universal)

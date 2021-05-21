# Migrating an AngularJS Project into an Nx Workspace

Nx offers first-class support for Angular and React out-of-the-box. But one of the questions the Nrwl team often hears from our community is how to use AngularJS (Angular 1.x) in Nx. Nx is a great choice for managing an AngularJS to Angular upgrade, or just for consolidating your existing polyrepo approach to AngularJS into a monorepo to make maintenance a little easier.

In this article, you’ll learn how to:

- Create an Nx workspace for an AngularJS application
- Migrate an AngularJS application into your Nx workspace
- Convert an existing build process for use in Nx
- Use Webpack to build an AngularJS application
- Run unit and end-to-end tests

For this example, you’ll be migrating the [Real World AngularJS](https://github.com/gothinkster/angularjs-realworld-example-app) application from [Thinkster.io](https://thinkster.io/). You should clone this repo so you have access to the code before beginning.

There is also a [repo](https://github.com/nrwl/nx-migrate-angularjs-example) that shows a completed example of this guide.

> The RealWorld app is a great example of an AngularJS app, but it probably doesn’t have the complexity of your own codebase. As you go along, I’ll include some recommendations on how you might apply this example to your larger, more complex application.

## Creating your workspace

To start migrating the Real World app, create an Nx workspace:

```bash
npx create-nx-workspace@latest nx-migrate-angularjs
```

When prompted choose the `empty` preset. The other presets use certain recommended defaults for the workspace configuration. Because you have existing code with specific requirements for configuration, starting with a blank workspace avoids resetting these defaults. This will give you the ability to customize the workspace for the incoming code.

At the next prompt, choose `Angular CLI` for your workspace CLI. While you may not be using Angular now, this gives you the best option to upgrade to Angular later. The Angular CLI is also the best CLI option for using Karma and Protractor, the two testing suites most commonly used for AngularJS.

```bash
? What to create in the new workspace empty             [an empty workspace]
? CLI to power the Nx workspace       Angular CLI  [Extensible CLI for Angular applications. Recommended for Angular projects.]
```

## Creating your app

Your new workspace won’t have much in it because of the `empty` preset. You’ll need to generate an application to have some structure created. Add the Angular capability to your workspace:

```bash
ng add @nrwl/angular
```

When prompted, make a choice of unit test runner and e2e test runner:

```bash
? Which Unit Test Runner would you like to use for the application? Karma [ https://karma-runner.github.io ]
? Which E2E Test Runner would you like to use? Protractor [ https://www.protractortest.org ]
```

For this example, we will use Karma and Protractor, the most common unit test runner and e2e test runner for AngularJS.

> Codebases with existing unit and e2e tests should continue to use whatever runner they need. We’ve chosen Karma and Protractor here because it’s the most common. If you’re going to be adding unit testing or e2e as part of this transition and are starting fresh, we recommend starting with Jest and Cypress.

With the Angular capability added, generate your application:

```bash
ng generate @nrwl/angular:application --name=realworld
```

Accept the default options for each prompt:

```bash
? Which stylesheet format would you like to use? CSS
? Would you like to configure routing for this application? No
```

> The RealWorld app doesn’t have any styles to actually bundle here. They’re all downloaded from a CDN that all of the RealWorld apps use. If your codebase uses something other than CSS, like Sass or PostCSS, you can choose that here.

## Migrating dependencies

Copy the dependencies from the RealWorld app’s `package.json` to the `package.json` in your workspace. Split the existing dependencies into `dependencies` (application libraries) and `devDependencies` (build and test libraries). Everything related to gulp can go into `devDependencies`.

Your `package.json` should now look like this:

```json
{
  "name": "nx-migrate-angularjs",
  "version": "0.0.0",
  "license": "MIT",
  "scripts": {
    "ng": "ng",
    "nx": "nx",
    "start": "ng serve",
    "build": "ng build",
    "test": "ng test",
    "lint": "nx workspace-lint && ng lint",
    "e2e": "ng e2e",
    "affected:apps": "nx affected:apps",
    "affected:libs": "nx affected:libs",
    "affected:build": "nx affected:build",
    "affected:e2e": "nx affected:e2e",
    "affected:test": "nx affected:test",
    "affected:lint": "nx affected:lint",
    "affected:dep-graph": "nx affected:dep-graph",
    "affected": "nx affected",
    "format": "nx format:write",
    "format:write": "nx format:write",
    "format:check": "nx format:check",
    "update": "ng update @nrwl/workspace",
    "workspace-generator": "nx workspace-generator",
    "dep-graph": "nx dep-graph",
    "help": "nx help",
    "postinstall": "ngcc --properties es2015 browser module main --first-only --create-ivy-entry-points"
  },
  "private": true,
  "dependencies": {
    "@nrwl/angular": "^9.0.4",
    "@angular/animations": "9.0.0",
    "@angular/common": "9.0.0",
    "@angular/compiler": "9.0.0",
    "@angular/core": "9.0.0",
    "@angular/forms": "9.0.0",
    "@angular/platform-browser": "9.0.0",
    "@angular/platform-browser-dynamic": "9.0.0",
    "@angular/router": "9.0.0",
    "angular": "^1.5.0-rc.2",
    "angular-ui-router": "^0.4.2",
    "core-js": "^2.5.4",
    "rxjs": "~6.5.0",
    "zone.js": "^0.10.2"
  },
  "devDependencies": {
    "@angular/cli": "9.0.1",
    "@nrwl/workspace": "9.0.4",
    "@types/node": "~8.9.4",
    "dotenv": "6.2.0",
    "ts-node": "~7.0.0",
    "tslint": "~5.11.0",
    "eslint": "6.1.0",
    "typescript": "~3.7.4",
    "prettier": "1.18.2",
    "@angular/compiler-cli": "9.0.0",
    "@angular/language-service": "9.0.0",
    "@angular-devkit/build-angular": "0.900.1",
    "codelyzer": "~5.0.1",
    "karma": "~4.0.0",
    "karma-chrome-launcher": "~2.2.0",
    "karma-coverage-istanbul-reporter": "~2.0.1",
    "karma-jasmine": "~1.1.2",
    "karma-jasmine-html-reporter": "^0.2.2",
    "jasmine-core": "~2.99.1",
    "jasmine-spec-reporter": "~4.2.1",
    "@types/jasmine": "~2.8.8",
    "protractor": "~5.4.0",
    "@types/jasminewd2": "~2.0.3",
    "babel-preset-es2015": "^6.3.13",
    "babelify": "^7.2.0",
    "browser-sync": "^2.11.1",
    "browserify": "^13.0.0",
    "browserify-ngannotate": "^2.0.0",
    "gulp": "^3.9.1",
    "gulp-angular-templatecache": "^1.8.0",
    "gulp-notify": "^2.2.0",
    "gulp-rename": "^1.2.2",
    "gulp-uglify": "^1.5.3",
    "gulp-util": "^3.0.7",
    "marked": "^0.3.5",
    "merge-stream": "^1.0.0",
    "vinyl-source-stream": "^1.1.0"
  }
}
```

Run `npm install` to install all of your new dependencies.

> For your own project, you’ll need to switch to NPM if you’re using another package manager like bower. [Learn more about switching away from bower](https://bower.io/blog/2017/how-to-migrate-away-from-bower/)

## Migrating application code

This Angular application that you generated has the configuration that you need, but you don’t need any of its application code. You’ll replace that with the RealWorld app code. Delete the contents of `apps/realworld/src/app`.

Starting in the `js` folder of the realworld app, copy all of the application code into `apps/realworld/src/app`. The resulting file tree should look like this:

```text
apps
|____realworld-e2e
|____realworld
| |____src
| | |____index.html
| | |____app
| | | |____settings
| | | |____home
| | | |____config
| | | |____auth
| | | |____layout
| | | |____components
| | | |____profile
| | | |____article
| | | |____services
| | | |____editor
| | | |____app.js\
| | |____styles.css
| | |____environments
| | |____main.ts
| | |____test.ts
| | |____assets
```

> You most likely have your own AngularJS project written in JavaScript as well. While you’ll continue to use JavaScript through the rest of this example, we strongly recommend switching AngularJS projects to TypeScript, especially if you’re planning an upgrade to Angular.

## Modifying index.html and main.ts

Your generated application will also have an `index.html` provided. However, it’s set up for an Angular application, not an AngularJS application. Replace the contents of `apps/realworld/src/index.html` with the `index.html` from the RealWorld app.

Your application also has a `main.ts` file which is responsible for bootstrapping your app. Again, you don’t need much from this file any more. Replace its contents with:

```typescript
import ‘./app/app.js’;
```

And re-name it to `main.js`. This will import the existing app.js file from the RealWorld app which will bootstrap the app.

## Adding existing build and serve processes

If you’re looking at the example repo, the code for this section is available on branch `initial-migration`. This section is an interim step that continues to use gulp to build and serve the app locally. You’ll replace gulp in the next section. The RealWorld app uses gulp 3.9.1 to build. This version is not supported anymore and doesn’t run on any version of Node greater than 10.\*. To build this using gulp, you need to install an appropriate version of Node and make sure you re-install your dependencies. If this isn’t possible (or you just don’t want to), feel free to skip to the next section. The webpack build process should run in any modern Node version.

The RealWorld app uses gulp to build the application, as well as provide a development server. To verify that the migration has worked, stay with that build process for now.

> During migration, you should take a small step and confirm that things work before moving ahead. Stopping and checking to see that your app still builds and functions is essential to a successful migration.

Copy the `gulpfile.js` over from the RealWorld app and put it in `apps/realworld`. This is where all configuration files reside for the application. Make some adjustments to this file so that your build artifacts land in a different place. In an Nx workspace, all build artifacts should be sent to an app-specific folder in the `dist` folder at the root of your workspace. Your `gulpfile.js` should look like this:

```javascript
var gulp = require('gulp');
var notify = require('gulp-notify');
var source = require('vinyl-source-stream');
var browserify = require('browserify');
var babelify = require('babelify');
var ngAnnotate = require('browserify-ngannotate');
var browserSync = require('browser-sync').create();
var rename = require('gulp-rename');
var templateCache = require('gulp-angular-templatecache');
var uglify = require('gulp-uglify');
var merge = require('merge-stream');

// Where our files are located
var jsFiles = 'src/app/**/*.js';
var viewFiles = 'src/app/**/*.html';

var interceptErrors = function (error) {
  var args = Array.prototype.slice.call(arguments);

  // Send error to notification center with gulp-notify
  notify
    .onError({
      title: 'Compile Error',
      message: '<%= error.message %>',
    })
    .apply(this, args);

  // Keep gulp from hanging on this task
  this.emit('end');
};

gulp.task('browserify', ['views'], function () {
  return (
    browserify('./src/main.js')
      .transform(babelify, { presets: ['es2015'] })
      .transform(ngAnnotate)
      .bundle()
      .on('error', interceptErrors)
      //Pass desired output filename to vinyl-source-stream
      .pipe(source('main.js'))
      // Start piping stream to tasks!
      .pipe(gulp.dest('../../dist/apps/realworld/'))
  );
});

gulp.task('html', function () {
  return gulp
    .src('src/index.html')
    .on('error', interceptErrors)
    .pipe(gulp.dest('../../dist/apps/realworld/'));
});

gulp.task('views', function () {
  return gulp
    .src(viewFiles)
    .pipe(
      templateCache({
        standalone: true,
      })
    )
    .on('error', interceptErrors)
    .pipe(rename('app.templates.js'))
    .pipe(gulp.dest('src/app/config'));
});

// This task is used for building production ready
// minified JS/CSS files into the dist/ folder
gulp.task('build', ['html', 'browserify'], function () {
  var html = gulp
    .src('../../dist/apps/realworld/index.html')
    .pipe(gulp.dest('../../dist/apps/realworld/'));

  var js = gulp
    .src('../../dist/apps/realworld/main.js')
    .pipe(uglify())
    .pipe(gulp.dest('../../dist/apps/realworld/'));

  return merge(html, js);
});

gulp.task('default', ['html', 'browserify'], function () {
  browserSync.init(['../../dist/apps/realworld/**/**.**'], {
    server: '../../dist/apps/realworld',
    port: 4000,
    notify: false,
    ui: {
      port: 4001,
    },
  });

  gulp.watch('src/index.html', ['html']);
  gulp.watch(viewFiles, ['views']);
  gulp.watch(jsFiles, ['browserify']);
});
```

You need to point your `build` and `serve` tasks at this gulp build process. Typically, an Angular app is built using the Angular CLI, but the Angular CLI doesn’t know how to build AngularJS projects. All of your tasks are configured in the `angular.json` file. Find the `build` and `serve` tasks and replace them with this code block:

```json
...
        "build": {
          "builder": "@nrwl/workspace:run-commands",
          "options": {
            "commands": [
              {
                "command": "npx gulp --gulpfile apps/realworld/gulpfile.js build"
              }
            ]
          }
        },
        "serve": {
          "builder": "@nrwl/workspace:run-commands",
          "options": {
            "commands": [
              {
                "command": "npx gulp --gulpfile apps/realworld/gulpfile.js"
              }
            ]
          }
        },
...
```

This sets up the `build` and `serve` commands to use the locally installed version of gulp to run `build` and `serve`. To see the RealWorld app working, run

```bash
ng serve realworld
```

Navigate around the application and see that things work.

> Your own project might not be using gulp. If you’re using webpack, you can follow the next section and substitute your own webpack configuration. If you’re using something else like grunt or a home-grown solution, you can follow the same steps here to use it. You’ll use the `run-commands` builder and substitute in the commands for your project.

## Switching to webpack

So far, you’ve mostly gotten already existing code and processes to work. This is the best way to get started with any migration: get existing code to work before you start making changes. This gives you a good, stable base to build on. It also means you having working code now rather than hoping you’ll have working code in the future!

But migrating AngularJS code means we need to switch some of our tools to a more modern tool stack. Specifically, using webpack and babel is going to allow us to take advantage of Nx more easily. Becoming an expert in these build tools is outside the scope of this article, but I’ll address some AngularJS specific concerns. To get started, install a new dependency:

```bash
npm install babel-plugin-angularjs-annotate
```

Nx already has most of what you need for webpack added as a dependency. `babel-plugin-angularjs-annotate` is going to accomplish the same thing that `browserify-ngannotate` previously did in gulp: add dependency injection annotations.

Start with a `webpack.config.js` file in your application’s root directory:

```javascript
const path = require('path');

module.exports = (config, context) => {
  return {
    ...config,
    module: {
      strictExportPresence: true,
      rules: [
        {
          test: /\.html$/,
          use: [{ loader: 'raw-loader' }],
        },
        // Load js files through Babel
        {
          test: /\.(js|jsx)$/,
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['angularjs-annotate'],
          },
        },
      ],
    },
  };
};
```

> This webpack configuration is deliberately simplified for this tutorial. A real production-ready webpack config for your project will be much more involved. See [this project](https://github.com/preboot/angularjs-webpack) for an example.

To use webpack instead of gulp, go back to your `angular.json` file and modify the `build` and `serve` commands again:

```json
...
"build": {
  "builder": "@nrwl/web:build",
  "options": {
    "outputPath": "dist/apps/realworld",
    "index": "apps/realworld/src/index.html",
    "main": "apps/realworld/src/main.ts",
    "polyfills": "apps/realworld/src/polyfills.ts",
    "tsConfig": "apps/realworld/tsconfig.app.json",
    "assets": [
      "apps/realworld/src/favicon.ico",
      "apps/realworld/src/assets"
    ],
    "styles": ["apps/realworld/src/styles.css"],
    "scripts": [],
    "webpackConfig": "apps/realworld/webpack.config",
    "buildLibsFromSource": true
  },
  "configurations": {
    "production": {
      "fileReplacements": [
        {
          "replace": "apps/realworld/src/environments/environment.ts",
          "with": "apps/realworld/src/environments/environment.prod.ts"
        }
      ],
      "optimization": true,
      "outputHashing": "all",
      "sourceMap": false,
      "extractCss": true,
      "namedChunks": false,
      "extractLicenses": true,
      "vendorChunk": false,
      "budgets": [
        {
          "type": "initial",
          "maximumWarning": "2mb",
          "maximumError": "5mb"
        }
      ]
    }
  }
},
"serve": {
  "builder": "@nrwl/web:dev-server",
  "options": {
    "buildTarget": "realworld:build"
  }
},
...
```

You may have noticed a rule for loading HTML in `webpack.config.js`. You need to modify some of your AngularJS code to load HTML differently. The application previously used the template cache to store all of the component templates in code, rather than download them at run time. This works, but you can do things a little better with webpack.

Rather than assigning `templateUrl` for your components, you can instead import the HTML and assign it to the `template` attribute. This is effectively the same as writing your templates in-line, but you still have the benefit of having a separate HTML file. The advantage is that the template is tied to its component, not a global module like the template cache. Loading all templates into the template cache is more performant than individually downloading templates, but it also means your user is downloading every single component’s template as part of start-up. This was fine in AngularJS when you didn’t easily have access to lazy-loading, so you always had a large up-front download cost. As you begin to upgrade to Angular or other modern frontend frameworks, you will gain access to lazy-loading: only loading code when it’s necessary. By making this change now, you set yourself up for success later.

To accomplish this, open `config/app.config.js` which is the main app component. Modify it like this:

```javascript
import authInterceptor from './auth.interceptor';
import template from '../layout/app-view.html';

function AppConfig(
  $httpProvider,
  $stateProvider,
  $locationProvider,
  $urlRouterProvider
) {
  'ngInject';

  $httpProvider.interceptors.push(authInterceptor);

  /*
    If you don't want hashbang routing, uncomment this line.
    Our tutorial will be using hashbang routing though :)
  */
  // $locationProvider.html5Mode(true);

  $stateProvider.state('app', {
    abstract: true,
    template,
    resolve: {
      auth: function (User) {
        return User.verifyAuth();
      },
    },
  });

  $urlRouterProvider.otherwise('/');
}

export default AppConfig;
```

This change loads the HTML code directly and sets it to the template attribute of the component. The HTML rule that you specified in the webpack config will take care of loading the HTML correctly and adding it to the template like this.

Now, go through each component of the application and make this change. To make sure that you’ve really modified every component correctly, delete the template cache file (`config/app.templates.js`) that gulp generated earlier.

> In an example like this, it’s easy enough to make this kind of change by hand. In a larger codebase, doing this manually could be very time-intensive. You’ll want to look into an automated tool to do this for you, such as js-codemod or generators.

Run the application the same way as before:

```bash
ng serve realworld
```

## Unit testing

Unit testing can be an important part of any code migration. If you migrate your code into a new system, and all of your unit tests pass, you have a higher degree of confidence that your application actually works without manually testing. Unfortunately, the RealWorld application doesn’t have any unit tests, but you can add your own.

You need a few dependencies for AngularJS unit testing that Nx doesn’t provide by default:

```bash
npm install angular-mocks@1.5.11 karma-webpack
```

Earlier, you configured this app to use Karma as its unit test runner. Nx has provided a Karma config file for you, but you’ll need to modify it to work with AngularJS:

```javascript
const webpack = require('./webpack.config');
const getBaseKarmaConfig = require('../../karma.conf');

module.exports = function (config) {
  const baseConfig = getBaseKarmaConfig();
  config.set({
    ...baseConfig,
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage-istanbul-reporter'),
      require('karma-webpack'),
    ],
    // This will be the new entry to webpack
    // so it should just be a single file
    files: ['src/test.js'],

    // Preprocess test index and test files using
    // webpack (will run babel)
    preprocessors: {
      'src/test.js': ['webpack'],
      'src/**/*.spec.js': ['webpack'],
    },

    // Reference webpack config (single object)
    // and configure some middleware settings
    webpack: {
      ...webpack({}),
      mode: 'development',
    },
    webpackMiddleware: {
      noInfo: true,
      stats: 'errors-only',
    },

    // Typical Karma settings, see docs
    reporters: ['progress'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['ChromeHeadless'],
    singleRun: true,
    concurrency: Infinity,
  });
};
```

Now add a unit test for the comment component:

```javascript
import articleModule from './index';

beforeEach(() => {
  // Create the module where our functionality can attach to
  angular.mock.module('ui.router');
  angular.mock.module(articleModule.name);
});

let component;

beforeEach(
  angular.mock.inject(($rootScope, $componentController) => {
    let User = {
      current: false,
    };
    component = $componentController('comment', { User });
  })
);

describe('comment component', () => {
  it('should be defined', () => {
    expect(component).toBeDefined();
  });

  it('should default canModify to false', () => {
    expect(component.canModify).toEqual(false);
  });
});
```

This unit test does a check to make sure the component compiles and that it sets default permissions correctly.

To run the unit tests:

```bash
ng test
```

You should see green text as your test passes.

![Unit tests passing](./migration-angularjs-unit-tests-passing.png)

## End to End testing

End to End (or E2E) testing is another important part of migration. The more tests you have to verify your code, the easier it is to confirm that your code works the same way it did before. Again, the realworld application doesn’t have any e2e tests, so you need to add your own.

Nx created `realworld-e2e` for you when you generated your app. There is an example test already generated in `apps/realworld-e2e/src/app.e2e-spec.ts`. It has a helper file named `app.po.ts`. The `spec` file contains the actual tests, while the `po` file contains helper functions to retrieve information about the page. The generated test checks to make sure the title of the app is displayed properly, an indication that the app bootstrapped properly in the browser.

You need to modify these files to account for the RealWorld app layout. Make the following modifications:

```typescript
//app.e2e-spec.ts
import { AppPage } from './app.po';
import { browser, logging } from 'protractor';

describe('workspace-project App', () => {
  let page: AppPage;

  beforeEach(() => {
    page = new AppPage();
  });

  it('should display app title', () => {
    page.navigateTo();
    expect(page.getTitleText()).toEqual('conduit');
  });

  afterEach(async () => {
    // Assert that there are no errors emitted from the browser
    const logs = await browser.manage().logs().get(logging.Type.BROWSER);
    expect(logs).not.toContain(
      jasmine.objectContaining({
        level: logging.Level.SEVERE,
      } as logging.Entry)
    );
  });
});
```

```typescript
// app.po.ts
import { browser, by, element } from 'protractor';

export class AppPage {
  navigateTo(): Promise<unknown> {
    return browser.get(browser.baseUrl) as Promise<unknown>;
  }

  getTitleText(): Promise<string> {
    return element(by.css('h1.logo-font')).getText() as Promise<string>;
  }
}
```

To run e2e tests, use the `e2e` command:

```bash
ng e2e
```

You should see a browser pop up to run the Protractor tests and then green success text in your console.

## Summary

- Nx workspaces can be customized to support AngularJS projects
- AngularJS projects can be migrated into an Nx workspace using existing build and serve processes
- Switching to Webpack can enable your Angular upgrade success later
- Unit testing and e2e testing can be used on AngularJS projects and can help ensure a successful migration

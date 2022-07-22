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

{% callout type="note" title="RealWorld app vs reality" %}
The RealWorld app is a great example of an AngularJS app, but it probably doesn’t have the complexity of your own codebase. As you go along, I’ll include some recommendations on how you might apply this example to your larger, more complex application.
{% /callout %}

## Creating your workspace

To start migrating the Real World app, create an Nx workspace:

```bash
npx create-nx-workspace@latest nx-migrate-angularjs
```

When prompted choose the `apps` preset. The other presets use certain recommended defaults for the workspace configuration. Because you have existing code with specific requirements for configuration, starting with a blank workspace avoids resetting these defaults. This will give you the ability to customize the workspace for the incoming code.

At the next prompt, you can choose whether to use [Nx Cloud](https://nx.app) or not. By using Nx Cloud, you’ll be able to share the computation cache of operations like build, test or even your own commands with everyone working on the same project. Whether you choose to use it or not, the outcome of the migration won’t be affected and you can always change your choice later.

```bash
? What to create in the new workspace empty             [an empty workspace with a layout that works best for building apps]
? Set up distributed caching using Nx Cloud (It's free and doesn't require registration.) Yes [Faster builds, run details, GitHub integration. Learn more at https://nx.app]
```

## Creating your app

Your new workspace won’t have much in it because of the `apps` preset. You’ll need to generate an application to have some structure created. Add the Angular plugin to your workspace:

```bash
npm install -D @nrwl/angular
```

For this example, we will use Karma and Protractor, the most common unit test runner and e2e test runner for AngularJS.

{% callout type="note" title="Unit & E2E tests" %}
Codebases with existing unit and e2e tests should continue to use whatever runner they need. We’ve chosen Karma and Protractor here because it’s the most common. If you’re going to be adding unit testing or e2e as part of this transition and are starting fresh, we recommend starting with Jest and Cypress (the default if no arguments are passed to the above command).
{% /callout %}

With the Angular capability added, generate your application:

```bash
nx generate @nrwl/angular:application --name=realworld --unitTestRunner=karma --e2eTestRunner=protractor
```

Accept the default options for each prompt:

```bash
? Which stylesheet format would you like to use? CSS
? Would you like to configure routing for this application? No
```

{% callout type="note" title="About styles" %}
The RealWorld app doesn’t have any styles to actually bundle here. They’re all downloaded from a CDN that all the RealWorld apps use. If your codebase uses something other than CSS, like Sass, you can choose that here.
{% /callout %}

## Migrating dependencies

Copy the dependencies from the RealWorld app’s `package.json` to the `package.json` in your workspace. Split the existing dependencies into `dependencies` (application libraries) and `devDependencies` (build and test libraries). Everything related to gulp can go into `devDependencies`.

Your `package.json` should now look like this:

```json
{
  "name": "nx-migrate-angularjs",
  "version": "0.0.0",
  "license": "MIT",
  "scripts": {
    "postinstall": "ngcc --properties es2015 browser module main",
    "start": "nx serve",
    "build": "nx build",
    "test": "nx test",
    "e2e": "nx e2e"
  },
  "private": true,
  "dependencies": {
    "@angular/animations": "~13.1.0",
    "@angular/common": "~13.1.0",
    "@angular/compiler": "~13.1.0",
    "@angular/core": "~13.1.0",
    "@angular/forms": "~13.1.0",
    "@angular/platform-browser": "~13.1.0",
    "@angular/platform-browser-dynamic": "~13.1.0",
    "@angular/router": "~13.1.0",
    "angular": "^1.5.0-rc.2",
    "angular-ui-router": "^0.4.2",
    "marked": "^0.3.5",
    "rxjs": "~7.4.0",
    "tslib": "^2.0.0",
    "zone.js": "~0.11.4"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "~13.1.0",
    "@angular-eslint/eslint-plugin": "~13.0.1",
    "@angular-eslint/eslint-plugin-template": "~13.0.1",
    "@angular-eslint/template-parser": "~13.0.1",
    "@angular/cli": "~13.1.0",
    "@angular/compiler-cli": "~13.1.0",
    "@angular/language-service": "~13.1.0",
    "@nrwl/angular": "^13.4.6",
    "@nrwl/cli": "13.4.6",
    "@nrwl/eslint-plugin-nx": "13.4.6",
    "@nrwl/linter": "13.4.6",
    "@nrwl/workspace": "13.4.6",
    "@types/jasmine": "~3.5.0",
    "@types/jasminewd2": "~2.0.3",
    "@types/node": "14.14.33",
    "@typescript-eslint/eslint-plugin": "~5.3.0",
    "@typescript-eslint/parser": "~5.3.0",
    "eslint": "8.2.0",
    "eslint-config-prettier": "8.1.0",
    "gulp": "^3.9.1",
    "gulp-angular-templatecache": "^1.8.0",
    "gulp-notify": "^2.2.0",
    "gulp-rename": "^1.2.2",
    "gulp-uglify": "^1.5.3",
    "gulp-util": "^3.0.7",
    "jasmine-core": "~3.6.0",
    "jasmine-spec-reporter": "~5.0.0",
    "karma": "~5.0.0",
    "karma-chrome-launcher": "~3.1.0",
    "karma-coverage-istanbul-reporter": "~3.0.2",
    "karma-jasmine": "~4.0.0",
    "karma-jasmine-html-reporter": "^1.5.0",
    "karma-webpack": "^5.0.0",
    "marked": "^0.3.5",
    "merge-stream": "^1.0.0",
    "prettier": "^2.3.1",
    "protractor": "~7.0.0",
    "ts-node": "~9.1.1",
    "typescript": "~4.4.3",
    "vinyl-source-stream": "^1.1.0"
  }
}
```

Run `npm install` to install all of your new dependencies.

{% callout type="caution" title="Using Bower?" %}
For your own project, you’ll need to switch to NPM if you’re using another package manager like bower. [Learn more about switching away from bower](https://bower.io/blog/2017/how-to-migrate-away-from-bower/)
{% /callout %}

## Migrating application code

This Angular application that you generated has the configuration that you need, but you don’t need any of its application code. You’ll replace that with the RealWorld app code. Delete the contents of `apps/realworld/src/app`.

Starting in the `js` folder of the realworld app, copy all of the application code into `apps/realworld/src/app`. The resulting file tree should look like this:

```text
apps
|____realworld-e2e
|____realworld
| |____src
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
| | | |____app.js
| | |____assets
| | |____environments
| | |____favicon.ico
| | |____index.html
| | |____main.ts
| | |____polyfills.ts
| | |____styles.css
| | |____test.ts
```

{% callout type="warning" title="Javscript vs Typescript" %}
You most likely have your own AngularJS project written in JavaScript as well. While you’ll continue to use JavaScript through the rest of this example, we strongly recommend switching AngularJS projects to TypeScript, especially if you’re planning an upgrade to Angular.
{% /callout %}

## Modifying index.html and main.ts

Your generated application will also have an `index.html` provided. However, it’s set up for an Angular application, not an AngularJS application. Replace the contents of `apps/realworld/src/index.html` with the `index.html` from the RealWorld app.

Your application also has a `main.ts` file which is responsible for bootstrapping your app. Again, you don’t need much from this file any more. Replace its contents with:

```typescript
import './app/app.js';
```

And re-name it to `main.js`. This will import the existing app.js file from the RealWorld app which will bootstrap the app.

## Adding existing build and serve processes

If you’re looking at the example repo, the code for this section is available on branch `initial-migration`. This section is an interim step that continues to use gulp to build and serve the app locally, so we can validate everything works before continuing with the migration. You’ll replace gulp in the next section.

{% callout type="warning" title="Tools & node versions" %}
The RealWorld app uses gulp 3.9.1 to build. This version is not supported anymore and doesn’t run on any version of Node greater than 10.\*. To build this app using gulp, you need to install an appropriate version of Node and make sure you re-install your dependencies. If this isn’t possible (or you just don’t want to), feel free to skip to the next section. The webpack build process should run in any modern Node version.
{% /callout %}

The RealWorld app uses gulp to build the application, as well as provide a development server. To verify that the migration has worked, stay with that build process for now.

{% callout type="caution" title="Verify your changes" %}
During migration, you should take a small step and confirm that things work before moving ahead. Stopping and checking to see that your app still builds and functions is essential to a successful migration.
{% /callout %}

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

You need to point your `build` and `serve` tasks at this gulp build process. Typically, an Angular app is built using the Angular CLI, but the Angular CLI doesn’t know how to build AngularJS projects. All of your tasks are configured in the project configuration file `apps/realworld/project.json`. Find the `build` and `serve` tasks and replace them with this code block:

```json
...
        "build": {
          "executor": "nx:run-commands",
          "options": {
            "commands": [
              {
                "command": "npx gulp --gulpfile apps/realworld/gulpfile.js build"
              }
            ]
          }
        },
        "serve": {
          "executor": "nx:run-commands",
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

This sets up the `build` and `serve` commands to use the locally installed version of gulp to run `build` and `serve`. To see the RealWorld app working, run:

```bash
nx serve realworld
```

Navigate around the application and see that things work.

{% callout type="warning" title="Not using Gulp" %}
Your own project might not be using gulp. If you’re using webpack, you can follow the next section and substitute your own webpack configuration. If you’re using something else like grunt or a home-grown solution, you can follow the same steps here to use it. You’ll use the `run-commands` executor and substitute in the commands for your project.
{% /callout %}

## Switching to webpack

So far, you’ve mostly gotten already existing code and processes to work. This is the best way to get started with any migration: get existing code to work before you start making changes. This gives you a good, stable base to build on. It also means you have working code now rather than hoping you’ll have working code in the future!

But migrating AngularJS code means we need to switch some of our tools to a more modern tool stack. Specifically, using webpack and babel is going to allow us to take advantage of Nx more easily. Becoming an expert in these build tools is outside the scope of this article, but I’ll address some AngularJS specific concerns. To get started, install these new dependencies:

```bash
npm install -D @nrwl/web babel-plugin-angularjs-annotate
```

Nx already has most of what you need for webpack added as a dependency. `@nrwl/web` contains the [executors](/executors/using-builders) we need to use to build and serve the application with webpack and
`babel-plugin-angularjs-annotate` is going to accomplish the same thing that `browserify-ngannotate` previously did in gulp: add dependency injection annotations.

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

{% callout type="note" title="Webpack configuration" %}
This webpack configuration is deliberately simplified for this tutorial. A real production-ready webpack config for your project will be much more involved. See [this project](https://github.com/preboot/angularjs-webpack) for an example.
{% /callout %}

To use webpack instead of gulp, go back to your `apps/realworld/project.json` file and modify the `build` and `serve` commands again:

```json
...
"build": {
  "executor": "@nrwl/web:webpack",
  "options": {
    "outputPath": "dist/apps/realworld",
    "index": "apps/realworld/src/index.html",
    "main": "apps/realworld/src/main.js",
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
  "executor": "@nrwl/web:dev-server",
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

{% callout type="check" title="Automate the work" %}
In an example like this, it’s easy enough to make this kind of change by hand. In a larger codebase, doing this manually could be very time-intensive. You’ll want to look into an automated tool to do this for you, such as js-codemod or generators.
{% /callou %}

We also need to modify the `app.js` and remove the import of `config/app.templates.js`. Modify it like this:

```javascript
import angular from 'angular';

// Import our app config files
import constants from './config/app.constants';
import appConfig from './config/app.config';
import appRun from './config/app.run';
import 'angular-ui-router';
// Import our app functionaity
import './layout';
import './components';
import './home';
import './profile';
import './article';
import './services';
import './auth';
import './settings';
import './editor';

// Create and bootstrap application
const requires = [
  'ui.router',
  'app.layout',
  'app.components',
  'app.home',
  'app.profile',
  'app.article',
  'app.services',
  'app.auth',
  'app.settings',
  'app.editor',
];

// Mount on window for testing
window.app = angular.module('app', requires);

angular.module('app').constant('AppConstants', constants);

angular.module('app').config(appConfig);

angular.module('app').run(appRun);

angular.bootstrap(document, ['app'], {
  strictDi: true,
});
```

Run the application the same way as before:

```bash
nx serve realworld
```

## Unit testing

Unit testing can be an important part of any code migration. If you migrate your code into a new system, and all of your unit tests pass, you have a higher degree of confidence that your application actually works without manually testing. Unfortunately, the RealWorld application doesn’t have any unit tests, but you can add your own.

You need a few dependencies for AngularJS unit testing that Nx doesn’t provide by default:

```bash
npm install -D angular-mocks@1.5.11 karma-webpack
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

Next, rename the existing `apps/realworld/src/test.ts` to `apps/realworld/src/test.js` and modify its content to match the following:

```javascript
import 'angular';
import 'angular-mocks';
import 'angular-ui-router';

// require all test files using special Webpack feature
// https://webpack.github.io/docs/context.html#require-context
const testsContext = require.context('./', true, /\.spec$/);

testsContext.keys().forEach(testsContext);
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
nx test
```

You should see green text as your test passes.

![Unit tests passing](./migration-angularjs-unit-tests-passing.png)

## End to End testing

End to End (or E2E) testing is another important part of any migration. The more tests you have to verify your code, the easier it is to confirm that your code works the same way it did before. Again, the realworld application doesn’t have any e2e tests, so you need to add your own.

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

  it('should display app title', async () => {
    await page.navigateTo();

    expect(await page.getTitleText()).toEqual('conduit');
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
  navigateTo(): Promise<string> {
    return browser.get(browser.baseUrl) as Promise<string>;
  }

  getTitleText(): Promise<string> {
    return element(by.css('h1.logo-font')).getText() as Promise<string>;
  }
}
```

You also need to modify the project configuration of the `realworld-e2e` app at `apps/realworld-e2e/project.json`. This will point your e2e process at the `development` configuration of the `realworld` app by default.

```json
{
  ...
      "e2e": {
      "executor": "@angular-devkit/build-angular:protractor",
      "options": {
        "protractorConfig": "apps/realworld-e2e/protractor.conf.js",
        "devServerTarget": "realworld:serve"
      },
      "configurations": {
        "production": {
          "devServerTarget": "realworld:serve:production"
        }
      }
    },
}
```

To run e2e tests, use the `e2e` command:

```bash
nx e2e realworld-e2e
```

You should see a browser pop up to run the Protractor tests and then green success text in your console.

## Summary

- Nx workspaces can be customized to support AngularJS projects
- AngularJS projects can be migrated into an Nx workspace using existing build and serve processes
- Switching to Webpack can enable your Angular upgrade success later
- Unit testing and e2e testing can be used on AngularJS projects and can help ensure a successful migration

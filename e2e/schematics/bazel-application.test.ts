import { checkFilesExist, newApp, newBazelProject, newLib } from '../utils';

xdescribe('Nrwl Workspace (Bazel)', () => {
  it(
    'should work',
    () => {
      newBazelProject();
      newApp('myApp --directory=myDir');
      newLib('myLib --directory=myDir');

      checkFilesExist('WORKSPACE', 'BUILD.bazel');
    },
    1000000
  );
});

//   afterEach(() => {
//     runCommand('bazel build ...');
//   });

//   itShould('create a bazel project', () => {
//     newBazelProject();
//     checkFilesExist('WORKSPACE', 'BUILD.bazel');
//   });

//   itShould('create an app', () => {
//     newApp('myApp --directory=myDir');
//   });

//   itShould('create a lib', () => {
//     newLib('myLib --directory=myDir');

//     runCommand('bazel test //libs/my-dir/my-lib/src:test');
//   });

//   itShould('allow adding a lib to a module', () => {
//     updateFile(
//         'apps/my-dir/my-app/src/app/app.module.ts',
//         `import { NgModule } from '@angular/core';
// import { BrowserModule } from '@angular/platform-browser';
// import { MyLibModule } from 'proj/libs/my-dir/my-lib/src/my-lib.module';
// import { AppComponent } from './app.component';
// import { StoreModule } from '@ngrx/store';
// import { NxModule } from '@nrwl/nx';

// @NgModule({
// imports: [BrowserModule, MyLibModule, StoreModule.forRoot({}),
// NxModule.forRoot()], declarations: [AppComponent], bootstrap: [AppComponent]
// })
// export class AppModule {}
// `);

//     // TODO: Replace this with a buildozer command to add the lib as a dep.
//     updateFile('apps/my-dir/my-app/src/app/BUILD.bazel', `
// package(default_visibility = ["//visibility:public"])

// load("@angular//:index.bzl", "ng_module")

// ng_module(
//  name = "app",
//  srcs = glob(
//      ["*.ts"],
//      exclude = ["*.spec.ts"],
//  ),
//  assets = [
//      "app.component.css",
//      "app.component.html",
//  ],
//  deps = [
//    "//libs/my-dir/my-lib/src",
//    "@rxjs",
//  ],
// )
// `);
//   });

//   itShould('add a module', () => {
//     newModule('helloWorld --directory=myDir');
//   });

//   itShould('run protractor', () => {
//     const prodServerPort = 8080;
//     headlessProtractorConfig(prodServerPort);
//     runCommand([
//       'node', 'node_modules/concurrently/src/main.js',
//       '"bazel run //apps/my-dir/my-app/src:prodserver"',
//       `"while ! nc -z 127.0.0.1 ${prodServerPort}; do sleep 1; done && ng
//         e2e -s=false --app=my-dir/my-app"`,
//       '--kill-others', '--success', 'first'
//     ].join(' '));

//     const devServerPort = 5432;
//     headlessProtractorConfig(devServerPort);
//     runCommand([
//       'node', 'node_modules/concurrently/src/main.js',
//       '"bazel run //apps/my-dir/my-app/src:devserver"',
//       `"while ! nc -z 127.0.0.1 ${devServerPort}; do sleep 1; done && ng
//         e2e -s=false --app=my-dir/my-app"`,
//       '--kill-others', '--success', 'first'
//     ].join(' '));
//   });
// });

// function headlessProtractorConfig(port: number): void {
//   return updateFile(
//       'protractor.conf.js',
//       `const { SpecReporter } = require('jasmine-spec-reporter');
//   const { getAppDirectoryUsingCliConfig } =
//   require('@nrwl/schematics/src/utils/cli-config-utils'); const appDir =
//   getAppDirectoryUsingCliConfig();

//   exports.config = {
//     allScriptsTimeout: 11000,
//     specs: [
//       appDir + '/e2e/**/*.e2e-spec.ts'
//     ],
//     multiCapabilities: {
//       'browserName': 'chrome',

//       chromeOptions: {
//         args: [
//           '--headless',
//           '--disable-gpu',
//           '--window-size=1280x720',
//         ],
//       },
//     },
//     directConnect: true,
//     baseUrl: 'http://localhost:${port}/',
//     framework: 'jasmine',
//     jasmineNodeOpts: {
//       showColors: true,
//       defaultTimeoutInterval: 30000,
//       print: function() {}
//     },
//     onPrepare() {
//       require('ts-node').register({
//         project: appDir + '/e2e/tsconfig.e2e.json'
//       });
//       jasmine.getEnv().addReporter(new SpecReporter({ spec: {
//       displayStacktrace: true } }));
//     }
//   };`);
// }

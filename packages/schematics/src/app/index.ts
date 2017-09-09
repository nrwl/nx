import {
  apply, branchAndMerge, chain, externalSchematic, mergeWith, move, Rule, template, Tree,
  url
} from '@angular-devkit/schematics';
import {Schema} from './schema';
import * as stringUtils from '@schematics/angular/strings';
import {insert, toFileName} from '@nrwl/schematics';
import * as path from 'path';
import * as ts from 'typescript';
import {addBootstrapToModule, addImportToModule} from '@schematics/angular/utility/ast-utils';

function addBootstrap(path: string): Rule {
  return (host: Tree) => {
    const modulePath = `${path}/app/app.module.ts`;
    const moduleSource = host.read(modulePath)!.toString('utf-8');
    const sourceFile = ts.createSourceFile(modulePath, moduleSource, ts.ScriptTarget.Latest, true);
    const importChanges = addImportToModule(sourceFile, modulePath, 'BrowserModule', '@angular/platform-browser');
    const bootstrapChanges = addBootstrapToModule(sourceFile, modulePath, 'AppComponent', './app.component');
    insert(host, modulePath, [...importChanges, ...bootstrapChanges]);
    return host;
  };
}
function addAppToAngularCliJson(options: Schema): Rule {
  return (host: Tree) => {
    const appConfig = {
      "name": options.name,
      "root": path.join('apps', options.name, options.sourceDir),
      "outDir": `dist/apps/${options.name}`,
      "assets": [
        "assets",
        "favicon.ico"
      ],
      "index": "index.html",
      "main": "main.ts",
      "polyfills": "polyfills.ts",
      "test": "../../../test.js",
      "tsconfig": "../../../tsconfig.app.json",
      "testTsconfig": "../../../tsconfig.spec.json",
      "prefix": options.prefix,
      "styles": [
        `styles.${options.style}`
      ],
      "scripts": [],
      "environmentSource": "environments/environment.ts",
      "environments": {
        "dev": "environments/environment.ts",
        "prod": "environments/environment.prod.ts"
      }
    };

    if (!host.exists(".angular-cli.json")) {
      throw new Error("Missing .angular-cli.json");
    }

    const sourceText = host.read('.angular-cli.json')!.toString('utf-8');
    const json = JSON.parse(sourceText);
    if (!json['apps']) {
      json['apps'] = [];
    }
    json['apps'].push(appConfig);

    host.overwrite('.angular-cli.json', JSON.stringify(json, null, 2));
    return host;
  };
}

export default function (options: Schema): Rule {
  const fullPath = path.join("apps", toFileName(options.name), options.sourceDir);

  const templateSource = apply(url('./files'), [
    template({
      utils: stringUtils,
      dot: '.',
      tmpl: '',
      ...options as object
    })
  ]);

  return chain([
    branchAndMerge(chain([
      mergeWith(templateSource)
    ])),
    externalSchematic('@schematics/angular', 'module', {
      name: 'app',
      commonModule: false,
      flat: true,
      routing: options.routing,
      sourceDir: fullPath,
      spec: false,
    }),
    externalSchematic('@schematics/angular', 'component', {
      name: 'app',
      selector: `${options.prefix}-root`,
      sourceDir: fullPath,
      flat: true,
      inlineStyle: options.inlineStyle,
      inlineTemplate: options.inlineTemplate,
      spec: !options.skipTests,
      styleext: options.style,
      viewEncapsulation: options.viewEncapsulation,
      changeDetection: options.changeDetection
    }),
    addBootstrap(fullPath),
    addAppToAngularCliJson(options)
  ]);
}

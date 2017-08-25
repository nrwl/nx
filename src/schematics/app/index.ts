import {apply, chain, mergeWith, move, Rule, externalSchematic, template, url, Tree,} from '@angular-devkit/schematics';
import {Schema} from './schema';
import {names, toFileName} from '../name-utils';
import * as path from 'path';
import * as ts from 'typescript';
import {addBootstrapToModule, addImportToModule} from '@schematics/angular/utility/ast-utils';
import {insert} from '../utility/ast-utils';

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

function addAppToAngularCliJson(fullPath: string, options: Schema): Rule {
  return (host: Tree) => {
    const config = JSON.parse(host.read('.angular-cli.json')!.toString('utf-8'));

    config.apps.push({
      name: options.name,
      root: fullPath,
      assets: ['assets', 'favicon.ico'],
      index: 'index.html',
      main: 'main.ts',
      polyfills: 'polyfills.ts',
      prefix: options.name,
      styles: ['styles.css'],
      scripts: [],
      environmentSource: 'environments/environment.ts',
      environments: {'dev': 'environments/environment.ts', 'prod': 'environments/environment.prod.ts'}
    });

    host.overwrite('.angular-cli.json', JSON.stringify(config, null, 2));
    return host;
  };
}


export default function(options: Schema): Rule {
  const fullPath = path.join(options.directory, toFileName(options.name), options.sourceDir);
  return chain([
    mergeWith(apply(url('./files'), [template({...options, ...names(options.name), 'dot': '.', 'tmpl': ''})])),
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
    addBootstrap(fullPath), addAppToAngularCliJson(fullPath, options)
  ]);
}

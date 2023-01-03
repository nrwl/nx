import { Tree } from 'nx/src/generators/tree';
import { Schema } from '../schema';
import { readProjectConfiguration } from 'nx/src/generators/utils/project-configuration';
import { joinPathFragments } from 'nx/src/utils/path';
import { readNxJson } from '@nrwl/devkit';

export function removeDeadCodeFromRemote(tree: Tree, options: Schema) {
  const projectName = options.appName;
  const project = readProjectConfiguration(tree, projectName);

  ['css', 'less', 'scss', 'sass'].forEach((style) => {
    const pathToComponentStyle = joinPathFragments(
      project.sourceRoot,
      `app/app.component.${style}`
    );
    if (tree.exists(pathToComponentStyle)) {
      tree.delete(pathToComponentStyle);
    }
  });

  tree.rename(
    joinPathFragments(project.sourceRoot, 'app/nx-welcome.component.ts'),
    joinPathFragments(
      project.sourceRoot,
      'app/remote-entry/nx-welcome.component.ts'
    )
  );
  tree.delete(
    joinPathFragments(project.sourceRoot, 'app/app.component.spec.ts')
  );
  tree.delete(joinPathFragments(project.sourceRoot, 'app/app.component.html'));

  const pathToAppComponent = joinPathFragments(
    project.sourceRoot,
    'app/app.component.ts'
  );
  if (!options.standalone) {
    const componentContents = tree.read(pathToAppComponent, 'utf-8');
    const isInlineTemplate = !componentContents.includes('templateUrl');

    const component =
      componentContents.split(
        isInlineTemplate ? 'template' : 'templateUrl'
      )[0] +
      `template: '<router-outlet></router-outlet>'

})
export class AppComponent {}`;

    tree.write(pathToAppComponent, component);

    tree.write(
      joinPathFragments(project.sourceRoot, 'app/app.module.ts'),
      `import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';

@NgModule({
 declarations: [AppComponent],
 imports: [
   BrowserModule,
   RouterModule.forRoot([{
     path: '',
     loadChildren: () => import('./remote-entry/entry.module').then(m => m.RemoteEntryModule)
   }], { initialNavigation: 'enabledBlocking' }),
 ],
 providers: [],
 bootstrap: [AppComponent],
})
export class AppModule {}`
    );
  } else {
    tree.delete(pathToAppComponent);

    const prefix = options.prefix ?? readNxJson(tree).npmScope;
    const remoteEntrySelector = `${prefix}-${projectName}-entry`;

    const pathToIndexHtml = project.targets.build.options.index;
    const indexContents = tree.read(pathToIndexHtml, 'utf-8');

    const rootSelectorRegex = new RegExp(`${prefix}-root`, 'ig');
    const newIndexContents = indexContents.replace(
      rootSelectorRegex,
      remoteEntrySelector
    );

    tree.write(pathToIndexHtml, newIndexContents);
  }
}

import { Tree } from 'nx/src/generators/tree';
import { NormalizedSchema } from './normalized-schema';
import componentGenerator from '../../component/component';
import { joinPathFragments } from 'nx/src/utils/path';
import { names } from '@nrwl/devkit';
import { addLoadChildren } from './add-load-children';
import { addChildren } from './add-children';
import { normalizeProjectName } from '../../utils/project';

export async function addStandaloneComponent(
  tree: Tree,
  options: NormalizedSchema
) {
  await componentGenerator(tree, {
    name: options.name,
    standalone: true,
    export: true,
    project: normalizeProjectName(options.name, options.directory),
  });

  if (options.routing) {
    const pathToRoutes = joinPathFragments(
      options.projectRoot,
      'src/lib/routes.ts'
    );

    const routesContents = `import { Route } from '@angular/router';
    import { ${options.standaloneComponentName} } from './${joinPathFragments(
      options.fileName,
      `${options.fileName}.component`
    )}';
    
        export const ${names(
          options.name
        ).className.toUpperCase()}_ROUTES: Route[] = [
          {path: '', component: ${options.standaloneComponentName}}
        ];`;
    tree.write(pathToRoutes, routesContents);

    const pathToEntryFile = joinPathFragments(
      options.projectRoot,
      'src',
      `${options.entryFile}.ts`
    );
    const entryFileContents = tree.read(pathToEntryFile, 'utf-8');
    tree.write(
      pathToEntryFile,
      `${entryFileContents}
        export * from './lib/routes'`
    );

    if (options.parentModule) {
      if (options.lazy) {
        addLoadChildren(tree, options);
      } else {
        addChildren(tree, options);
      }
    }
  }
}

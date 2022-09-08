import { Tree } from 'nx/src/generators/tree';
import { NormalizedSchema } from './normalized-schema';
import componentGenerator from '../../component/component';
import { joinPathFragments } from 'nx/src/utils/path';
import { names } from '@nrwl/devkit';
import { addLoadChildren } from './add-load-children';
import { addChildren } from './add-children';

export async function addStandaloneComponent(
  tree: Tree,
  { libraryOptions, componentOptions }: NormalizedSchema
) {
  await componentGenerator(tree, {
    ...componentOptions,
    name: componentOptions.name,
    standalone: true,
    export: true,
    project: libraryOptions.name,
  });

  if (libraryOptions.routing) {
    const pathToRoutes = joinPathFragments(
      libraryOptions.projectRoot,
      'src/lib/routes.ts'
    );

    const routesContents = `import { Route } from '@angular/router';
    import { ${
      libraryOptions.standaloneComponentName
    } } from './${joinPathFragments(
      libraryOptions.fileName,
      `${libraryOptions.fileName}.component`
    )}';
    
        export const ${names(
          libraryOptions.name
        ).className.toUpperCase()}_ROUTES: Route[] = [
          {path: '', component: ${libraryOptions.standaloneComponentName}}
        ];`;
    tree.write(pathToRoutes, routesContents);

    const pathToEntryFile = joinPathFragments(
      libraryOptions.projectRoot,
      'src',
      `${libraryOptions.entryFile}.ts`
    );
    const entryFileContents = tree.read(pathToEntryFile, 'utf-8');
    tree.write(
      pathToEntryFile,
      `${entryFileContents}
        export * from './lib/routes'`
    );

    if (libraryOptions.parentModule) {
      if (libraryOptions.lazy) {
        addLoadChildren(tree, libraryOptions);
      } else {
        addChildren(tree, libraryOptions);
      }
    }
  }
}

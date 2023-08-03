import {
  Tree,
  formatFiles,
  getProjects,
  joinPathFragments,
  updateJson,
} from '@nx/devkit';

export default async function addTypings(tree: Tree) {
  const projects = getProjects(tree);

  const buildExecutors = [
    '@nx/webpack:webpack',
    '@nx/vite:build',
    '@nx/rspack:rspack',
  ];

  for (const [, config] of projects) {
    if (buildExecutors.includes(config.targets?.build?.executor)) {
      if (
        !tree.exists(
          joinPathFragments(config.root, 'src/typings/cssmodule.d.ts')
        )
      ) {
        tree.write(
          `${config.root}/src/typings/cssmodule.d.ts`,
          `
          declare module '*.module.css' {
            const classes: { readonly [key: string]: string };
            export default classes;
          }
          
          declare module '*.module.scss' {
            const classes: { readonly [key: string]: string };
            export default classes;
          }
          
          declare module '*.module.sass' {
            const classes: { readonly [key: string]: string };
            export default classes;
          }
          
          declare module '*.module.less' {
            const classes: { readonly [key: string]: string };
            export default classes;
          }
          
          declare module '*.module.styl' {
            const classes: { readonly [key: string]: string };
            export default classes;
          }
          `
        );
      }
      if (
        !tree.exists(joinPathFragments(config.root, 'src/typings/image.d.ts'))
      ) {
        tree.write(
          `${config.root}/src/typings/image.d.ts`,
          `
          /// <reference types="react" />
          /// <reference types="react-dom" />

          declare module '*.svg' {
            import * as React from 'react';

            export const ReactComponent: React.FunctionComponent<
              React.SVGProps<SVGSVGElement> & { title?: string }
            >;

            const src: string;
            export default src;
          }

          declare module '*.bmp' {
            const src: string;
            export default src;
          }

          declare module '*.gif' {
            const src: string;
            export default src;
          }

          declare module '*.jpg' {
            const src: string;
            export default src;
          }

          declare module '*.jpeg' {
            const src: string;
            export default src;
          }

          declare module '*.png' {
            const src: string;
            export default src;
          }

          declare module '*.avif' {
            const src: string;
            export default src;
          }

          declare module '*.webp' {
            const src: string;
            export default src;
          }`
        );
      }
      // remove typings from cssmodule.d.ts and image.d.ts
      ['tsconfig.app.json', 'tsconfig.spec.json'].forEach((tsconfigPath) => {
        if (tree.exists(joinPathFragments(config.root, tsconfigPath))) {
          updateJson(
            tree,
            joinPathFragments(config.root, tsconfigPath),
            (tsconfig) => {
              if (tsconfig.files?.length > 0) {
                tsconfig.files = tsconfig.files.filter(
                  (file: string) =>
                    !['cssmodule.d.ts', 'image.d.ts'].includes(file)
                );
              }
              return tsconfig;
            }
          );
        }
      });
    }
  }
  await formatFiles(tree);
}

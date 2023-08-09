import {
  joinPathFragments,
  offsetFromRoot,
  ProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import { join } from 'path';
import { NormalizedSchema } from '../schema';

interface PartialEsLintrcOverride {
  parserOptions?: {
    project?: string[];
  };
}

interface PartialEsLintRcJson {
  extends: string | string[];
  overrides?: PartialEsLintrcOverride[];
}

function offsetFilePath(
  project: ProjectConfiguration,
  pathToFile: string,
  offset: string
): string {
  if (!pathToFile.startsWith('..')) {
    // not a relative path
    return pathToFile;
  }
  const pathFromRoot = join(project.root, pathToFile);
  return joinPathFragments(offset, pathFromRoot);
}

/**
 * Update the .eslintrc file of the project if it exists.
 *
 * @param schema The options provided to the schematic
 */
export function updateEslintConfig(
  tree: Tree,
  schema: NormalizedSchema,
  project: ProjectConfiguration
) {
  const offset = offsetFromRoot(schema.relativeToRootDestination);
  const eslintJsonPath = join(
    schema.relativeToRootDestination,
    '.eslintrc.json'
  );

  if (tree.exists(eslintJsonPath)) {
    return updateJson<PartialEsLintRcJson>(
      tree,
      eslintJsonPath,
      (eslintRcJson) => {
        if (typeof eslintRcJson.extends === 'string') {
          eslintRcJson.extends = offsetFilePath(
            project,
            eslintRcJson.extends,
            offset
          );
        } else if (eslintRcJson.extends) {
          eslintRcJson.extends = eslintRcJson.extends.map((extend: string) =>
            offsetFilePath(project, extend, offset)
          );
        }

        eslintRcJson.overrides?.forEach(
          (o: { parserOptions?: { project?: string | string[] } }) => {
            if (o.parserOptions?.project) {
              o.parserOptions.project = Array.isArray(o.parserOptions.project)
                ? o.parserOptions.project.map((p) =>
                    p.replace(project.root, schema.relativeToRootDestination)
                  )
                : o.parserOptions.project.replace(
                    project.root,
                    schema.relativeToRootDestination
                  );
            }
          }
        );
        return eslintRcJson;
      }
    );
  }

  const eslintFlatPath = join(
    schema.relativeToRootDestination,
    'eslint.config.js'
  );
  if (tree.exists(eslintFlatPath)) {
    const config = tree.read(eslintFlatPath, 'utf-8');
    tree.write(
      eslintFlatPath,
      replaceFlatConfigPaths(
        config,
        project,
        offset,
        schema.relativeToRootDestination
      )
      // config.replace(
      //   /require(['"](.*)['"])/g,
      //   `require('` + offsetFilePath(project, `$1`, offset) + `')`
      // )
    );
  }
}

function replaceFlatConfigPaths(
  config: string,
  project: ProjectConfiguration,
  offset: string,
  pathToDestination: string
): string {
  let match;
  let newConfig = config;

  // replace requires
  const requireRegex = RegExp(/require\(['"](.*)['"]\)/g);
  while ((match = requireRegex.exec(newConfig)) !== null) {
    const newPath = offsetFilePath(project, match[1], offset);
    newConfig =
      newConfig.slice(0, match.index) +
      `require('${newPath}')` +
      newConfig.slice(match.index + match[0].length);
  }
  // replace projects
  const projectRegex = RegExp(/project:\s?\[?['"](.*)['"]\]?/g);
  while ((match = projectRegex.exec(newConfig)) !== null) {
    const newProjectDef = match[0].replaceAll(project.root, pathToDestination);
    newConfig =
      newConfig.slice(0, match.index) +
      newProjectDef +
      newConfig.slice(match.index + match[0].length);
  }

  return newConfig;
}

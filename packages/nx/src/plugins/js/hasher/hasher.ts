import { ProjectGraphProjectNode } from '../../../config/project-graph';
import { readJsonFile } from '../../../utils/fileutils';
import { getRootTsConfigFileName } from '../utils/typescript';
import {
  findProjectForPath,
  ProjectRootMappings,
} from '../../../project-graph/utils/find-project-for-path';

interface CompilerOptions {
  paths: Record<string, string[]>;
}

interface TsconfigJsonConfiguration {
  compilerOptions: CompilerOptions;
}

function readTsConfigJson(): TsconfigJsonConfiguration {
  try {
    const res = readJsonFile(getRootTsConfigFileName());
    res.compilerOptions.paths ??= {};
    return res;
  } catch {
    return {
      compilerOptions: { paths: {} },
    };
  }
}

let tsConfigJson: TsconfigJsonConfiguration;

export function hashTsConfig(
  p: ProjectGraphProjectNode,
  projectRootMappings: ProjectRootMappings,
  { selectivelyHashTsConfig }: { selectivelyHashTsConfig: boolean }
) {
  if (!tsConfigJson) {
    tsConfigJson = readTsConfigJson();
  }
  if (selectivelyHashTsConfig) {
    return removeOtherProjectsPathRecords(p, tsConfigJson, projectRootMappings);
  } else {
    return JSON.stringify(tsConfigJson);
  }
}

function removeOtherProjectsPathRecords(
  p: ProjectGraphProjectNode,
  tsConfigJson: TsconfigJsonConfiguration,
  projectRootMapping: ProjectRootMappings
) {
  const { paths, ...compilerOptions } = tsConfigJson.compilerOptions;
  const filteredPaths: Record<string, string[]> = {};

  if (!paths) {
    return '';
  }

  for (const [key, files] of Object.entries(paths)) {
    for (const filePath of files) {
      if (p.name === findProjectForPath(filePath, projectRootMapping)) {
        filteredPaths[key] = files;
        break;
      }
    }
  }

  return JSON.stringify({
    compilerOptions: {
      ...compilerOptions,
      paths: filteredPaths,
    },
  });
}

import { getImportPath } from '../../../utils/path';
import { ProjectGraphProjectNode } from '../../../config/project-graph';
import { readJsonFile } from '../../../utils/fileutils';
import { getRootTsConfigFileName } from '../utils/typescript';
import { NxJsonConfiguration } from '../../../config/nx-json';

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
  nxJson: NxJsonConfiguration,
  { selectivelyHashTsConfig }: { selectivelyHashTsConfig: boolean }
) {
  if (!tsConfigJson) {
    tsConfigJson = readTsConfigJson();
  }
  if (selectivelyHashTsConfig) {
    return removeOtherProjectsPathRecords(p, tsConfigJson, nxJson);
  } else {
    return JSON.stringify(tsConfigJson);
  }
}

function removeOtherProjectsPathRecords(
  p: ProjectGraphProjectNode,
  tsConfigJson: TsconfigJsonConfiguration,
  nxJson: NxJsonConfiguration
) {
  const { paths, ...compilerOptions } = tsConfigJson.compilerOptions;
  const rootPath = p.data.root.split('/');
  rootPath.shift();
  const pathAlias = getImportPath(nxJson?.npmScope, rootPath.join('/'));

  return JSON.stringify({
    compilerOptions: {
      ...compilerOptions,
      paths: {
        [pathAlias]: paths[pathAlias] ?? [],
      },
    },
  });
}

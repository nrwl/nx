import { getFilesInDirectoryUsingContext } from 'nx/src/utils/workspace-context';
import {CreateNodesContext} from '@nx/devkit';

import type { PlaywrightTestConfig } from '@playwright/test';
import { minimatch } from 'minimatch';

import {
  CreateNodesResultV2,
  CreateNodesV2,
  CreateNodesResult,
  CreateNodesContextV2
} from "@nx/devkit";
import { dirname } from "path";

interface PlaywrightPluginOptions {
  targetName: string;
  ciTargetName: string;
}

const defaultOptions: PlaywrightPluginOptions = {
  targetName: "e2e",
  ciTargetName: "e2e-ci",
};

function createNodeForConfigFile(
  configFile: string,
  options: PlaywrightPluginOptions,
  context: CreateNodesContextV2
): [string, CreateNodesResult] {
  return [
    configFile,
    {
      projects: {
        [dirname(configFile)]: {
          targets: {
            [options.ciTargetName]: {
              executor: "nx:noop",
            },
            [options.targetName]: {
              executor: "nx:noop",
            },
          },
        },
      },
    },
  ];
}

export const createNodesV2: CreateNodesV2<PlaywrightPluginOptions> = [
  "**/*/project.json",
  async (files, options, context): Promise<CreateNodesResultV2> => {
    const mergedOptions = { ...defaultOptions, ...options };
    const result: CreateNodesResultV2 = [];
    for (const file of files) {
      const [configFile, projectResult] = createNodeForConfigFile(
        file,
        mergedOptions,
        context
      );
      result.push([configFile, projectResult]);
    }
    return result;
  },
];

async function getAllTestFiles(opts: {
  context: CreateNodesContext;
  path: string;
  config: PlaywrightTestConfig;
}) {
  const files = await getFilesInDirectoryUsingContext(
    opts.context.workspaceRoot,
    opts.path
  );
  const matcher = createMatcher(opts.config.testMatch);
  const ignoredMatcher = opts.config.testIgnore
    ? createMatcher(opts.config.testIgnore)
    : () => false;
  return files.filter((file) => matcher(file) && !ignoredMatcher(file));
}

function createMatcher(pattern: string | RegExp | Array<string | RegExp>) {
  if (Array.isArray(pattern)) {
    const matchers = pattern.map((p) => createMatcher(p));
    return (path: string) => matchers.some((m) => m(path));
  } else if (pattern instanceof RegExp) {
    return (path: string) => pattern.test(path);
  } else {
    return (path: string) => {
      try {
        return minimatch(path, pattern);
      } catch (e) {
        throw new Error(`Error matching ${path} with ${pattern}: ${e.message}`);
      }
    };
  }
}
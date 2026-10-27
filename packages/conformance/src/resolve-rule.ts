/**
 * This file is exposed by @nx/conformance for use within both its own implementation of the
 * conformance command, as well as the Nx Cloud light client's, which resolve it dynamically
 * at runtime.
 */

import { readJsonFile, workspaceRoot } from '@nx/devkit';
import Ajv from 'ajv';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { ConformanceRule, RuleProjectsConfig, RuleStatus } from './types';

export type SuccessfulResolveRuleResultData = {
  ruleSpecifier: string;
  ruleModule: ConformanceRule<unknown>;
  ruleOptions?: Record<string, unknown>;
  projects?: RuleProjectsConfig;
  status?: RuleStatus;
  /**
   * Only applicable to Nx Cloud Enterprise users.
   */
  scheduledStatus?: RuleStatus | null;
  /**
   * Only applicable to Nx Cloud Enterprise users.
   * Unix timestamp in milliseconds.
   */
  scheduledStatusDate?: number | null;
};

type ResolveRuleResult =
  | {
      error: Error;
      data: null;
    }
  | {
      error: null;
      data: SuccessfulResolveRuleResultData;
    };

export async function resolveRule({
  rule,
  options,
  projects,
  status,
  scheduledStatus,
  scheduledStatusDate,
}: {
  rule: string;
  options?: Record<string, unknown>;
  projects?: RuleProjectsConfig;
  status?: RuleStatus;
  scheduledStatus?: RuleStatus;
  scheduledStatusDate?: number;
}): Promise<ResolveRuleResult> {
  let cleanupTranspiler: (() => void) | undefined;

  try {
    const { getRootTsConfigPath } = await import('@nx/js');
    let registerTsProject: (s: string) => () => void;
    // v23 changed path, fallback to old path until v22 is not longer supported.
    try {
      registerTsProject = (await import('@nx/js/internal')).registerTsProject;
    } catch {
      registerTsProject = (await import('@nx/js/src/internal'))
        .registerTsProject;
    }
    const rootTsconfigPath = getRootTsConfigPath();
    if (rootTsconfigPath) {
      cleanupTranspiler = registerTsProject(rootTsconfigPath);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      error: new Error(
        `Failed to set up the TypeScript project for conformance rule "${rule}": ${detail}\nInstall the missing dependency, then re-run the command.`,
        { cause: error }
      ),
      data: null,
    };
  }

  try {
    const rulePath = require.resolve(rule, {
      paths: [workspaceRoot],
    });

    let ruleModule = require(rulePath);
    if (ruleModule.default) {
      ruleModule = ruleModule.default;
    }

    /**
     * Based on certain emit config options from build tools, the default export could be
     * wrapped in an additional `default` property
     */
    if (ruleModule.default) {
      ruleModule = ruleModule.default;
    }

    // Validate the given options against the rule's JSON schema definition.
    const schemaFilePath = join(dirname(rulePath), 'schema.json');
    if (!existsSync(schemaFilePath)) {
      return {
        error: new Error(
          `No schema.json file found alongside rule "${rule}", it is therefore invalid.`
        ),
        data: null,
      };
    }

    try {
      const schema = readJsonFile(schemaFilePath);
      const ajv = new Ajv();
      const validate = ajv.compile(schema);
      if (!validate(options ?? {})) {
        return {
          error: new Error(
            `The options given to rule "${rule}" could not be validated against its schema.\n- Given options: ${JSON.stringify(options)}\n- Validation Error(s): ${ajv.errorsText(validate.errors)}\n- Schema file path: ${relative(workspaceRoot, schemaFilePath)}\n`
          ),
          data: null,
        };
      }
    } catch {
      return {
        error: new Error(`Failed to read schema.json file for rule "${rule}"`),
        data: null,
      };
    }

    return {
      error: null,
      data: {
        // We do not want to store the fully resolved path on disk, just the original specifier in the config
        ruleSpecifier: rule,
        ruleModule,
        ruleOptions: options,
        projects,
        status,
        scheduledStatus,
        scheduledStatusDate,
      },
    };
  } catch (error) {
    // Detail rides on `cause`: Nx's handleErrors only prints it under --verbose.
    return {
      error: new Error(
        `Failed to resolve rule specifier: "${rule}". Make sure the specifier is correct and the path/package is installed and available.`,
        { cause: error }
      ),
      data: null,
    };
  } finally {
    if (typeof cleanupTranspiler === 'function') {
      cleanupTranspiler();
    }
  }
}

/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
// nx-ignore-next-line
import { GraphError } from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */
import { EyeIcon } from '@heroicons/react/24/outline';
import { PropertyInfoTooltip, Tooltip } from '@nx/graph/ui-tooltips';
import { useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { Pill } from '../pill';
import { TargetConfigurationGroupList } from '../target-configuration-details-group-list/target-configuration-details-group-list';
import { TooltipTriggerText } from '../target-configuration-details/tooltip-trigger-text';
import { TargetTechnologies } from '../target-technologies/target-technologies';

export interface ProjectDetailsProps {
  project: ProjectGraphProjectNode;
  sourceMap: Record<string, string[]>;
  errors?: GraphError[];
  variant?: 'default' | 'compact';
  connectedToCloud?: boolean;
  onViewInProjectGraph?: (data: { projectName: string }) => void;
  onViewInTaskGraph?: (data: {
    projectName: string;
    targetName: string;
  }) => void;
  onRunTarget?: (data: { projectName: string; targetName: string }) => void;
  onNxConnect?: () => void;
  viewInProjectGraphPosition?: 'top' | 'bottom';
}

const typeToProjectType = {
  app: 'Application',
  lib: 'Library',
  e2e: 'E2E',
};

const JsonSnippetViewer = ({ jsonContent, startLine, endLine }: any) => {
  const [highlightedCode, setHighlightedCode] = useState('');
  const [visibleLines, setVisibleLines] = useState([]);

  useEffect(() => {
    const highlightCode = async () => {
      // @ts-ignore
      const { createHighlighter } = await import('shiki');
      const { transformerNotationFocus } = await import(
        '@shikijs/transformers'
      );
      const highlighter = await createHighlighter({
        themes: ['github-dark'],
        langs: ['json'],
      });
      const highlighted = highlighter.codeToHtml(visibleLines.join('\n'), {
        lang: 'json',
        theme: 'github-dark',
        transformers: [transformerNotationFocus()],
      });
      setHighlightedCode(highlighted);
    };

    highlightCode();
  }, [visibleLines]);

  useEffect(() => {
    const lines = jsonContent.split('\n');
    const totalLines = lines.length;
    const start = Math.max(0, startLine - 6);
    const end = Math.min(totalLines - 1, endLine + 5);
    setVisibleLines(
      lines
        .map((l: string, i: number) => {
          if (i >= startLine - 1 && i <= endLine - 1) {
            l += ' // [!code focus]';
          }
          return l;
        })
        .slice(start, end + 1)
    );
  }, [jsonContent, startLine, endLine]);

  return (
    <div className="overflow-hidden rounded-lg bg-gray-800 font-mono text-sm">
      <style
        dangerouslySetInnerHTML={{
          __html: `
      .focused {
        background: #333333;
        display: inline-block;
        width: 100%;
      }
    `,
        }}
      />
      <div className="flex">
        <div className="select-none py-4 pl-4 text-gray-400">
          {visibleLines.map((_, index) => (
            <div key={index}>{startLine - 5 + index}</div>
          ))}
        </div>
        <pre className="flex-1 overflow-x-auto p-4">
          <code
            className="language-json"
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
      </div>
      {/* {visibleLines.length < jsonContent.split('\n').length && (
        <div className="bg-gray-700 py-2 text-center text-gray-400">...</div>
      )} */}
    </div>
  );
};

function OwnersTooltip({ owner }: any) {
  return (
    <div className="max-w-lg pb-2 text-sm text-slate-700 dark:text-slate-400">
      <h4 className="flex items-center justify-between border-b border-slate-200 text-base dark:border-slate-700/60">
        <span className="font-mono">Owner</span>
      </h4>
      <div className={twMerge(`mt-2 flex flex-row py-2`)}>
        <p className="whitespace-pre-wrap font-bold normal-case">
          {owner.ownedFiles === '*'
            ? `${owner.id} is an owner of the entire project`
            : `${owner.id} owns the following files within this project:`}
          <ul className="mt-2 text-xs font-normal">
            {owner.ownedFiles.map((file: string) => (
              <li> - {file}</li>
            ))}
          </ul>
        </p>
      </div>
      <h5 className="mt-2 font-bold">Why?</h5>
      <p className="mt-2 text-xs">
        The owner is specified here in your nx.json:
      </p>
      <div className="mt-4">
        <JsonSnippetViewer
          startLine={owner.fromConfigLocation.startLine}
          endLine={owner.fromConfigLocation.endLine}
          jsonContent={getNxJsonContent()}
        />
      </div>
    </div>
  );
}

export const ProjectDetails = ({
  project,
  sourceMap,
  variant,
  onViewInProjectGraph,
  onViewInTaskGraph,
  onRunTarget,
  onNxConnect,
  viewInProjectGraphPosition = 'top',
  connectedToCloud,
}: ProjectDetailsProps) => {
  const projectData = project.data;
  const isCompact = variant === 'compact';

  const technologies = [
    ...new Set(
      [
        ...(projectData.metadata?.technologies ?? []),
        ...Object.values(projectData.targets ?? {})
          .map((target) => target?.metadata?.technologies)
          .flat(),
      ].filter(Boolean)
    ),
  ] as string[];

  return (
    <>
      <header
        className={twMerge(
          `border-b border-slate-900/10 dark:border-slate-300/10`,
          isCompact ? 'mb-2' : 'mb-4'
        )}
      >
        <div
          className={twMerge(
            `flex flex-wrap items-center justify-between`,
            isCompact ? `gap-1` : `mb-4 gap-2`
          )}
        >
          <div className="flex items-center gap-2">
            <h1
              className={twMerge(
                `dark:text-slate-100`,
                isCompact ? `text-2xl` : `text-4xl`
              )}
            >
              {project.name}
            </h1>
            <TargetTechnologies
              technologies={technologies}
              showTooltip={true}
              className="h-6 w-6"
            />
          </div>
          {onViewInProjectGraph && viewInProjectGraphPosition === 'top' && (
            <ViewInProjectGraphButton
              callback={() =>
                onViewInProjectGraph({ projectName: project.name })
              }
            />
          )}
        </div>
        <div className="flex flex-wrap justify-between py-2">
          <div className="space-y-3">
            {projectData.metadata?.description ? (
              <p className="mb-2 text-sm capitalize text-gray-500 dark:text-slate-400">
                {projectData.metadata?.description}
              </p>
            ) : null}
            {(projectData.metadata as any)?.owners &&
            (projectData.metadata as any)?.owners.length ? (
              <p>
                <span className="font-medium">Owners:</span>
                {(projectData.metadata as any)?.owners.map((owner: any) => (
                  <Tooltip
                    openAction="hover"
                    content={(<OwnersTooltip owner={owner} />) as any}
                  >
                    <span className="ml-2 font-mono lowercase">
                      <Pill text={owner.id} color="green" />
                    </span>
                  </Tooltip>
                ))}
              </p>
            ) : null}
            {projectData.tags && projectData.tags.length ? (
              <p>
                <span className="font-medium">Tags:</span>
                {projectData.tags?.map((tag) => (
                  <span className="ml-2 font-mono lowercase">
                    <Pill text={tag} />
                  </span>
                ))}
              </p>
            ) : null}
            {projectData.root ? (
              <p>
                <span className="font-medium">Root:</span>
                <span className="font-mono"> {projectData.root.trim()}</span>
              </p>
            ) : null}
            {projectData.projectType ?? typeToProjectType[project.type] ? (
              <p>
                <span className="font-medium">Type:</span>
                <span className="ml-2 font-mono capitalize">
                  {projectData.projectType ?? typeToProjectType[project.type]}
                </span>
              </p>
            ) : null}
          </div>
          <div className="self-end">
            {onViewInProjectGraph &&
              viewInProjectGraphPosition === 'bottom' && (
                <ViewInProjectGraphButton
                  callback={() =>
                    onViewInProjectGraph({ projectName: project.name })
                  }
                />
              )}
          </div>
        </div>
      </header>
      <div>
        <h2 className={isCompact ? `mb-3 text-lg` : `mb-4 text-xl`}>
          <Tooltip
            openAction="hover"
            content={(<PropertyInfoTooltip type="targets" />) as any}
          >
            <span className="text-slate-800 dark:text-slate-200">
              <TooltipTriggerText>Targets</TooltipTriggerText>
            </span>
          </Tooltip>
        </h2>

        <TargetConfigurationGroupList
          className="w-full"
          project={project}
          sourceMap={sourceMap}
          variant={variant}
          onRunTarget={onRunTarget}
          onViewInTaskGraph={onViewInTaskGraph}
          connectedToCloud={connectedToCloud}
          onNxConnect={onNxConnect}
        />
      </div>
    </>
  );
};

export default ProjectDetails;

function ViewInProjectGraphButton({ callback }: { callback: () => void }) {
  return (
    <button
      className="inline-flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-base text-slate-600 ring-2 ring-inset ring-slate-400/40 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-800/60"
      onClick={() => callback()}
    >
      <EyeIcon className="h-5 w-5 "></EyeIcon>
      <span>View In Graph</span>
    </button>
  );
}

function getNxJsonContent() {
  return `{
  "$schema": "packages/nx/schemas/nx-schema.json",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
      "!{projectRoot}/tsconfig.spec.json",
      "!{projectRoot}/jest.config.[jt]s",
      "!{projectRoot}/.eslintrc.json",
      "!{projectRoot}/.storybook/**/*",
      "!{projectRoot}/**/*.stories.@(js|jsx|ts|tsx|mdx)",
      "!{projectRoot}/tsconfig.storybook.json",
      "!{projectRoot}/src/test-setup.[jt]s"
    ],
    "sharedGlobals": [
      "{workspaceRoot}/babel.config.json",
      "{workspaceRoot}/.nx/workflows/agents.yaml",
      "{workspaceRoot}/.circleci/config.yml"
    ],
    "native": [
      "{projectRoot}/**/*.rs",
      "{projectRoot}/**/Cargo.*",
      {
        "runtime": "node -p '\`\${process.platform}_\${process.arch}\`'"
      },
      {
        "externalDependencies": ["npm:@monodon/rust", "npm:@napi-rs/cli"]
      }
    ],
    "e2eInputs": [
      "default",
      "{workspaceRoot}/jest.preset.js",
      "{workspaceRoot}/.verdaccio/config.yml",
      "{workspaceRoot}/scripts/local-registry/**/*",
      "{workspaceRoot}/scripts/nx-release.ts",
      {
        "env": "SELECTED_CLI"
      },
      {
        "env": "SELECTED_PM"
      },
      {
        "env": "NX_E2E_CI_CACHE_KEY"
      },
      {
        "env": "CI"
      },
      {
        "env": "NX_E2E_RUN_E2E"
      }
    ]
  },
  "release": {
    "projects": [
      "packages/*",
      "packages/nx/native-packages/*",
      "packages-legacy/*"
    ],
    "releaseTagPattern": "{version}",
    "changelog": {
      "workspaceChangelog": {
        "createRelease": "github",
        "file": false
      },
      "git": {
        "commit": false,
        "stageChanges": false,
        "tag": false
      }
    },
    "version": {
      "generatorOptions": {
        "packageRoot": "build/packages/{projectName}",
        "currentVersionResolver": "registry",
        "skipLockFileUpdate": true
      },
      "git": {
        "commit": false,
        "stageChanges": false,
        "tag": false
      }
    }
  },
  "targetDefaults": {
    "nx-release-publish": {
      "options": {
        "packageRoot": "build/packages/{projectName}"
      }
    },
    "build": {
      "dependsOn": ["build-base", "build-native"],
      "inputs": ["production", "^production"],
      "cache": true
    },
    "build-native": {
      "inputs": ["native"],
      "cache": true
    },
    "build-base": {
      "dependsOn": ["^build-base", "build-native"],
      "inputs": ["production", "^production"],
      "executor": "@nx/js:tsc",
      "options": {
        "outputPath": "build/{projectRoot}",
        "tsConfig": "{projectRoot}/tsconfig.lib.json",
        "main": "{projectRoot}/index.ts"
      },
      "outputs": ["{options.outputPath}"],
      "cache": true
    },
    "test-native": {
      "inputs": ["native"],
      "executor": "@monodon/rust:test",
      "options": {},
      "cache": true
    },
    "test": {
      "dependsOn": ["test-native", "build-native", "^build-native"],
      "inputs": ["default", "^production", "{workspaceRoot}/jest.preset.js"],
      "options": {
        "args": ["--passWithNoTests", "--detectOpenHandles", "--forceExit"]
      }
    },
    "lint": {
      "dependsOn": ["build-native", "^build-native"]
    },
    "e2e": {
      "cache": true,
      "inputs": ["e2eInputs", "^production"]
    },
    "e2e-local": {
      "cache": true,
      "inputs": ["e2eInputs", "^production"]
    },
    "e2e-ci": {
      "inputs": ["e2eInputs", "^production"]
    },
    "e2e-macos-local": {
      "cache": true,
      "inputs": ["e2eInputs", "^production"],
      "parallelism": false
    },
    "e2e-macos-ci": {
      "inputs": ["e2eInputs", "^production"]
    },
    "e2e-ci--**/*": {
      "inputs": ["e2eInputs", "^production"],
      "parallelism": false,
      "dependsOn": ["@nx/nx-source:populate-local-registry-storage"]
    },
    "e2e-macos-ci--**/*": {
      "inputs": ["e2eInputs", "^production"],
      "parallelism": false,
      "dependsOn": ["@nx/nx-source:populate-local-registry-storage"]
    },
    "e2e-base": {
      "inputs": ["default", "^production"]
    },
    "build-storybook": {
      "inputs": [
        "default",
        "^production",
        "{workspaceRoot}/.storybook/**/*",
        "{projectRoot}/.storybook/**/*",
        "{projectRoot}/tsconfig.storybook.json"
      ],
      "cache": true
    },
    "build-ng": {
      "cache": true
    },
    "sitemap": {
      "cache": true
    },
    "copy-docs": {
      "cache": true
    }
  },
  "plugins": [
    "@monodon/rust",
    "@nx/powerpack-owners",
    {
      "plugin": "@nx/playwright/plugin",
      "options": {
        "targetName": "pw-e2e",
        "ciTargetName": "e2e-ci"
      }
    },
    {
      "plugin": "@nx/eslint/plugin",
      "exclude": ["packages/**/__fixtures__/**/*"],
      "options": {
        "targetName": "lint"
      }
    },
    {
      "plugin": "@nx/jest/plugin",
      "exclude": [
        "e2e/**/*",
        "packages/**/__fixtures__/**/*",
        "jest.config.ts"
      ],
      "options": {
        "targetName": "test"
      }
    },
    {
      "plugin": "@nx/webpack/plugin",
      "options": {
        "serveTargetName": "serve-base",
        "buildTargetName": "build-client"
      }
    },
    {
      "plugin": "@nx/jest/plugin",
      "include": ["e2e/**/*"],
      "exclude": ["e2e/detox/**/*", "e2e/react-native/**/*", "e2e/expo/**/*"],
      "options": {
        "targetName": "e2e-local",
        "ciTargetName": "e2e-ci"
      }
    },
    {
      "plugin": "@nx/jest/plugin",
      "include": ["e2e/detox/**/*", "e2e/react-native/**/*", "e2e/expo/**/*"],
      "options": {
        "targetName": "e2e-macos-local",
        "ciTargetName": "e2e-macos-ci"
      }
    }
  ],
  "owners": {
    "outputPath": "CODEOWNERS",
    "patterns": [
      {
        "description": "Test owners",
        "files": ["**/.eslintrc.json"],
        "owners": ["@JamesHenry"]
      }
    ]
  },
  "nxCloudId": "62d013ea0852fe0a2df74438",
  "nxCloudUrl": "https://staging.nx.app",
  "parallel": 1,
  "cacheDirectory": "/tmp/nx-cache",
  "bust": 8,
  "defaultBase": "master"
}
`;
}

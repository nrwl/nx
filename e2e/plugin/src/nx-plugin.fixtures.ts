export const ASYNC_GENERATOR_EXECUTOR_CONTENTS = `import { ExecutorContext } from '@nx/devkit';

async function* asyncGenerator(
) {
  for (let i = 5; i < 10; i++) {
    yield new Promise((res) => setTimeout(() => res({ success: true }), 5));
  }
  yield { success: true };
}

export default async function* execute(
  options: unknown,
  context: ExecutorContext
) {
  for (let i = 5; i < 10; i++) {
    yield new Promise((res) => setTimeout(() => res({ success: true }), 5));
  }
  yield* asyncGenerator();
}
`;

export const NX_PLUGIN_V2_CONTENTS = `import { basename, dirname } from "path";
import { CreateNodesV2, CreateMetadata, ProjectsMetadata } from "@nx/devkit";

type PluginOptions = {
    inferredTags: string[]
}

export const createMetadata: CreateMetadata = (graph) => {
  const metadata: ProjectsMetadata = {};
  for (const projectNode of Object.values(graph.nodes)) {
    metadata[projectNode.name] = {
        metadata: {
            technologies: ["my-plugin"]
        }
    }
  }
  return metadata;
}

export const createNodesV2: CreateNodesV2<PluginOptions> = [
  "**/my-project-file",
  (files, options, ctx) => {
    const results = [];
    for (const f of files) {
      // f = path/to/my/file/my-project-file
      const root = dirname(f);
      // root = path/to/my/file
      const name = basename(root);
      // name = file

      results.push([
        f,
        {
          projects: {
            [root]: {
              root,
              name,
              targets: {
                build: {
                  executor: "nx:run-commands",
                  options: {
                    command: "echo 'custom registered target'",
                  },
                },
              },
              tags: options.inferredTags,
            },
          },
        },
      ]);
    }
    return results;
  },
];

`;

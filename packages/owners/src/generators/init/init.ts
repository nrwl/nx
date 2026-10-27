import {
  formatFiles,
  output,
  Tree,
  updateJson,
  workspaceRoot,
} from '@nx/devkit';
import { execSync } from 'node:child_process';

export async function initGenerator(tree: Tree) {
  updateJson(tree, 'nx.json', (json) => {
    // Add the project graph plugin so that the owners metadata is added to the graph
    json.plugins = json.plugins || [];
    const pluginName = '@nx/owners';
    if (
      !json.plugins.some((p) => {
        if (typeof p === 'string') {
          return p === pluginName;
        }
        return p.plugin === pluginName;
      })
    ) {
      json.plugins.push('@nx/owners');
    }

    // Add the global sync generator explicitly until there is an API for the plugin to use to apply it automatically
    json.sync = json.sync || {};
    json.sync.globalGenerators = (json.sync.globalGenerators || []).concat(
      '@nx/owners:sync-codeowners-file'
    );

    // Add the owners key to the nx.json file and infer any initial settings
    json.owners = json.owners || {};

    // Infer the correct format from the workspace's tree/git remote data
    if (!json.owners.format) {
      if (tree.exists('.github')) {
        json.owners.format = 'github';
      } else if (tree.exists('.bitbucket')) {
        json.owners.format = 'bitbucket';
      } else if (tree.exists('.gitlab')) {
        json.owners.format = 'gitlab';
      } else {
        const vcsProvider = inferRepoVCSProvider();
        if (vcsProvider !== 'unknown') {
          json.owners.format = vcsProvider;
        } else {
          output.warn({
            title: `Warning: Could not infer the VCS provider for this workspace`,
            bodyLines: [
              'Please set the owners.format property in nx.json to "github", "gitlab", or "bitbucket".',
            ],
          });
        }
      }
    }
    if (json.owners.format === 'gitlab') {
      // GitLab only feature
      json.owners.sections = json.owners.sections || [];
    }

    json.owners.patterns = json.owners.patterns || [];

    // If the CODEOWNERS file exists, and no existing value is present, set the outputPath to CODEOWNERS
    if (tree.exists('CODEOWNERS')) {
      json.owners.outputPath = json.owners.outputPath || 'CODEOWNERS';
    }

    return json;
  });

  await formatFiles(tree);
}

export default initGenerator;

function inferRepoVCSProvider(): 'github' | 'gitlab' | 'bitbucket' | 'unknown' {
  try {
    const remoteOutput = execSync('git remote -v', {
      encoding: 'utf-8',
      windowsHide: true,
    });
    for (const line of remoteOutput.split('\n')) {
      if (line.includes('(fetch)')) {
        const url = line.split(/\s+/)[1].toLowerCase();
        if (url.includes('github.com')) {
          return 'github';
        }
        if (url.includes('gitlab.com')) {
          return 'gitlab';
        }
        if (url.includes('bitbucket.org')) {
          return 'bitbucket';
        }
      }
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

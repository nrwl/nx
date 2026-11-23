import { dump, load } from '@zkochan/js-yaml';
import { readFileSync, writeFileSync } from 'fs';

interface PnpmWorkspace {
  catalogs: { angular: Record<string, string> };
}

function isPnpmWorkspace(value: unknown): value is PnpmWorkspace {
  if (typeof value !== 'object' || value === null || !('catalogs' in value)) {
    return false;
  }
  const { catalogs } = value;
  return (
    typeof catalogs === 'object' &&
    catalogs !== null &&
    'angular' in catalogs &&
    typeof catalogs.angular === 'object' &&
    catalogs.angular !== null
  );
}

function updatePnpmCatalogDefinitions(
  packageVersionMap: Map<string, string>,
  isPrerelease: boolean
) {
  const pnpmWorkspaceYaml = readFileSync('pnpm-workspace.yaml', 'utf-8');
  const workspaceData = load(pnpmWorkspaceYaml);
  if (!isPnpmWorkspace(workspaceData)) {
    throw new Error('pnpm-workspace.yaml has no catalogs.angular entry');
  }

  for (const [pkgName, version] of packageVersionMap.entries()) {
    const versionToUse = isPrerelease ? version : `~${version}`;
    if (workspaceData.catalogs.angular[pkgName]) {
      workspaceData.catalogs.angular[pkgName] = versionToUse;
    }
  }

  writeFileSync(
    'pnpm-workspace.yaml',
    dump(workspaceData, {
      indent: 2,
      quotingType: '"',
      forceQuotes: true,
    }),
    'utf-8'
  );
}

export async function updatePackageDependencies(
  packageVersionMap: Map<string, string>,
  isPrerelease: boolean
) {
  console.log('⏳ - Updating Pnpm Catalog definitions...');
  updatePnpmCatalogDefinitions(packageVersionMap, isPrerelease);
  console.log('✅ - Updated Pnpm Catalog definitions');
}

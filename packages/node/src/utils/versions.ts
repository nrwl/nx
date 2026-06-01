import { type Tree } from '@nx/devkit';
import {
  getDeclaredPackageVersion,
  getInstalledPackageVersion,
} from '@nx/devkit/internal';
import { major } from 'semver';

export const nxVersion = require('../../package.json').version;

export const tslibVersion = '^2.3.0';

// `@types/node` — supported window covers the active LTS majors (currently v22
// and v24). Fresh installs default to the active LTS (v22).
export const minSupportedNodeTypesVersion = '22.0.0';
export const typesNodeVersion = '^22.0.0';

type NodeTypesVersions = {
  typesNodeVersion: string;
};
const nodeTypesLatest: NodeTypesVersions = { typesNodeVersion };
type NodeTypesCompatMajors = 22 | 24;
const nodeTypesVersionMap: Record<NodeTypesCompatMajors, NodeTypesVersions> = {
  22: { typesNodeVersion: '^22.0.0' },
  24: { typesNodeVersion: '^24.0.0' },
};

export function nodeTypesVersions(tree: Tree): NodeTypesVersions {
  const installed = getInstalledNodeTypesVersion(tree);
  if (!installed) {
    return nodeTypesLatest;
  }
  const m = major(installed);
  return nodeTypesVersionMap[m as NodeTypesCompatMajors] ?? nodeTypesLatest;
}

export function getInstalledNodeTypesVersion(tree?: Tree): string | null {
  if (!tree) {
    return getInstalledPackageVersion('@types/node');
  }
  return getDeclaredPackageVersion(tree, '@types/node');
}

// Express — support window v4 + v5 (v4 in MAINT through 2026-10-01, v5 ACTIVE).
export const minSupportedExpressVersion = '4.0.0';
export const expressVersion = '^5.1.0';
export const expressTypingsVersion = '^5.0.0';

type ExpressVersions = {
  expressVersion: string;
  expressTypingsVersion: string;
};
const expressLatest: ExpressVersions = {
  expressVersion,
  expressTypingsVersion,
};
type ExpressCompatMajors = 4;
const expressVersionMap: Record<ExpressCompatMajors, ExpressVersions> = {
  4: {
    expressVersion: '^4.21.2',
    expressTypingsVersion: '^4.17.21',
  },
};

export function expressVersions(tree: Tree): ExpressVersions {
  const installed = getInstalledExpressVersion(tree);
  if (!installed) {
    return expressLatest;
  }
  const m = major(installed);
  return expressVersionMap[m as ExpressCompatMajors] ?? expressLatest;
}

export function getInstalledExpressVersion(tree?: Tree): string | null {
  if (!tree) {
    return getInstalledPackageVersion('express');
  }
  return getDeclaredPackageVersion(tree, 'express');
}

// Koa — no upstream LTS policy; support window v2 + v3 (Rule 2: N & N-1).
export const minSupportedKoaVersion = '2.0.0';
export const koaVersion = '^3.1.2';
export const koaTypingsVersion = '^3.0.0';

type KoaVersions = {
  koaVersion: string;
  koaTypingsVersion: string;
};
const koaLatest: KoaVersions = { koaVersion, koaTypingsVersion };
type KoaCompatMajors = 2;
const koaVersionMap: Record<KoaCompatMajors, KoaVersions> = {
  2: {
    koaVersion: '^2.14.1',
    koaTypingsVersion: '^2.13.5',
  },
};

export function koaVersions(tree: Tree): KoaVersions {
  const installed = getInstalledKoaVersion(tree);
  if (!installed) {
    return koaLatest;
  }
  const m = major(installed);
  return koaVersionMap[m as KoaCompatMajors] ?? koaLatest;
}

export function getInstalledKoaVersion(tree?: Tree): string | null {
  if (!tree) {
    return getInstalledPackageVersion('koa');
  }
  return getDeclaredPackageVersion(tree, 'koa');
}

// Fastify — upstream "last 2 majors" policy. Support window v4 + v5.
export const minSupportedFastifyVersion = '4.0.0';
export const fastifyVersion = '~5.2.1';
export const fastifyAutoloadVersion = '~6.0.3';
export const fastifySensibleVersion = '~6.0.2';
export const fastifyPluginVersion = '~5.0.1';

type FastifyVersions = {
  fastifyVersion: string;
  fastifyAutoloadVersion: string;
  fastifySensibleVersion: string;
  fastifyPluginVersion: string;
};
const fastifyLatest: FastifyVersions = {
  fastifyVersion,
  fastifyAutoloadVersion,
  fastifySensibleVersion,
  fastifyPluginVersion,
};
type FastifyCompatMajors = 4;
const fastifyVersionMap: Record<FastifyCompatMajors, FastifyVersions> = {
  4: {
    fastifyVersion: '~4.28.1',
    fastifyAutoloadVersion: '~5.10.0',
    fastifySensibleVersion: '~5.6.0',
    fastifyPluginVersion: '~4.5.1',
  },
};

export function fastifyVersions(tree: Tree): FastifyVersions {
  const installed = getInstalledFastifyVersion(tree);
  if (!installed) {
    return fastifyLatest;
  }
  const m = major(installed);
  return fastifyVersionMap[m as FastifyCompatMajors] ?? fastifyLatest;
}

export function getInstalledFastifyVersion(tree?: Tree): string | null {
  if (!tree) {
    return getInstalledPackageVersion('fastify');
  }
  return getDeclaredPackageVersion(tree, 'fastify');
}

export const axiosVersion = '^1.6.0';

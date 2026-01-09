import type { SourceFile } from 'typescript';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

export type IsHostRemoteConfigResult = 'host' | 'remote' | 'both' | false;

const REMOTES_EXPRESSION_SELECTOR =
  'PropertyAssignment:has(Identifier[name=remotes]) > ObjectLiteralExpression';
const EXPOSES_EXPRESSION_SELECTOR =
  'PropertyAssignment:has(Identifier[name=exposes]) > ObjectLiteralExpression';
const PROPERTY_SELECTOR = 'ObjectLiteralExpression > PropertyAssignment';

export function isHostRemoteConfig(
  sourceFile: SourceFile
): IsHostRemoteConfigResult {
  let isHost = false;
  let isRemote = false;
  ensureTypescript();
  const { query } = require('@phenomnomnominal/tsquery');

  const remotesNodes = query(sourceFile, REMOTES_EXPRESSION_SELECTOR);
  if (remotesNodes.length > 0) {
    isHost = true;
  }

  const exposesNodes = query(sourceFile, EXPOSES_EXPRESSION_SELECTOR);
  if (exposesNodes.length > 0) {
    isRemote = true;
  }

  let result: IsHostRemoteConfigResult =
    isHost && isRemote ? 'both' : isHost ? 'host' : isRemote ? 'remote' : false;
  return result;
}

export function getRemotesFromHost(sourceFile: SourceFile) {
  ensureTypescript();
  const { query } = require('@phenomnomnominal/tsquery');
  const remotesObjectNodes = query(sourceFile, REMOTES_EXPRESSION_SELECTOR);
  if (remotesObjectNodes.length === 0) {
    return [];
  }

  const remotesNodes = query(remotesObjectNodes[0], PROPERTY_SELECTOR);

  if (remotesNodes.length === 0) {
    return [];
  }

  const remotes = [];
  for (const remoteNode of remotesNodes) {
    const remoteText = remoteNode.getText();
    const remoteParts = remoteText
      .split(':')
      .map((part) => part.trim().replace(/'/g, ''));
    const remoteName = remoteParts.shift();
    const remoteLocation = remoteParts.join(':').replace(/\/[^\/]+$/, '');
    remotes.push([remoteName, remoteLocation]);
  }
  return remotes;
}

export function getExposedModulesFromRemote(sourceFile: SourceFile) {
  ensureTypescript();
  const { query } = require('@phenomnomnominal/tsquery');
  const exposesObjectNodes = query(sourceFile, EXPOSES_EXPRESSION_SELECTOR);
  if (exposesObjectNodes.length === 0) {
    return {};
  }

  return exposesObjectNodes[0].getText();
}

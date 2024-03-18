import { getGraphService } from './machines/graph.service';

export const localStorageRankDirKey = 'nx-dep-graph-rankdir';
export type RankDir = 'TB' | 'LR';
export let currentRankDir: RankDir;

export function rankDirInit() {
  const rankDir =
    (localStorage.getItem(localStorageRankDirKey) as RankDir) ?? 'TB';
  rankDirResolver(rankDir);
}

export function rankDirResolver(rankDir: RankDir) {
  currentRankDir = rankDir;
  localStorage.setItem(localStorageRankDirKey, rankDir);
  getGraphService().rankDir = currentRankDir;
}

export function selectValueByRankDirDynamic<T>(
  topBottomSetting: T,
  leftRightSetting: T
): () => T {
  return () => selectValueByRankDirStatic(topBottomSetting, leftRightSetting);
}

// The function exists because some places do not support selectDynamically
// It also prevents the dynamic change of rankDir for certain elements like tippy
export function selectValueByRankDirStatic<T>(
  topBottomSetting: T,
  leftRightSetting: T
): T {
  return currentRankDir === 'TB' ? topBottomSetting : leftRightSetting;
}

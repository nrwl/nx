import { setOutput } from '@actions/core';
import { ensureDirSync, readJsonSync, writeJsonSync } from 'fs-extra';
import isCI from 'is-ci';
import { dirname, join } from 'path';
import { formatGhReport, getSlackMessageJson } from './format-slack-message';
import { ReportData, ScopeData, TrendData } from './model';
import { getScopeLabels, scrapeIssues } from './scrape-issues';

const CACHE_FILE = join(__dirname, 'cached', 'data.json');

async function main() {
  const oldData = getOldData();
  const currentData = await scrapeIssues(
    oldData.collectedDate ? new Date(oldData.collectedDate) : undefined
  );
  const trendData = getTrendData(currentData, oldData);
  const formatted = formatGhReport(
    currentData,
    trendData,
    oldData,
    getUnlabeledIssuesUrl(await getScopeLabels())
  );
  if (process.env.GITHUB_ACTIONS) {
    setOutput('SLACK_MESSAGE', getSlackMessageJson(formatted));
  }
  console.log(formatted.replace(/\<(.*)\|(.*)\>/g, '[$2]($1)'));
  saveCacheData(currentData);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

function getUnlabeledIssuesUrl(scopeLabels: string[]) {
  const labelFilters = scopeLabels.map((s) => `-label:"${s}"`);
  return `https://github.com/nrwl/nx/issues/?q=is%3Aopen+is%3Aissue+sort%3Aupdated-desc+${encodeURIComponent(
    labelFilters.join(' ')
  )}`;
}

function getTrendData(newData: ReportData, oldData: ReportData): TrendData {
  const scopeTrends: Record<string, Partial<ScopeData>> = {};
  for (const [scope, data] of Object.entries(newData.scopes)) {
    scopeTrends[scope] ??= {};
    scopeTrends[scope].count = data.count - (oldData.scopes[scope]?.count ?? 0);
    scopeTrends[scope].bugCount =
      data.bugCount - (oldData.scopes[scope]?.bugCount ?? 0);
    scopeTrends[scope].closed =
      data.closed - (oldData.scopes[scope]?.closed ?? 0);
  }
  return {
    scopes: scopeTrends as Record<string, ScopeData>,
    totalBugCount: newData.totalBugCount - oldData.totalBugCount,
    totalIssueCount: newData.totalIssueCount - oldData.totalIssueCount,
    totalClosed: newData.totalClosed - oldData.totalClosed,
    untriagedIssueCount:
      newData.untriagedIssueCount - oldData.untriagedIssueCount,
  };
}

function saveCacheData(report: ReportData) {
  if (isCI) {
    ensureDirSync(dirname(CACHE_FILE));
    writeJsonSync(CACHE_FILE, report);
  }
}

function getOldData(): ReportData {
  try {
    return readJsonSync(CACHE_FILE);
  } catch (e) {
    return {
      scopes: {},
      totalBugCount: 0,
      totalIssueCount: 0,
      untriagedIssueCount: 0,
      totalClosed: 0,
    };
  }
}

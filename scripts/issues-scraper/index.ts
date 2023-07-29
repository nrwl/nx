import { ensureDirSync, readJsonSync, writeJsonSync } from 'fs-extra';
import { dirname, join } from 'path';
import { ReportData, ScopeData, TrendData } from './model';
import { getScopeLabels, scrapeIssues } from './scrape-issues';
import { formatGhReport, getSlackMessageJson } from './format-slack-message';
import { setOutput } from '@actions/core';
import isCI from 'is-ci';
import { readdirSync } from 'fs';

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
  setOutput('SLACK_MESSAGE', getSlackMessageJson(formatted));
  console.log(formatted.replace(/\<(.*)\|(.*)\>/g, '[$1]($0)'));
  saveCacheData(currentData);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
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
    totalClosed: newData.totalClosed - oldData.totalClosed ?? 0,
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
    console.log('DIR CONTENTS:', readdirSync(dirname(CACHE_FILE)));
    return readJsonSync(CACHE_FILE);
  } catch (e) {
    console.log(e);
    return {
      scopes: {},
      totalBugCount: 0,
      totalIssueCount: 0,
      untriagedIssueCount: 0,
      totalClosed: 0,
    };
  }
}

function getUnlabeledIssuesUrl(scopeLabels: string[]) {
  const labelFilters = scopeLabels.map((s) => `-label:"${s}"`);
  return `https://github.com/nrwl/nx/issues/?q=is%3Aopen+is%3Aissue+sort%3Aupdated-desc+${encodeURIComponent(
    labelFilters.join(' ')
  )}`;
}

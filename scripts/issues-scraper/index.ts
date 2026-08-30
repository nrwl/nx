import { setOutput, summary } from '@actions/core';
import { ensureDirSync, readJsonSync, writeJsonSync } from 'fs-extra';
import isCI from 'is-ci';
import { dirname, join } from 'path';
import {
  formatGhReport,
  getSlackMessageJson,
  toMarkdown,
  toSlackSections,
} from './format-slack-message';
import { ReportData } from './model';
import { getScopeLabels, scrapeIssues } from './scrape-issues';
import { getTrendData } from './stats';

const CACHE_FILE = join(__dirname, 'cached', 'data.json');

async function main() {
  const oldData = getOldData();
  const currentData = await scrapeIssues(
    oldData.collectedDate ? new Date(oldData.collectedDate) : undefined
  );
  const trendData = getTrendData(currentData, oldData);
  const scopeLabels = await getScopeLabels();
  const report = formatGhReport(currentData, trendData, oldData, {
    unlabeledIssuesUrl: getUnlabeledUrl('issue', scopeLabels),
    unlabeledPrsUrl: getUnlabeledUrl('pr', scopeLabels),
  });
  const markdown = toMarkdown(report);
  if (process.env.GITHUB_ACTIONS) {
    setOutput(
      'SLACK_MESSAGE',
      getSlackMessageJson(report.title, toSlackSections(report))
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    await summary.addRaw(markdown).write();
  }
  console.log(markdown);
  saveCacheData(currentData);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

function getUnlabeledUrl(type: 'issue' | 'pr', scopeLabels: string[]) {
  const labelFilters = scopeLabels.map((s) => `-label:"${s}"`);
  const path = type === 'issue' ? 'issues' : 'pulls';
  return `https://github.com/nrwl/nx/${path}?q=is%3Aopen+is%3A${type}+sort%3Aupdated-desc+${encodeURIComponent(
    labelFilters.join(' ')
  )}`;
}

function saveCacheData(report: ReportData) {
  if (isCI) {
    ensureDirSync(dirname(CACHE_FILE));
    writeJsonSync(CACHE_FILE, report);
  }
}

function getOldData(): Partial<ReportData> {
  try {
    return readJsonSync(CACHE_FILE);
  } catch (e) {
    return {};
  }
}

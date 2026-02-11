import { readFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { workspaceRoot } from '../utils/workspace-root';
import { AnalyticsCollector } from './analytics-collector';

async function main() {
  const analyticsBufferFile = join(
    workspaceRoot,
    '.nx',
    'workspace-data',
    'analytics.json'
  );

  if (!existsSync(analyticsBufferFile)) {
    return;
  }

  const serialized = readFileSync(analyticsBufferFile, 'utf-8');

  // Clean up immediately to prevent duplicate sends
  unlinkSync(analyticsBufferFile);

  const collector = AnalyticsCollector.fromSerialized(serialized);
  await collector.flush();
}

main().catch(() => {
  process.exit(0);
});

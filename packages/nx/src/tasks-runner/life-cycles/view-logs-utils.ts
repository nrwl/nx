import { readNxJson } from '../../config/nx-json';
import { isNxCloudUsed } from '../../utils/nx-cloud-utils';
import { output } from '../../utils/output';

const VIEW_LOGS_MESSAGE = `Hint: Try "nx view-logs" to get structured, searchable errors logs in your browser.`;

export function viewLogsFooterRows(failedTasks: number) {
  const [isCloudUsed, _] = isNxCloudUsed(readNxJson());
  if (failedTasks >= 2 && !isCloudUsed) {
    return [``, output.dim(` ${VIEW_LOGS_MESSAGE}`)];
  } else {
    return [];
  }
}

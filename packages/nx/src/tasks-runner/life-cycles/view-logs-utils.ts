import { readNxJson } from '../../config/nx-json.js';
import { isNxCloudUsed } from '../../utils/nx-cloud-utils.js';
import { output } from '../../utils/output.js';

const VIEW_LOGS_MESSAGE = `Hint: Try "nx view-logs" to get structured, searchable errors logs in your browser.`;

export function viewLogsFooterRows(failedTasks: number) {
  if (failedTasks >= 2 && !isNxCloudUsed(readNxJson())) {
    return [``, output.dim(` ${VIEW_LOGS_MESSAGE}`)];
  } else {
    return [];
  }
}

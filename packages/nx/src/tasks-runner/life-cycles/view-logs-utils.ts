import { isNxCloudUsed } from '../../utils/nx-cloud-utils';
import { output } from '../../utils/output';

const VIEW_LOGS_MESSAGE = `Hint: Try "nx view-logs" to get structured, searchable errors logs in your browser.`;

export function viewLogsFooterRows(failedTasks: number) {
  if (failedTasks >= 2 && !isNxCloudUsed()) {
    return [``, output.dim(`${output.X_PADDING} ${VIEW_LOGS_MESSAGE}`)];
  } else {
    return [];
  }
}

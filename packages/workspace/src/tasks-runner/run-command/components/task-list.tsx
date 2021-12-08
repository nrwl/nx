import { Box, Text } from 'ink';
import * as React from 'react';
import type { TaskListItem } from './run-many';
import { TaskRow } from './task-row';

interface TaskListProps {
  taskList: TaskListItem[];
}

export function TaskList({ taskList }: TaskListProps) {
  const pendingTasks = taskList.filter((task) => task.status === 'pending');
  const runningTasks = taskList.filter((task) => task.status === 'loading');
  const successfulTasks = taskList.filter((task) => task.status === 'success');
  const locallyCachedTasks = successfulTasks.filter(
    (task) => task.additionalStatusText === 'from local cache'
  );
  const cloudCachedTasks = successfulTasks.filter(
    (task) => task.additionalStatusText === 'from cloud cache'
  );
  const failedTasks = taskList.filter((task) => task.status === 'failure');
  const numCompletedTasks = successfulTasks.length + failedTasks.length;

  return (
    <Box paddingLeft={5} flexDirection="column">
      {runningTasks.length > 0 && (
        <Box marginY={1}>
          <Text color="grey" dimColor={false}>{`Executing ${
            runningTasks.length
          }/${
            pendingTasks.length + runningTasks.length
          } remaining tasks in parallel...`}</Text>
        </Box>
      )}

      <Box flexDirection="column" marginBottom={1}>
        {runningTasks.map((task) => (
          <TaskRow
            key={task.projectName}
            label={task.projectName}
            status={task.status}
            additionalStatusText={task.additionalStatusText}
            muted={false}
            spinnerType="dots"
          />
        ))}
      </Box>

      <Box flexDirection="row">
        {successfulTasks.length !== taskList.length && (
          <Box>
            {successfulTasks.length > 0 && (
              <TaskRow
                key="successful"
                label={`${successfulTasks.length}/${numCompletedTasks} succeeded`}
                status="success"
                additionalStatusText=""
                muted={failedTasks.length > 0}
                spinnerType="dots"
              />
            )}
          </Box>
        )}

        {failedTasks.length !== taskList.length && (
          <Box marginLeft={successfulTasks.length > 0 ? 4 : 0}>
            {failedTasks.length > 0 && (
              <TaskRow
                key="failed"
                label={`${failedTasks.length}/${numCompletedTasks} failed (see output above)`}
                status="failure"
                additionalStatusText=""
                muted={false}
                spinnerType="dots"
              />
            )}
          </Box>
        )}
      </Box>

      {pendingTasks.length === 0 &&
        successfulTasks.length === taskList.length &&
        (locallyCachedTasks.length > 0 || cloudCachedTasks.length > 0) && (
          <Box marginTop={2}>
            {locallyCachedTasks.length > 0 && (
              <TaskRow
                key="local-cache"
                label={`${locallyCachedTasks.length} results retrieved from local cache`}
                status="cache"
                additionalStatusText=""
                muted={false}
                spinnerType="dots"
              />
            )}

            {cloudCachedTasks.length > 0 && (
              <TaskRow
                key="remote-cache"
                label={`${cloudCachedTasks.length} results retrieved from cloud cache`}
                status="remote-cache"
                additionalStatusText=""
                muted={false}
                spinnerType="dots"
              />
            )}
          </Box>
        )}
    </Box>
  );
}

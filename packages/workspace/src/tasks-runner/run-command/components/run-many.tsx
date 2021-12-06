import { Box, Static, Text } from 'ink';
import * as React from 'react';
import { useEffect, useState } from 'react';
import type { ExtendedTaskStatus } from '../../life-cycle';
import { NxOutputRowTitle } from './nx-output-row-title';
import type { TasksState } from './run-command';
import { TaskList } from './task-list';

export interface TaskListItem {
  projectName: string;
  status: ExtendedTaskStatus;
  additionalStatusText: string;
  output: string;
}

interface RunManyProps {
  tasksState: TasksState;
}

export function RunMany({ tasksState }: RunManyProps) {
  const [taskList, setTaskList] = useState<TaskListItem[]>(
    tasksState.projectNames.map((projectName) => ({
      projectName,
      status: 'pending',
      additionalStatusText: '',
      output: '',
    }))
  );

  useEffect(() => {
    if (!tasksState.taskResults) {
      return;
    }
    setTaskList((state) => {
      return state.map((task) => {
        const taskResult = tasksState.taskResults.find(
          (tr) => tr.task.target.project === task.projectName
        );
        if (!taskResult) {
          return task;
        }
        switch (taskResult.status) {
          case 'cache':
            return {
              ...task,
              status: 'success',
              additionalStatusText: 'from cache',
            };
          case 'success':
            return {
              ...task,
              status: 'success',
              additionalStatusText: '',
            };
          case 'failure':
            return {
              ...task,
              status: 'failure',
              additionalStatusText: '',
              output: taskResult.terminalOutput,
            };
          default:
            return task;
        }
      });
    });
  }, [tasksState.taskResults]);

  useEffect(() => {
    if (!tasksState.tasks) {
      return;
    }
    setTaskList((state) => {
      return state.map((task) => {
        const matchedRunningTask = tasksState.tasks.find(
          (t) => t.target.project === task.projectName
        );
        if (!matchedRunningTask || task.status !== 'pending') {
          return task;
        }
        return {
          ...task,
          status: 'loading',
        };
      });
    });
  }, [tasksState.tasks]);

  const isEveryTaskSuccessfullyComplete = taskList.every(
    (task) => task.status === 'success'
  );

  const failedTasks: { projectName: string; output: string }[] =
    taskList.filter((task) => task.status === 'failure');

  return (
    <>
      <Static items={failedTasks}>
        {(task, i) => (
          <Box
            key={task.projectName}
            marginTop={1}
            flexDirection="column"
            marginX={2}
          >
            <Box flexDirection="column">
              <Text
                bold={true}
                color="red"
              >{`> nx run ${task.projectName}:${tasksState.target}`}</Text>

              <Box marginLeft={2}>
                <Text>{task.output}</Text>
              </Box>
            </Box>

            {i === failedTasks.length - 1 && (
              <Box marginY={1}>
                <Text color="gray" dimColor={true}>
                  {
                    '———————————————————————————————————————————————————————————————————————'
                  }
                </Text>
              </Box>
            )}
          </Box>
        )}
      </Static>

      <Box marginTop={1} marginX={2}>
        <RunManyTitle
          tasksState={tasksState}
          taskList={taskList}
        ></RunManyTitle>
      </Box>

      <Box marginBottom={!isEveryTaskSuccessfullyComplete ? 2 : 0}>
        <TaskList taskList={taskList}></TaskList>
      </Box>
    </>
  );
}

function RunManyTitle({
  tasksState,
  taskList,
}: {
  tasksState: TasksState;
  taskList: TaskListItem[];
}) {
  const isEveryTaskComplete = taskList.every(
    (task) => task.status === 'success' || task.status === 'failure'
  );

  if (!isEveryTaskComplete) {
    return (
      <NxOutputRowTitle>
        <Text dimColor color="white">
          Running target{' '}
        </Text>
        <Text bold color="white">
          {tasksState.target}
        </Text>
        <Text dimColor color="white">
          {' '}
          for{' '}
        </Text>
        <Text bold color="white">
          {tasksState.projectNames.length} project(s):
        </Text>
      </NxOutputRowTitle>
    );
  }

  const isEveryTaskSuccessfullyComplete = taskList.every(
    (task) => task.status === 'success'
  );

  if (isEveryTaskSuccessfullyComplete) {
    return (
      <NxOutputRowTitle success={true}>
        <Text dimColor color="green">
          Successfully ran{' '}
        </Text>
        <Text bold color="green">
          {tasksState.target}
        </Text>
        <Text dimColor color="green">
          {' '}
          for{' '}
        </Text>
        <Text bold color="green">
          {tasksState.projectNames.length} project(s)
        </Text>
      </NxOutputRowTitle>
    );
  }

  return (
    <NxOutputRowTitle>
      <Text dimColor color="white">
        Ran target{' '}
      </Text>
      <Text bold color="white">
        {tasksState.target}
      </Text>
      <Text dimColor color="white">
        {' '}
        for{' '}
      </Text>
      <Text bold color="white">
        {tasksState.projectNames.length} project(s)
      </Text>
    </NxOutputRowTitle>
  );
}

import { Text, useApp } from 'ink';
import * as React from 'react';
import { useState } from 'react';
import { TaskResult } from '../../life-cycle';
import { Task } from '../../tasks-runner';
import { InkRunManyLifeCycle } from '../ink-run-many-life-cycle';
import { NoTargetsRun } from './no-targets-run';
import { RunMany } from './run-many';

type RunCommandState = 'INIT' | 'NO_TARGETS_RUN' | 'RUN_MANY';

export interface TasksState {
  target: string;
  projectNames: string[];
  tasks: Task[];
  taskResults: TaskResult[];
  tasksToTerminalOutputs: { [taskId: string]: string };
}

export function RunCommandComponent({
  lifeCycle,
}: {
  lifeCycle: InkRunManyLifeCycle;
}) {
  const [runCommandState, setRunCommandState] =
    useState<RunCommandState>('INIT');
  const [onStartCommandParamsState, setOnStartCommandParamsState] =
    useState(null);
  const [tasksState, setTasksState] = useState<TasksState | null>(null);
  const { exit } = useApp();

  lifeCycle.callbacks.onStartCommand = (params) => {
    setOnStartCommandParamsState(params);
    if (params.projectNames.length <= 0) {
      setRunCommandState('NO_TARGETS_RUN');
      return exit();
    }
    setTasksState({
      target: params.args.target,
      projectNames: params.projectNames,
      tasks: null,
      taskResults: null,
      tasksToTerminalOutputs: {},
    });
    setRunCommandState('RUN_MANY');
  };

  lifeCycle.callbacks.onStartTasks = (tasks) => {
    setTasksState((state) => ({
      ...state,
      tasks: [...(state.tasks || []), ...tasks],
    }));
  };

  lifeCycle.callbacks.onEndTasks = (taskResults) => {
    setTasksState((state) => ({
      ...state,
      taskResults: [...(state.taskResults || []), ...taskResults],
    }));
  };

  lifeCycle.callbacks.onPrintTaskTerminalOutput = (
    task,
    _cacheStatus,
    output
  ) => {
    setTasksState((state) => ({
      ...state,
      tasksToTerminalOutputs: {
        ...state.tasksToTerminalOutputs,
        [task.id]: output,
      },
    }));
  };

  function clearTaskOutputCacheForTaskId(taskId: string) {
    setTasksState((state) => {
      const updatedTasksToTerminalOutputs = {
        ...state.tasksToTerminalOutputs,
      };
      delete updatedTasksToTerminalOutputs[taskId];
      return {
        ...state,
        tasksToTerminalOutputs: updatedTasksToTerminalOutputs,
      };
    });
  }

  switch (runCommandState) {
    case 'NO_TARGETS_RUN':
      return <NoTargetsRun onStartCommandParams={onStartCommandParamsState} />;
    case 'RUN_MANY':
      return (
        <RunMany
          tasksState={tasksState}
          clearTaskOutputCacheForTaskId={clearTaskOutputCacheForTaskId}
        />
      );
    default:
      return <Text>{''}</Text>;
  }
}

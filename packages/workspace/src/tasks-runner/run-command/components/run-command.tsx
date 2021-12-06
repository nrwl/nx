import { Text, useApp } from 'ink';
import * as React from 'react';
import { useState } from 'react';
import { CompositeLifeCycle, LifeCycle, TaskResult } from '../../life-cycle';
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
}

export function RunCommandComponent({
  lifeCycle,
}: {
  lifeCycle: LifeCycle | CompositeLifeCycle;
}) {
  const [runCommandState, setRunCommandState] =
    useState<RunCommandState>('INIT');
  const [onStartCommandParamsState, setOnStartCommandParamsState] =
    useState(null);
  const [tasksState, setTasksState] = useState<TasksState | null>(null);
  const { exit } = useApp();

  const { callbacks } = getInkRunManyLifeCycleInstance(lifeCycle);

  callbacks.onStartCommand = (params) => {
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
    });
    setRunCommandState('RUN_MANY');
  };

  callbacks.onStartTasks = (tasks) => {
    setTasksState((state) => ({
      ...state,
      tasks: [...(state.tasks || []), ...tasks],
    }));
  };

  callbacks.onEndTasks = (taskResults) => {
    setTasksState((state) => ({
      ...state,
      taskResults: [...(state.taskResults || []), ...taskResults],
    }));
  };

  switch (runCommandState) {
    case 'NO_TARGETS_RUN':
      return <NoTargetsRun onStartCommandParams={onStartCommandParamsState} />;
    case 'RUN_MANY':
      return <RunMany tasksState={tasksState} />;
    default:
      return <Text>{''}</Text>;
  }
}

function getInkRunManyLifeCycleInstance(
  lifeCycle: LifeCycle | CompositeLifeCycle
): InkRunManyLifeCycle {
  if (lifeCycle instanceof CompositeLifeCycle) {
    const inkRunManyLifeCycleInstance = lifeCycle.lifeCycles.find(
      (lifeCycleInstance) => lifeCycleInstance instanceof InkRunManyLifeCycle
    );
    if (!inkRunManyLifeCycleInstance) {
      throw new Error(
        'No instance of InkRunManyLifeCycle was provided as part of the CompositeLifeCycle instance'
      );
    }
    return inkRunManyLifeCycleInstance as InkRunManyLifeCycle;
  }
  if (!(lifeCycle instanceof InkRunManyLifeCycle)) {
    throw new Error(
      'The provided LifeCycle instance was neither an instancce of InkRunManyLifeCycle nor a CompositeLifeCycle containing an InkRunManyLifeCycle instance'
    );
  }
  return lifeCycle;
}

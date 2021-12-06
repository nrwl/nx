import type { SpinnerName } from 'cli-spinners';
import * as figures from 'figures';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import * as React from 'react';
import type { ExtendedTaskStatus } from '../../life-cycle';

interface TaskRowProps {
  muted: boolean;
  status: ExtendedTaskStatus;
  additionalStatusText: string;
  label: string;
  spinnerType: SpinnerName;
}

export function TaskRow({
  label,
  status,
  muted,
  additionalStatusText,
  spinnerType,
}: TaskRowProps) {
  let icon =
    status === 'loading' ? (
      <Text color="gray">
        <Spinner type={spinnerType} />
      </Text>
    ) : (
      getSymbol(status, muted)
    );
  const isCacheStatus = status === 'cache' || status === 'remote-cache';

  return (
    <Box flexDirection="column">
      <Box>
        <Box marginRight={isCacheStatus ? 0 : 2}>
          <Text>{icon}</Text>
        </Box>
        <Text
          color={
            status === 'success'
              ? muted === true
                ? 'gray'
                : 'green'
              : status === 'failure'
              ? 'red'
              : isCacheStatus
              ? 'cyan'
              : 'white'
          }
        >
          {' '}
          {label}
        </Text>
        {additionalStatusText ? (
          <Box marginLeft={1}>
            <Text dimColor>[{additionalStatusText}]</Text>
          </Box>
        ) : undefined}
      </Box>
    </Box>
  );
}

function getSymbol(status: ExtendedTaskStatus, muted: boolean) {
  if (status === 'failure') {
    return <Text color="red">{figures.cross}</Text>;
  }

  if (status === 'success') {
    return (
      <Text color={muted === true ? 'gray' : 'green'}>{figures.tick}</Text>
    );
  }

  if (status === 'pending') {
    return <Text color="gray">{figures.info}</Text>;
  }

  if (status === 'cache') {
    return <Text color="gray">📂</Text>;
  }

  if (status === 'remote-cache') {
    return <Text color="gray">☁️</Text>;
  }

  return ' ';
}

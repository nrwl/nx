import { Box, Text } from 'ink';
import * as React from 'react';
import type { InkRunManyLifeCycleOnStartCommandParams } from '../ink-run-many-life-cycle';
import { NxOutputRowTitle } from './nx-output-row-title';

interface NoTargetsRunProps {
  onStartCommandParams: InkRunManyLifeCycleOnStartCommandParams;
}

export function NoTargetsRun({ onStartCommandParams }: NoTargetsRunProps) {
  let description = `with "${onStartCommandParams.args.target}"`;
  if (onStartCommandParams.args.configuration) {
    description += ` that are configured for "${onStartCommandParams.args.configuration}"`;
  }
  return (
    <Box marginY={1} marginX={2}>
      <NxOutputRowTitle>
        <Text>No projects {description} were run</Text>
      </NxOutputRowTitle>
    </Box>
  );
}

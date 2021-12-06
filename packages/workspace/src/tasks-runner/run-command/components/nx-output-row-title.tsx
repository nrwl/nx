import { Text } from 'ink';
import * as React from 'react';

interface NxOutputRowTitleProps {
  success?: boolean;
  children?: React.ReactNode;
}

export function NxOutputRowTitle({ children, success }: NxOutputRowTitleProps) {
  return (
    <>
      <Text color={success ? 'green' : 'cyan'}>&gt; </Text>
      <Text color={success ? 'green' : 'cyan'} inverse bold>
        {' '}
        NX{' '}
      </Text>
      <Text> </Text>
      {children || null}
    </>
  );
}

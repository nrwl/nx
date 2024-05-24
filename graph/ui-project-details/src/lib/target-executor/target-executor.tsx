import { ExternalLink } from '@nx/graph/ui-tooltips';

export interface TargetExecutorProps {
  command?: string;
  commands?: string[];
  script?: string;
  executor?: string;
  isCompact?: boolean;
  link?: string;
}

export function TargetExecutor({
  command,
  commands,
  script,
  executor,
  isCompact,
  link,
}: TargetExecutorProps) {
  if (commands) {
    if (isCompact) {
      return link ? (
        <ExternalLink href={link}>
          {commands.length === 1 ? commands[0] : executor}
        </ExternalLink>
      ) : commands.length === 1 ? (
        commands[0]
      ) : (
        executor
      );
    }
    return (
      <ul>
        {commands?.map((c) =>
          c ? (
            <li>{link ? <ExternalLink href={link}>{c}</ExternalLink> : c}</li>
          ) : null
        )}
      </ul>
    );
  }

  const displayText = command ?? script ?? executor ?? '';
  return link ? (
    <ExternalLink href={link}>{displayText}</ExternalLink>
  ) : (
    displayText
  );
}

import { ExternalLink } from '@nx/graph/ui-tooltips';

export interface TargetExecutorProps {
  command?: string;
  commands?: string[];
  script?: string;
  executor?: string;
  isCompact?: boolean;
  link?: string;
  children?: React.ReactNode;
}

export function TargetExecutor({
  command,
  commands,
  script,
  executor,
  isCompact,
  link,
  children,
}: TargetExecutorProps) {
  if (script) {
    return link ? (
      <div className="group/line">
        <ExternalLink href={link}>{script}</ExternalLink> {children}
      </div>
    ) : (
      script
    );
  }

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
      <div className="group/line">
        <ul>
          {commands?.filter(Boolean).map((c) => (
            <li>{link ? <ExternalLink href={link}>{c}</ExternalLink> : c}</li>
          ))}
        </ul>
        {children}
      </div>
    );
  }

  const displayText = command ?? executor ?? '';
  return link ? (
    <div className="group/line">
      <ExternalLink href={link}>{displayText}</ExternalLink> {children}
    </div>
  ) : (
    displayText
  );
}

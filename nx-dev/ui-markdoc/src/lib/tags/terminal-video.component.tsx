import { TerminalShellWrapper } from '@nx/nx-dev/ui-fence';
import { VideoLoop } from './video-loop.component';
import { Schema } from '@markdoc/markdoc';

export const terminalVideo: Schema = {
  render: 'TerminalVideo',
  attributes: {
    src: {
      type: 'String',
      required: true,
    },
    alt: {
      type: 'String',
      required: true,
    },
  },
};

export function TerminalVideo({
  src,
  alt,
}: {
  src: string;
  alt: string;
}): JSX.Element {
  return (
    <TerminalShellWrapper isMessageBelow={false}>
      <div className="overflow-x-auto">
        <VideoLoop src={src} alt={alt}></VideoLoop>
      </div>
    </TerminalShellWrapper>
  );
}

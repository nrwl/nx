import { Schema } from '@markdoc/markdoc';
import dynamic from 'next/dynamic';
import { VideoLoop } from './video-loop.component';

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

const TerminalShellWrapper = dynamic(
  async () => (await import('@nx/graph/ui-fence')).TerminalShellWrapper,
  {
    ssr: false,
  }
);

export function TerminalVideo({
  src,
  alt,
}: {
  src: string;
  alt: string;
}): JSX.Element {
  return (
    <TerminalShellWrapper>
      <div className="overflow-x-auto">
        <VideoLoop src={src} alt={alt}></VideoLoop>
      </div>
    </TerminalShellWrapper>
  );
}

declare module 'react-copy-to-clipboard' {
  import { Component, ReactNode } from 'react';

  export interface CopyToClipboardProps {
    text: string;
    onCopy?: (text: string, result: boolean) => void;
    options?: { debug?: boolean; message?: string; format?: string };
    children?: ReactNode;
  }

  export class CopyToClipboard extends Component<CopyToClipboardProps> {
    static CopyToClipboard: typeof CopyToClipboard;
  }

  export default CopyToClipboard;
}

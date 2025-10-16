import { ComponentProps, ReactElement, ReactNode } from 'react';

export type VideoPlayerVariant = 'blue-pink' | 'blue-white-spin';

export interface VideoPlayerProps {
  children: ReactNode;
  className?: string;
}

export interface VideoPlayerThumbnailProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

export interface VideoPlayerButtonProps extends ComponentProps<'div'> {
  variant?: VideoPlayerVariant;
  text: {
    primary: string;
    secondary: string;
  };
  onClick?: () => void;
}

export interface VideoPlayerModalProps {
  onClose?: () => void;
}

export interface VideoPlayerContextValue {
  videoUrl: string;
  isModalOpen: boolean;
  isPlaying: boolean;
  openModal: () => void;
  closeModal: () => void;
  startPlaying: () => void;
  stopPlaying: () => void;
  sendAnalytics?: (event: string, category: string, label: string) => void;
}

export interface VideoPlayerProviderProps {
  videoUrl: string;
  analytics?: {
    event: string;
    category: string;
    label: string;
  };
  onPlay?: () => void;
  onClose?: () => void;
  children: ReactNode;
}

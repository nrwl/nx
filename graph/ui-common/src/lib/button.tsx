import { ReactNode } from 'react';

interface ButtonProps {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Button({
  children,
  onClick,
  disabled,
  className = '',
}: ButtonProps) {
  return (
    <div>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`rounded-lg px-4 py-2 font-semibold transition ${
          disabled
            ? 'cursor-not-allowed bg-gray-400'
            : 'bg-blue-500 text-white hover:bg-blue-600'
        } ${className}`}
      >
        {children}
      </button>
    </div>
  );
}

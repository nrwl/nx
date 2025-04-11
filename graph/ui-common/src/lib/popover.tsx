import { useFloating, useDismiss, useInteractions } from '@floating-ui/react';

export interface PopoverProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  position?: { top?: string; left?: string; right?: string; bottom?: string };
}

export function Popover({ isOpen, onClose, children, position }: PopoverProps) {
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
  });

  const dismiss = useDismiss(context, { referencePress: false });
  const { getFloatingProps } = useInteractions([dismiss]);

  if (!isOpen) return null;

  return (
    <div
      ref={refs.setFloating}
      style={{ ...floatingStyles, ...position }}
      {...getFloatingProps()}
      className="animate-fadeIn absolute z-50 flex w-64 flex-col gap-1 rounded-md border border-slate-300/[0.25] bg-white text-slate-700 shadow-lg transition-opacity duration-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
    >
      {children}
    </div>
  );
}

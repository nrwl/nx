import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface CollapsibleProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
}

export function Collapsible({ isOpen, children, className }: CollapsibleProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={`overflow-hidden ${className}`}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.12,
      ease: 'linear',
      duration: 0.24,
      type: 'tween',
    },
  },
};
export const transition = {
  when: 'beforeChildren',
  staggerChildren: 0.12,
  ease: 'linear',
  duration: 0.24,
  type: 'tween',
};

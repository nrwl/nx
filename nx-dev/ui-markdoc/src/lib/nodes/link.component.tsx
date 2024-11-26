import Link from 'next/link';
import { cx } from '@nx/nx-dev/ui-primitives';

export function CustomLink(props: any) {
  const target =
    props.target || (props.href.startsWith('http') ? '_blank' : undefined);

  return (
    <Link
      prefetch={false}
      {...props}
      passHref
      target={target}
      rel={target === '_blank' ? 'noreferrer' : undefined}
      className={cx(
        props.className,
        'text-blue-600 transition-colors ease-out hover:text-blue-700 dark:text-sky-500 dark:hover:text-sky-400'
      )}
    >
      {props.children}
    </Link>
  );
}

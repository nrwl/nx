import Link from 'next/link';

export function CustomLink(props: any) {
  const target =
    props.target || (props.href.startsWith('http') ? '_blank' : undefined);

  return (
    <Link {...props} passHref>
      <a
        target={target}
        rel={target === '_blank' ? 'noreferrer' : undefined}
        className={props.className}
      >
        {props.children}
      </a>
    </Link>
  );
}

import { Link, LinkProps, useSearchParams, To } from 'react-router-dom';
import React from 'react';

type LinkWithSearchParamsProps = LinkProps &
  React.RefAttributes<HTMLAnchorElement>;

function LinkWithSearchParams(props: LinkWithSearchParamsProps) {
  const [searchParams] = useSearchParams();

  let to: To;
  if (typeof props.to === 'object') {
    to = { ...props.to, search: searchParams.toString() };
  } else if (typeof props.to === 'string') {
    to = { pathname: props.to, search: searchParams.toString() };
  }
  return <Link {...props} to={to} />;
}

export default LinkWithSearchParams;

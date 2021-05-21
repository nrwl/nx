import { menuApi } from '../../lib/api';

interface RedirectParams {
  params: { version: string; flavor: string; segments: string | string[] };
}

export function Redirect() {
  return <></>;
}

export async function getServerSideProps({ params }: RedirectParams) {
  try {
    const menu = menuApi.getMenu(params.version, params.flavor);
    const firstPagePath = menu?.sections[0].itemList?.[0].itemList?.[0].path;
    return {
      redirect: {
        destination: firstPagePath ?? '/',
        permanent: false,
      },
    };
  } catch {
    return {
      redirect: { destination: '/', permanent: false },
    };
  }
}

export default Redirect;

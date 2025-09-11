export async function devkitPages() {
  const { getCollection } = await import('astro:content');
  const docs = await getCollection(
    'nx-reference-packages',
    (doc) => doc.data.packageType === 'devkit'
  );

  const dkRoutes = docs.map((doc) => {
    const { title, slug } = doc.data;
    return {
      params: { title, slug, type: 'page' },
      props: {
        doc,
      },
    };
  });

  return dkRoutes;
}

export async function ngcliAdapterPages() {
  const { getCollection } = await import('astro:content');
  const docs = await getCollection(
    'nx-reference-packages',
    (doc) => doc.data.packageType === 'devkit' && doc.data.slug?.startsWith('ngcli_adapter/')
  );

  const ngcliRoutes = docs.map((doc) => {
    const { title, slug } = doc.data;
    return {
      params: { title, slug, type: 'page' },
      props: {
        doc,
      },
    };
  });

  return ngcliRoutes;
}

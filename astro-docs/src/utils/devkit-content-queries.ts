export async function devkitPages() {
  const { getCollection } = await import('astro:content');
  const docs = await getCollection(
    'nx-reference-packages',
    (doc) => doc.data.packageType === 'devkit'
  );

  const dkRoutes = docs.map((doc) => {
    const { title, docType } = doc.data;
    return {
      params: { title, slug: docType, type: 'page' },
      props: {
        doc,
      },
    };
  });

  return dkRoutes;
}

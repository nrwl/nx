export async function devkitPages() {
  const { getCollection } = await import('astro:content');
  const docs = await getCollection(
    'nx-reference-packages',
    (doc) => doc.data.packageType === 'devkit'
  );

  const dkRoutes = docs.map((doc) => {
    const { title, slug } = doc.data;
    return {
      params: { title, slug },
      props: {
        doc,
      },
    };
  });

  return dkRoutes;
}

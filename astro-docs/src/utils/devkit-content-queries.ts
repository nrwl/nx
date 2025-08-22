export async function ngcliAdapterPages() {
  const { getCollection } = await import('astro:content');
  const docs = await getCollection(
    'nx-reference-packages',
    // we don't want the overview page, this is custom handled via the index.astro page
    (doc) =>
      doc.id !== 'ngcli_adapter-overview' &&
      doc.data.docType === 'ngcli_adapter' &&
      doc.data.packageType === 'devkit'
  );

  return docs.map((doc) => ({
    params: { name: doc.id.split('ngcli_adapter_')[1] },
    props: {
      doc,
    },
  }));
}

export async function devkitPages() {
  const { getCollection } = await import('astro:content');
  const docs = await getCollection(
    'nx-reference-packages',
    // we don't want the overview page, this is custom handled via the index.astro page
    (doc) =>
      doc.id !== 'devkit-overview' &&
      doc.data.docType === 'devkit' &&
      doc.data.packageType === 'devkit'
  );

  return docs.map((doc) => ({
    params: { name: doc.id.split('devkit_')[1] },
    props: {
      doc,
    },
  }));
}

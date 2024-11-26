import {
  MakeADifference,
  WhyJoinNx,
  CurrentOpenings,
  WhatWeOffer,
} from '@nx/nx-dev/ui-careers';
import { DefaultLayout } from '@nx/nx-dev/ui-common';

import { fetchJobsList } from '@nx/nx-dev/data-access-careers/node-only';

async function getData() {
  return await fetchJobsList();
}

export default async function CareersPage() {
  const jobs = await getData();
  return (
    <DefaultLayout>
      <MakeADifference />
      <div className="mt-32 lg:mt-56">
        <WhyJoinNx />
      </div>
      <div className="mt-32 lg:mt-56">
        <CurrentOpenings jobs={jobs} />
      </div>
      <div className="mt-32 lg:mt-56">
        <WhatWeOffer />
      </div>
    </DefaultLayout>
  );
}

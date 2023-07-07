import { nxDevDataAccessAi } from '@nx/nx-dev/data-access-ai';
import { Footer, Header } from '@nx/nx-dev/ui-common';

export default function Ai(): JSX.Element {
  return (
    <>
      <Header />
      <main id="main" role="main">
        Hello {nxDevDataAccessAi()}
      </main>
      <Footer />
    </>
  );
}

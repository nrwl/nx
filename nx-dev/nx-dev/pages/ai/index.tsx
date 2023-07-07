import { nxDevDataAccessAi } from '@nx/nx-dev/data-access-ai';
import { Footer, Header } from '@nx/nx-dev/ui-common';

console.log(nxDevDataAccessAi('Hello'));

export default function Ai(): JSX.Element {
  return (
    <>
      <Header />
      <main id="main" role="main">
        Hello kat
      </main>
      <Footer />
    </>
  );
}

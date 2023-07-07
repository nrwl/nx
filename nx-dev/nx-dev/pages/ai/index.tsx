import {
  nxDevDataAccessAi,
  getStringFromStream,
} from '@nx/nx-dev/data-access-ai';
import { useState } from 'react';
import { useNavToggle } from '../../lib/navigation-toggle.effect';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';
import { DocumentationHeader } from '@nx/nx-dev/ui-common';

// console.log(nxDevDataAccessAi('Hello'));
console.log(getStringFromStream(nxDevDataAccessAi('Hello')));

export default function Ai(): JSX.Element {
  const { toggleNav, navIsOpen } = useNavToggle();

  const [finalResult, setFinalResult] = useState('');
  const [error, setError] = useState(null);
  return (
    <div id="shell" className="flex h-full flex-col">
      <div className="w-full flex-shrink-0">
        <DocumentationHeader isNavOpen={navIsOpen} toggleNav={toggleNav} />
      </div>
      <main
        id="main"
        role="main"
        className="flex h-full flex-1 overflow-y-hidden"
      >
        {/* <button onClick={() => handleSubmit()}>Click me</button> */}
        {finalResult && !error ? (
          <div>
            <h3>Answer:</h3>
            {
              renderMarkdown(finalResult, {
                filePath: '',
              })?.node
            }
          </div>
        ) : null}
        {error ? <div>There was an error: {error['message']}</div> : null}
      </main>
    </div>
  );
}

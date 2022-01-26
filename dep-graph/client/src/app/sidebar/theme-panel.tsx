import { useEffect, useState } from 'react';
import { themeResolver } from '../theme-resolver';
import Modal from './modal';
import * as Icon from './theme-icons';

export default function ThemePanel() {
  const [modal, openModal] = useState(false);
  const [defaultTheme, setDefaultTheme] = useState(
    localStorage.theme || 'system'
  );

  function dysplayIcon() {
    if (defaultTheme === 'system') return Icon.System({ className: 'h-5 w-5' });
    if (defaultTheme === 'dark') return Icon.Moon({ className: 'h-5 w-5' });
    if (defaultTheme === 'light') return Icon.Sun({ className: 'h-5 w-5' });
  }

  useEffect(() => {
    themeResolver(defaultTheme);
  }, [defaultTheme]);

  return (
    <div className="flex">
      <span
        className={`hover:bg-blue-nx-dark group relative cursor-pointer rounded-lg border-white
        p-2 ${modal ? 'bg-blue-nx-dark' : ''}
        `}
        onClick={() => openModal(!modal)}
      >
        {dysplayIcon()}
      </span>
      {/* Modal for settings */}
      {modal && (
        <Modal toggle={openModal} setDefaultTheme={setDefaultTheme}></Modal>
      )}
    </div>
  );
}

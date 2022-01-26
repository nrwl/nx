import { Moon, Sun, System } from './theme-icons';

export default function Modal({ toggle, setDefaultTheme }) {
  function toggleTheme(themeName: string) {
    setDefaultTheme(themeName);
    toggle(false);
  }

  const btnStyles = 'p-2 hover:bg-slate-600 hover:bg-opacity-30';

  return (
    <div
      className="bg-blue-nx-dark absolute top-[60px] right-4 flex overflow-hidden
                    rounded-lg text-stone-200 shadow-xl
                    "
    >
      <button className={btnStyles} onClick={() => toggleTheme('dark')}>
        <Moon className="h-5 w-5" />
      </button>

      <button className={btnStyles} onClick={() => toggleTheme('light')}>
        <Sun className="h-5 w-5" />
      </button>

      <button className={btnStyles} onClick={() => toggleTheme('system')}>
        <System className="h-5 w-5" />
      </button>
    </div>
  );
}

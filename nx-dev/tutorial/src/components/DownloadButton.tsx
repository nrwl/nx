export function DownloadButton() {
  return (
    <button
      title="Download lesson as zip-file"
      className="transition-theme bg-tk-elements-topBar-iconButton-backgroundColor hover:bg-tk-elements-topBar-iconButton-backgroundColorHover border-tk-elements-navCard-borderColor hover:border-tk-elements-navCard-borderColorHover mx-auto my-5 flex items-center rounded-md border text-xl"
      onClick={onClick}
    >
      <span className="text-tk-elements-topBar-iconButton-iconColor hover:text-tk-elements-topBar-iconButton-iconColorHover flex items-center p-2">
        <div className="i-ph-download-simple mr-2 text-3xl" />
        Download Repository
      </span>
    </button>
  );
}

async function onClick() {
  const button: any = document.querySelector('#download-button button');
  button.click();
}

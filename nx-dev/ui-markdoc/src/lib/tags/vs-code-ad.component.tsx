export const VsCodeAd = () => (
  <div className="bg-white">
    <div className="mx-auto max-w-7xl py-16">
      <div className="overflow-hidden rounded-lg bg-indigo-700 shadow-xl lg:grid lg:grid-cols-2 lg:gap-2">
        <div className="px-6 py-8">
          <div className="lg:self-center">
            <h2 className="mt-0 text-3xl font-extrabold text-white">
              <span className="block">NxConsole</span>
              <span className="block">The best Nx companion for VsCode.</span>
            </h2>
            <p className="mt-4 text-lg leading-6 text-indigo-200">
              Do you know Nx has an official VsCode Plugin available?! Pilote Nx
              with the right UI directly from your editor.
            </p>
            <a
              href="#"
              className="mt-2 inline-flex items-center rounded-md border border-transparent bg-white px-2 py-3 text-indigo-600 shadow hover:bg-indigo-50"
            >
              Add it to VsCode now
            </a>
          </div>
        </div>
        <div className="aspect-w-5 aspect-h-3 md:aspect-w-2 md:aspect-h-1 -mt-6">
          <img
            className="translate-x-6 translate-y-6 transform rounded-md object-cover object-left-top sm:translate-x-16 lg:translate-y-20"
            src="/images/nx-console.webp"
            alt="App screenshot"
          />
        </div>
      </div>
    </div>
  </div>
);

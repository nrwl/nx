import React from 'react';

export function Testimonials() {
  return (
    <section className="bg-blue-nx-base">
      <div className="mx-auto max-w-7xl md:grid md:grid-cols-2 md:px-6 lg:px-8">
        <div className="md:border-blue-nx-dark py-12 px-4 sm:px-6 md:flex md:flex-col md:border-r md:py-16 md:pl-0 md:pr-10 lg:pr-16">
          <div className="md:flex-shrink-0">
            <div className="mx-auto flex items-center font-mono tracking-wider text-white">
              <svg
                role="img"
                className="h-8 w-8"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
              >
                <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z" />
              </svg>
              <span className="ml-2 font-bold ">TypeScript-ESLint</span>
            </div>
          </div>
          <blockquote className="mt-6 md:flex md:flex-grow md:flex-col">
            <div className="relative text-lg font-medium text-white md:flex-grow">
              <svg
                className="text-green-nx-base absolute top-0 left-0 hidden h-8 w-8 -translate-x-4 -translate-y-4 transform md:flex"
                fill="currentColor"
                viewBox="0 0 32 32"
                aria-hidden="true"
              >
                <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
              </svg>
              <p className="relative">
                Nx is good good blah blah, I use it everyday.
              </p>
            </div>
            <footer className="mt-8">
              <div className="flex items-start">
                <div className="inline-flex flex-shrink-0 rounded-full border-2 border-white">
                  <img
                    className="h-12 w-12 rounded-full"
                    src="https://avatars.githubusercontent.com/u/900523?v=4"
                    alt="James Henry avatar"
                  />
                </div>
                <div className="ml-4">
                  <div className="text-base font-medium text-white">
                    James Henry
                  </div>
                  <div className="text-base font-medium text-gray-300">
                    Software Architect, TypeScript-ESLint
                  </div>
                </div>
              </div>
            </footer>
          </blockquote>
        </div>
        <div className="border-blue-nx-dark border-t-2 py-12 px-4 sm:px-6 md:border-t-0 md:border-l md:py-16 md:pr-0 md:pl-10 lg:pl-16">
          <div className="md:flex-shrink-0">
            <div className="mx-auto flex items-center font-mono tracking-wider text-white">
              <svg
                className="h-auto w-10"
                fill="currentColor"
                role="img"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M16.71.243l-.12 2.71a.18.18 0 00.29.15l1.06-.8.9.7a.18.18 0 00.28-.14l-.1-2.76 1.33-.1a1.2 1.2 0 011.279 1.2v21.596a1.2 1.2 0 01-1.26 1.2l-16.096-.72a1.2 1.2 0 01-1.15-1.16l-.75-19.797a1.2 1.2 0 011.13-1.27L16.7.222zM13.64 9.3c0 .47 3.16.24 3.59-.08 0-3.2-1.72-4.89-4.859-4.89-3.15 0-4.899 1.72-4.899 4.29 0 4.45 5.999 4.53 5.999 6.959 0 .7-.32 1.1-1.05 1.1-.96 0-1.35-.49-1.3-2.16 0-.36-3.649-.48-3.769 0-.27 4.03 2.23 5.2 5.099 5.2 2.79 0 4.969-1.49 4.969-4.18 0-4.77-6.099-4.64-6.099-6.999 0-.97.72-1.1 1.13-1.1.45 0 1.25.07 1.19 1.87z" />
              </svg>
              <span className="ml-2 font-bold ">Storybook</span>
            </div>
          </div>
          <blockquote className="mt-6 md:flex md:flex-grow md:flex-col">
            <div className="relative text-lg font-medium text-white md:flex-grow">
              <svg
                className="text-green-nx-base absolute top-0 left-0 hidden h-8 w-8 -translate-x-4 -translate-y-4 transform md:flex"
                fill="currentColor"
                viewBox="0 0 32 32"
              >
                <path d="M9.352 4C4.456 7.456 1 13.12 1 19.36c0 5.088 3.072 8.064 6.624 8.064 3.36 0 5.856-2.688 5.856-5.856 0-3.168-2.208-5.472-5.088-5.472-.576 0-1.344.096-1.536.192.48-3.264 3.552-7.104 6.624-9.024L9.352 4zm16.512 0c-4.8 3.456-8.256 9.12-8.256 15.36 0 5.088 3.072 8.064 6.624 8.064 3.264 0 5.856-2.688 5.856-5.856 0-3.168-2.304-5.472-5.184-5.472-.576 0-1.248.096-1.44.192.48-3.264 3.456-7.104 6.528-9.024L25.864 4z" />
              </svg>
              <p className="relative">
                Nx is good good blah blah blah, saves me $$ from CI with
                NxCloud.
              </p>
            </div>
            <footer className="mt-8">
              <div className="flex items-start">
                <div className="inline-flex flex-shrink-0 rounded-full border-2 border-white">
                  <img
                    className="h-12 w-12 rounded-full"
                    src="https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?ixlib=rb-0.3.5&q=80&fm=jpg&crop=faces&fit=crop&h=200&w=200&s=8cc7a3620510c32066d3fbb193e7eb23"
                    alt=""
                  />
                </div>
                <div className="ml-4">
                  <div className="text-base font-medium text-white">
                    Jane Doe
                  </div>
                  <div className="text-base font-medium text-gray-300">
                    CEO, Storybook
                  </div>
                </div>
              </div>
            </footer>
          </blockquote>
        </div>
      </div>
    </section>
  );
}

export default Testimonials;

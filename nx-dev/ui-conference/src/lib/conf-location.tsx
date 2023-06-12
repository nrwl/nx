export function ConfLocation(): JSX.Element {
  return (
    <div className="border-t border-b border-slate-200 dark:border-slate-700">
      <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
        <article className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-slate-200 md:dark:divide-slate-700">
          <div className="px-5 py-12 md:pr-12">
            <p className="mb-8">
              Nx Conf 2023 will be located in New York. More details soon.
              {/* <a
                href="https://www.hyatt.com/en-US/group-booking/PHXDT/G-NXCF"
                rel="noreferrer"
                target="_blank"
                className="text-blue-500 underline dark:text-sky-500"
              >
                Use this link to book your room at a discounted rate
              </a>
              . */}
            </p>
            <iframe
              title="Nx Conf 2023 Location Map"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d6044.237559417721!2d-73.99232750171791!3d40.759412185545926!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c258f88254f2c3%3A0xc307e150c50c51f7!2sSheraton%20New%20York%20Times%20Square%20Hotel!5e0!3m2!1sen!2sus!4v1686622720321!5m2!1sen!2sus"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-96 w-full rounded-lg shadow"
            ></iframe>
          </div>
          <div className="divide-y divide-slate-200 py-12 dark:divide-slate-700"></div>
        </article>
      </div>
    </div>
  );
}

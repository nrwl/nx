export function ConfLocation(): JSX.Element {
  return (
    <div className="border-t border-b border-gray-600">
      <div className="mx-auto max-w-screen-lg text-white xl:max-w-screen-xl">
        <article className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-gray-600">
          <div className="px-5 py-12 md:pr-12">
            <p className="mb-8 text-slate-300">
              Nx Conf 2022 will be located at the Tempe Mission Palms in Tempe,
              AZ.{' '}
              <a
                href="https://www.hyatt.com/en-US/group-booking/PHXDT/G-NXCF"
                rel="noreferrer"
                target="_blank"
                className="underline hover:text-white"
              >
                Use this link to book your room at a discounted rate
              </a>
              .
            </p>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3329.891740501581!2d-111.9388799!3d33.42606669999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x872b08d80cf29ca3%3A0x40c5db5254810ce!2sTempe%20Mission%20Palms!5e0!3m2!1sen!2sca!4v1660064364837!5m2!1sen!2sca"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-96 w-full rounded-lg shadow"
            ></iframe>
          </div>
          <div className="divide-y divide-gray-600 py-12"></div>
        </article>
      </div>
    </div>
  );
}

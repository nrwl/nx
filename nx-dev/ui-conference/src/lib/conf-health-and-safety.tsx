export function ConfHealthAndSafety(): JSX.Element {
  return (
    <div className="border-t border-b border-gray-600">
      <div className="mx-auto max-w-screen-lg text-white xl:max-w-screen-xl">
        <article className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-gray-600">
          <div className="px-5 py-12 md:pr-12">
            <h3 className="font-input-mono mb-8 text-xl">COVID Precautions</h3>
            <p className="mb-4 text-slate-300">
              Due to the ongoing health risk of COVID-19,{' '}
              <span className="font-semibold">
                we require that all attendees be fully vaccinated and boosted in
                order to reduce the risk of severe illness
              </span>
              . We will also{' '}
              <span className="font-semibold">
                require that attendees wear masks
              </span>{' '}
              upon entering and remaining within the Nx conference event.
            </p>
            <p className="mb-8 text-slate-300">
              Conference organizers reserve the right to take additional safety
              measures during the conference.
            </p>
          </div>
          <div className="divide-y divide-gray-600">
            <div className="px-5 py-12 md:pl-12">
              <h3 className="font-input-mono mb-8 text-xl">Code of Conduct</h3>
              <p className="mb-4 text-slate-300">
                Nx Conf is also dedicated to providing a harassment-free
                conference experience for everyone, regardless of gender, gender
                identity and expression, age, sexual orientation, disability,
                physical appearance, body size, race, ethnicity, religion (or
                lack thereof), or technology choices.
              </p>
              <p className="mb-4 text-slate-300">
                We do not tolerate harassment of conference participants in any
                form. Sexual language and imagery are not appropriate for any
                conference venue, including talks, workshops, parties, Twitter,
                and other online media.
              </p>
              <p className="mb-4 text-slate-300">
                Conference participants violating these rules may be sanctioned
                or expelled from the conference without a refund at the
                discretion of the conference organizers.
              </p>
              <p>
                <a
                  href="https://docs.google.com/document/d/1biFWD08Wrd99gRZNv4Q1tawEYGZEI3bd3J55E5uG2ZU/edit?usp=sharing"
                  rel="noreferrer"
                  target="_blank"
                  className="underline hover:text-white"
                >
                  You can review our full Code of Conduct here.
                </a>
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-8 py-16">
      <section className="max-w-2xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-700">
          School elections, made clear
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Welcome to EVOTE
        </h1>
        <p className="mt-6 text-lg text-gray-600">
          A secure, zero-PII voting platform for school communities.
        </p>
      </section>
      <section className="grid gap-4 sm:grid-cols-2">
        {[
          ["Admin dashboard", "/admin", "Configure elections and devices."],
          ["Teacher dashboard", "/teacher", "Monitor turnout and standings."],
          ["Kiosk voting", "/kiosk", "Run the student voting flow."],
          ["Projector view", "/projector", "Share live election results."],
        ].map(([title, href, description]) => (
          <a
            key={href}
            href={href}
            className="rounded-xl border border-gray-200 bg-white p-6 transition hover:border-blue-500 hover:shadow-sm"
          >
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-gray-600">{description}</p>
          </a>
        ))}
      </section>
    </main>
  );
}

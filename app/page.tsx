export default function Home() {
  return (
    <main className="FoundationPage flex min-h-screen items-center justify-center px-6 py-16">
      <section
        aria-labelledby="foundation-title"
        className="FoundationPage__content w-full max-w-2xl"
      >
        <p className="FoundationPage__eyebrow text-sm font-semibold tracking-[0.16em] text-foreground/60 uppercase">
          Local-first personal AI
        </p>
        <h1
          className="FoundationPage__title mt-5 text-5xl font-semibold tracking-tight text-foreground sm:text-7xl"
          id="foundation-title"
        >
          Second Brain
        </h1>
        <p className="FoundationPage__description mt-6 max-w-xl text-lg leading-8 text-foreground/70 sm:text-xl">
          A personal AI workspace for conversations and knowledge you choose to
          keep.
        </p>
      </section>
    </main>
  );
}

export function NoLessonsState() {
  return (
    <section className="rounded-3xl border border-black/10 bg-white/85 p-6">
      <h2 className="text-lg font-semibold text-black">No lessons available</h2>
      <p className="mt-2 text-sm text-black/60">
        Add a MusicXML lesson under `lessons/` to populate the router.
      </p>
    </section>
  );
}

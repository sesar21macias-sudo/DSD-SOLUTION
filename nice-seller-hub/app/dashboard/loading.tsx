/** Esqueleto del panel: nunca una pantalla congelada mientras carga. */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-6 lg:px-8 lg:py-8">
      <div className="skeleton h-8 w-56 rounded-lg" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
      <div className="skeleton mt-8 h-52 rounded-2xl" />
    </div>
  );
}

export default function PageHeader({ title, subtitle, chip, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8 pb-5 border-b border-zinc-200">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
          {chip != null && (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200">
              {chip}
            </span>
          )}
        </div>
        {subtitle && <p className="text-sm text-zinc-500 mt-1.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}

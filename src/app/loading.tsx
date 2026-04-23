export default function Loading() {
  return (
    <div className="flex h-full w-full items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="size-12 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin dark:border-slate-800 dark:border-t-sky-400"></div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">Carregando...</p>
      </div>
    </div>
  );
}

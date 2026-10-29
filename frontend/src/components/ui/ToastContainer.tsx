import { useToast } from "@/hooks/use-toast";

export function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`rounded-xl px-4 py-3 shadow-lg text-sm font-medium border pointer-events-auto ${
            t.variant === "destructive"
              ? "bg-red-600 text-white border-red-700"
              : "bg-white text-slate-900 border-slate-200"
          }`}
        >
          {t.title && <p className="font-semibold">{t.title}</p>}
          {t.description && (
            <p className={t.title ? "mt-0.5 opacity-80" : ""}>{t.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
import { Button } from "@/components/ui/Button";

type ModalProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onClose: () => void;
};

export function Modal({ actionLabel = "Close", message, onClose, title }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <section className="w-full max-w-md rounded-md border border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
        <h2 className="text-xl font-semibold text-zinc-50">{title}</h2>
        <p className="mt-3 leading-7 text-zinc-300">{message}</p>
        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>{actionLabel}</Button>
        </div>
      </section>
    </div>
  );
}


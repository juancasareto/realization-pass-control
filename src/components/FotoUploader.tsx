import { useRef } from 'react';

export function FotoUploader({ fotoUrl, onUpload }: { fotoUrl: string | null; onUpload: (base64: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => onUpload(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 border border-[var(--ink-line)] bg-[var(--ink-raised)] overflow-hidden flex items-center justify-center rounded-md">
        {fotoUrl ? <img src={fotoUrl} alt="Foto del alumno" className="w-full h-full object-cover" /> : <span className="text-xs text-[var(--rock-dim)]">Sin foto</span>}
      </div>
      <button type="button" onClick={() => inputRef.current?.click()} className="border border-[var(--gold)] text-[var(--gold)] text-xs uppercase px-3 py-2 rounded-md">
        {fotoUrl ? 'Cambiar foto' : 'Subir foto'}
      </button>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
    </div>
  );
}

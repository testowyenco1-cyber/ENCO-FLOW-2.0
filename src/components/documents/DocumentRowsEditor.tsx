import React from 'react';
import type { DocumentRow } from './documentModel';

type Props = {
  title: string;
  value: DocumentRow[];
  onChange: (rows: DocumentRow[]) => void;
  disabled?: boolean;
  kind?: 'standard' | 'passage';
  addLabel?: string;
};

const inputClass = 'w-full min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500';

export const DocumentRowsEditor: React.FC<Props> = ({
  title, value, onChange, disabled = false, kind = 'standard', addLabel = 'Dodaj pozycję',
}) => {
  const update = (index: number, patch: Partial<DocumentRow>) => {
    onChange(value.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  };
  const add = () => onChange([...value, {
    id: `row-${Date.now()}-${value.length}`, type: '', quantity: '1', position: '',
  }]);
  const remove = (index: number) => onChange(value.filter((_, rowIndex) => rowIndex !== index));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">{title}</h4>
        <span className="text-[11px] tabular-nums text-slate-400">{value.length} pozycji</span>
      </div>
      <div className="space-y-2">
        {value.map((row, index) => (
          <div key={row.id} className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_76px_auto]">
              <label className="min-w-0 space-y-1 text-[11px] font-medium text-slate-500">
                Nazwa elementu
                <input className={inputClass} value={row.type} disabled={disabled} onChange={(event) => update(index, { type: event.target.value })} placeholder="Wpisz lub wybierz element"/>
              </label>
              <label className="space-y-1 text-[11px] font-medium text-slate-500">
                Ilość
                <input className={inputClass} value={row.quantity} disabled={disabled} onChange={(event) => update(index, { quantity: event.target.value })} inputMode="decimal"/>
              </label>
              <div className="flex items-end">
                <button type="button" disabled={disabled} onClick={() => remove(index)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40">Usuń</button>
              </div>
            </div>
            <label className="mt-2 block space-y-1 text-[11px] font-medium text-slate-500">
              Lokalizacja / opis
              <input className={inputClass} value={row.position} disabled={disabled} onChange={(event) => update(index, { position: event.target.value })} placeholder="Np. obok rozdzielnicy SN, od strony NN"/>
            </label>
            {kind === 'passage' && (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-1 text-[11px] font-medium text-slate-500">Typ kabla<input className={inputClass} value={row.cableType || ''} disabled={disabled} onChange={(event) => update(index, { cableType: event.target.value })}/></label>
                <label className="space-y-1 text-[11px] font-medium text-slate-500">Średnica<input className={inputClass} value={row.diameter || ''} disabled={disabled} onChange={(event) => update(index, { diameter: event.target.value })}/></label>
                <label className="space-y-1 text-[11px] font-medium text-slate-500">Uszczelnienie<input className={inputClass} value={row.sealType || ''} disabled={disabled} onChange={(event) => update(index, { sealType: event.target.value })}/></label>
                <label className="space-y-1 text-[11px] font-medium text-slate-500 sm:col-span-2 xl:col-span-3">Wkład / wariant uszczelnienia<input className={inputClass} value={row.sealVariant || ''} disabled={disabled} onChange={(event) => update(index, { sealVariant: event.target.value })}/></label>
              </div>
            )}
          </div>
        ))}
        {value.length === 0 && <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-400">Brak pozycji. Dodaj element, aby pojawił się w dokumencie.</p>}
      </div>
      <button type="button" disabled={disabled} onClick={add} className="mt-3 inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-40">+ {addLabel}</button>
    </section>
  );
};

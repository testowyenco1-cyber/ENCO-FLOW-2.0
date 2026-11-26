import React from 'react';
import { inferSmallElementCategory, type DocumentRow } from './documentModel';
import { DOOR_DIMENSIONS, PASSAGE_SIDES } from './documentDictionaries';

type Props = {
  title: string;
  value: DocumentRow[];
  onChange: (rows: DocumentRow[]) => void;
  disabled?: boolean;
  kind?: 'standard' | 'passage' | 'door' | 'small-element';
  addLabel?: string;
  options?: string[];
};

const inputClass = 'w-full min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500';

export const DocumentRowsEditor: React.FC<Props> = ({
  title, value, onChange, disabled = false, kind = 'standard', addLabel = 'Dodaj pozycję', options = [],
}) => {
  const suggestions = [...new Set(options.map((option) => option.trim()).filter(Boolean))];
  const update = (index: number, patch: Partial<DocumentRow>) => {
    onChange(value.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  };
  const updateName = (index: number, name: string) => {
    const row = value[index];
    if (!row) return;
    if (kind === 'door') {
      const inferredWidth = /trafo|transformator/i.test(name) ? '1170' : '950';
      const canReplaceDefault = !row.width || row.width === '950' || row.width === '1170';
      const canReplaceHeight = !row.height || row.height === '2100';
      update(index, {
        type: name,
        width: canReplaceDefault ? inferredWidth : row.width,
        height: canReplaceHeight ? '2100' : row.height,
        category: name,
      });
      return;
    }
    update(index, {
      type: name,
      category: kind === 'small-element' ? inferSmallElementCategory(name) : row.category,
    });
  };
  const add = () => onChange([...value, {
    id: 'row-' + Date.now() + '-' + value.length,
    type: '',
    quantity: '1',
    unit: 'szt.',
    position: '',
    width: kind === 'door' ? '950' : undefined,
    height: kind === 'door' ? '2100' : undefined,
    category: kind === 'small-element' ? 'Pozostałe' : undefined,
  }]);
  const remove = (index: number) => onChange(value.filter((_, rowIndex) => rowIndex !== index));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">{title}</h4>
        <span className="text-[11px] tabular-nums text-slate-400">{value.length} pozycji</span>
      </div>
      <div className="space-y-2">
        {value.map((row, index) => {
          const knownDoorSize = DOOR_DIMENSIONS.find((dimension) => dimension.width === row.width && dimension.height === row.height);
          const doorSizeValue = knownDoorSize?.value || (row.width || row.height ? 'custom' : '');
          return (
            <div key={row.id} className="rounded-md border border-slate-200 bg-slate-50/70 p-2.5">
              <div className={kind === 'small-element'
                ? 'grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_72px_88px_auto]'
                : 'grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_76px_auto]'}>
                <label className="min-w-0 space-y-1.5 text-[11px] font-medium text-slate-500">
                  Nazwa elementu
                  <input
                    className={inputClass}
                    value={row.type}
                    disabled={disabled}
                    onChange={(event) => updateName(index, event.target.value)}
                    placeholder="Wpisz nazwę lub wybierz poniżej"
                  />
                  {suggestions.length > 0 && (
                    <select
                      className={inputClass}
                      value={suggestions.includes(row.type) ? row.type : ''}
                      disabled={disabled}
                      onChange={(event) => { if (event.target.value) updateName(index, event.target.value); }}
                      aria-label={'Stałe pozycje — ' + title}
                    >
                      <option value="">Wybierz stały element z listy…</option>
                      {suggestions.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  )}
                </label>
                <label className="space-y-1 text-[11px] font-medium text-slate-500">
                  Ilość
                  <input className={inputClass} value={row.quantity} disabled={disabled} onChange={(event) => update(index, { quantity: event.target.value })} inputMode="decimal"/>
                </label>
                {kind === 'small-element' && (
                  <label className="space-y-1 text-[11px] font-medium text-slate-500">
                    Jednostka
                    <select className={inputClass} value={row.unit || 'szt.'} disabled={disabled} onChange={(event) => update(index, { unit: event.target.value })}>
                      <option value="szt.">szt.</option><option value="kpl.">kpl.</option><option value="m">m</option><option value="mb">mb</option><option value="m²">m²</option>
                    </select>
                  </label>
                )}
                <div className="flex items-end">
                  <button type="button" disabled={disabled} onClick={() => remove(index)} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40">Usuń</button>
                </div>
              </div>

              {kind === 'small-element' && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)]">
                  <label className="space-y-1 text-[11px] font-medium text-slate-500">
                    Grupa
                    <select className={inputClass} value={row.category || 'Pozostałe'} disabled={disabled} onChange={(event) => update(index, { category: event.target.value })}>
                      <option>Pozostałe</option><option>Konstrukcja / mocowanie</option><option>Wnętrze stacji</option><option>Dach</option><option>Wentylacja</option><option>Wyposażenie zewnętrzne</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-[11px] font-medium text-slate-500">
                    Miejsce montażu
                    <input className={inputClass} value={row.position} disabled={disabled} onChange={(event) => update(index, { position: event.target.value })} placeholder="Np. ściana od strony SN"/>
                  </label>
                </div>
              )}

              {(kind === 'standard' || kind === 'door') && (
                <label className="mt-2 block space-y-1 text-[11px] font-medium text-slate-500">
                  Lokalizacja / opis
                  <input className={inputClass} value={row.position} disabled={disabled} onChange={(event) => update(index, { position: event.target.value })} placeholder="Dodaj lokalizację lub szczegóły"/>
                </label>
              )}

              {kind === 'door' && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="space-y-1 text-[11px] font-medium text-slate-500">
                    Wymiar drzwi
                    <select
                      className={inputClass}
                      value={doorSizeValue}
                      disabled={disabled}
                      onChange={(event) => {
                        const selected = DOOR_DIMENSIONS.find((dimension) => dimension.value === event.target.value);
                        if (selected) update(index, { width: selected.width, height: selected.height });
                      }}
                    >
                      <option value="">Wybierz wymiar</option>
                      {DOOR_DIMENSIONS.map((dimension) => <option key={dimension.value} value={dimension.value}>{dimension.label}</option>)}
                      {doorSizeValue === 'custom' && <option value="custom">Inny wymiar — zachowany z danych</option>}
                    </select>
                  </label>
                  {doorSizeValue === 'custom' && (
                    <>
                      <label className="space-y-1 text-[11px] font-medium text-slate-500">Szerokość [mm]<input className={inputClass} value={row.width || ''} disabled={disabled} onChange={(event) => update(index, { width: event.target.value })}/></label>
                      <label className="space-y-1 text-[11px] font-medium text-slate-500">Wysokość [mm]<input className={inputClass} value={row.height || ''} disabled={disabled} onChange={(event) => update(index, { height: event.target.value })}/></label>
                    </>
                  )}
                  <label className="space-y-1 text-[11px] font-medium text-slate-500">
                    Skrzydła
                    <select className={inputClass} value={row.wings || ''} disabled={disabled} onChange={(event) => update(index, { wings: event.target.value })}>
                      <option value="">Nie określono</option><option>Jednoskrzydłowe</option><option>Dwuskrzydłowe</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-[11px] font-medium text-slate-500">
                    Otwieranie
                    <select className={inputClass} value={row.openingSide || ''} disabled={disabled} onChange={(event) => update(index, { openingSide: event.target.value })}>
                      <option value="">Nie określono</option><option>Lewe</option><option>Prawe</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-slate-600"><input type="checkbox" checked={Boolean(row.ventilationGrille)} disabled={disabled} onChange={(event) => update(index, { ventilationGrille: event.target.checked })}/> Krata wentylacyjna</label>
                  <label className="flex items-center gap-2 text-[11px] text-slate-600"><input type="checkbox" checked={Boolean(row.intakeFan)} disabled={disabled} onChange={(event) => update(index, { intakeFan: event.target.checked })}/> Wentylator nawiewny</label>
                  <label className="flex items-center gap-2 text-[11px] text-slate-600"><input type="checkbox" checked={Boolean(row.exhaustFan)} disabled={disabled} onChange={(event) => update(index, { exhaustFan: event.target.checked })}/> Wentylator wyciągowy</label>
                </div>
              )}

              {kind === 'passage' && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  <label className="space-y-1 text-[11px] font-medium text-slate-500">
                    Strona stacji
                    <select
                      className={inputClass}
                      value={(PASSAGE_SIDES as readonly string[]).includes(row.position) ? row.position : ''}
                      disabled={disabled}
                      onChange={(event) => update(index, { position: event.target.value })}
                    >
                      <option value="">Wybierz stronę</option>
                      {PASSAGE_SIDES.map((side) => <option key={side} value={side}>{side}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-[11px] font-medium text-slate-500">Typ kabla<input className={inputClass} value={row.cableType || ''} disabled={disabled} onChange={(event) => update(index, { cableType: event.target.value })}/></label>
                  <label className="space-y-1 text-[11px] font-medium text-slate-500">Średnica<input className={inputClass} value={row.diameter || ''} disabled={disabled} onChange={(event) => update(index, { diameter: event.target.value })}/></label>
                  <label className="space-y-1 text-[11px] font-medium text-slate-500">Uszczelnienie<input className={inputClass} value={row.sealType || ''} disabled={disabled} onChange={(event) => update(index, { sealType: event.target.value })}/></label>
                  <label className="space-y-1 text-[11px] font-medium text-slate-500 sm:col-span-2 xl:col-span-2">Wkład / wariant uszczelnienia<input className={inputClass} value={row.sealVariant || ''} disabled={disabled} onChange={(event) => update(index, { sealVariant: event.target.value })}/></label>
                </div>
              )}

              {kind === 'passage' && row.position && !(PASSAGE_SIDES as readonly string[]).includes(row.position) && (
                <p className="mt-2 text-[10px] text-amber-700">Zapisana wcześniej lokalizacja: {row.position}. Wybierz jedną z czterech stron, aby ujednolicić wpis.</p>
              )}

              {kind === 'small-element' && (
                <label className="mt-2 block space-y-1 text-[11px] font-medium text-slate-500">
                  Uwagi / parametry
                  <input className={inputClass} value={row.notes || ''} disabled={disabled} onChange={(event) => update(index, { notes: event.target.value })} placeholder="Np. stal ocynkowana, zgodnie z rysunkiem"/>
                </label>
              )}
            </div>
          );
        })}
        {value.length === 0 && <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-400">Brak pozycji. Dodaj element, aby pojawił się w dokumencie.</p>}
      </div>
      <button type="button" disabled={disabled} onClick={add} className="mt-3 inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-40">+ {addLabel}</button>
    </section>
  );
};

import React, { useMemo, useState } from 'react';
import { BookOpen, Plus, Trash2, X } from 'lucide-react';
import {
  appendDocumentDictionaryValue,
  removeDocumentDictionaryValue,
  DEFAULT_DOCUMENT_DICTIONARIES,
  DOCUMENT_DICTIONARY_CATEGORIES,
  type DocumentDictionaries,
  type DocumentDictionaryKey,
} from './documentDictionaries';

type Props = {
  dictionaries: DocumentDictionaries;
  onClose: () => void;
  onSaved: (next: DocumentDictionaries) => void;
};

export const DocumentDictionariesManager: React.FC<Props> = ({ dictionaries, onClose, onSaved }) => {
  const [category, setCategory] = useState<DocumentDictionaryKey>('smallElements');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedLabel = useMemo(
    () => DOCUMENT_DICTIONARY_CATEGORIES.find((item) => item.key === category)?.label || 'Słownik',
    [category],
  );

  const addValue = async () => {
    const clean = value.trim();
    if (!clean || saving) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const next = await appendDocumentDictionaryValue(category, clean);
      onSaved(next);
      setValue('');
      setSuccess('Pozycja została zapisana na serwerze i jest już dostępna na liście.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać pozycji.');
    } finally {
      setSaving(false);
    }
  };

  const deleteValue = async (entry: string) => {
    if (saving) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const next = await removeDocumentDictionaryValue(category, entry);
      onSaved(next);
      setSuccess('Pozycja „' + entry + '” została usunięta ze wspólnego słownika.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się usunąć pozycji.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/50 p-3 md:p-6">
      <section className="flex max-h-[min(820px,94vh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><BookOpen size={19}/></span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Słowniki kreatora dokumentów</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Dodane pozycje są zapisywane w bazie ENCO i będą dostępne dla wszystkich użytkowników.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Zamknij słowniki"><X size={18}/></button>
        </header>

        <div className="min-h-0 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <label className="min-w-0 space-y-1.5">
              <span className="text-xs font-semibold text-slate-600">Lista do uzupełnienia</span>
              <select value={category} onChange={(event) => { setCategory(event.target.value as DocumentDictionaryKey); setSuccess(''); setError(''); }} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800">
                {DOCUMENT_DICTIONARY_CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            </label>
            <label className="min-w-0 space-y-1.5">
              <span className="text-xs font-semibold text-slate-600">Nowa stała pozycja</span>
              <div className="flex gap-2">
                <input value={value} maxLength={500} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void addValue(); } }} placeholder="Wpisz nazwę elementu…" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500"/>
                <button type="button" disabled={!value.trim() || saving} onClick={() => void addValue()} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-40"><Plus size={14}/>{saving ? 'Zapis…' : 'Dodaj'}</button>
              </div>
            </label>
          </div>

          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}
          {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{success}</p>}

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
              <div><h3 className="text-sm font-bold text-slate-800">{selectedLabel}</h3><p className="text-[11px] text-slate-500">{dictionaries[category].length} pozycji na liście</p></div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500">Słownik wspólny</span>
            </div>
            <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {dictionaries[category].map((entry) => {
                const isDefault = DEFAULT_DOCUMENT_DICTIONARIES[category].some((defaultEntry) => defaultEntry.toLocaleLowerCase('pl-PL') === entry.toLocaleLowerCase('pl-PL'));
                return (
                  <div key={entry} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <span className="block truncate text-sm text-slate-700">{entry}</span>
                      <span className="text-[10px] text-slate-400">{isDefault ? 'Pozycja wbudowana' : 'Pozycja dodana przez użytkownika'}</span>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void deleteValue(entry)}
                      title={'Usuń pozycję: ' + entry}
                      aria-label={'Usuń pozycję: ' + entry}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-40"
                    >
                      <Trash2 size={13}/> Usuń
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <footer className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Gotowe</button>
        </footer>
      </section>
    </div>
  );
};

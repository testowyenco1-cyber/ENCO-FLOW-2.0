import React from 'react';
import { getSmallElementRows, inferSmallElementCategory, type EnclosureDocumentData } from './documentModel';
import { DocumentRowsEditor } from './DocumentRowsEditor';
import type { DocumentDictionaries } from './documentDictionaries';

type Props = {
  data: EnclosureDocumentData;
  onChange: (next: EnclosureDocumentData) => void;
  disabled?: boolean;
  dictionaries: DocumentDictionaries;
};

const inputClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500';
const Field: React.FC<{
  label: string; value: string; onChange: (value: string) => void;
  disabled?: boolean; type?: string; multiline?: boolean; placeholder?: string;
}> = ({ label, value, onChange, disabled, type = 'text', multiline, placeholder }) => (
  <label className="block min-w-0 space-y-1.5">
    <span className="text-xs font-semibold text-slate-600">{label}</span>
    {multiline
      ? <textarea className={inputClass + ' min-h-20 resize-y'} value={value || ''} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}/>
      : <input className={inputClass} type={type} value={value || ''} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}/>}
  </label>
);

const Section: React.FC<{ number: string; title: string; description?: string; children: React.ReactNode }> = ({ number, title, description, children }) => (
  <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-[11px] font-bold text-white">{number}</span>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {description && <p className="mt-1 pl-8 text-[11px] text-slate-500">{description}</p>}
    </div>
    <div className="space-y-3 p-4">{children}</div>
  </section>
);

export const EnclosureDocumentForm: React.FC<Props> = ({ data, onChange, disabled = false, dictionaries }) => {
  const set = (key: keyof EnclosureDocumentData, value: unknown) => onChange({ ...data, [key]: value });
  const field = (key: keyof EnclosureDocumentData, label: string, options: { type?: string; multiline?: boolean; placeholder?: string } = {}) => (
    <Field key={String(key)} label={label} value={String(data[key] ?? '')} disabled={disabled} type={options.type} multiline={options.multiline} placeholder={options.placeholder} onChange={(value) => set(key, value)}/>
  );

  return (
    <div className="space-y-3 pb-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3">
        <p className="text-xs font-semibold text-blue-900">Dane formularza są punktem wyjścia. Po wygenerowaniu podglądu możesz edytować tekst i komórki bezpośrednio na gotowym dokumencie.</p>
      </div>

      <Section number="01" title="Dane zlecenia i stacji">
        <div className="grid grid-cols-2 gap-3">{field('numerZL', 'Numer ZL')}{field('numerZD', 'Numer ZD')}{field('dataZD', 'Data ZD', { type: 'date' })}{field('dataWystawienia', 'Data wystawienia', { type: 'date' })}{field('terminRealizacji', 'Termin realizacji', { type: 'date' })}{field('typBudowli', 'Typ budowli')}</div>
        <div className="grid grid-cols-2 gap-3">{field('typObudowy', 'Typ obudowy')}{field('rozmiar', 'Rozmiar')}</div>
        {field('nazwaObiektu', 'Nazwa obiektu / inwestycji')}
        <div className="grid grid-cols-2 gap-3">{field('oznaczenieStacji', 'Oznaczenie stacji')}{field('dotExtra', 'Dodatkowa informacja DOT.')}</div>
      </Section>

      <Section number="02" title="Zakres wykonania i konstrukcja">
        {field('opisObudowy', 'Opis zakresu wykonania', { multiline: true })}
        <div className="grid grid-cols-2 gap-3">{field('dlugosc', 'Długość / głębokość')}{field('szerokosc', 'Szerokość')}{field('wysokosc', 'Wysokość')}{field('konstrukcja', 'Konstrukcja')}</div>
        <div className="grid grid-cols-2 gap-3">{field('scianyIlosc', 'Ściany — ilość / układ')}{field('scianyKlasa', 'Klasa / rodzaj ścian')}{field('dachTyp', 'Rodzaj dachu')}{field('dachKlasa', 'Klasa / materiał dachu')}</div>
      </Section>

      <Section number="03" title="Drzwi, ślusarka i drobne elementy">
        <DocumentRowsEditor title="Drzwi i ślusarka" value={data.slusarka} onChange={(value) => set('slusarka', value)} disabled={disabled} kind="door" options={dictionaries.doors}/>
        <p className="text-xs leading-5 text-slate-500">Każdy element dodaj jako osobną pozycję. Określ ilość, jednostkę, grupę i miejsce montażu. Dach, drzwi oraz przepusty mają własne sekcje — nie dodawaj ich ponownie tutaj.</p>
        <DocumentRowsEditor
          title="Pozostałe elementy do zamontowania"
          value={getSmallElementRows(data)}
          onChange={(value) => onChange({
            ...data,
            drobneElementy: value.map((row) => ({
              ...row,
              category: row.category || inferSmallElementCategory(row.type),
              unit: row.unit || 'szt.',
            })),
            dodatkoweWyposazenie: [],
          })}
          disabled={disabled}
          kind="small-element"
          addLabel="Dodaj element do zamontowania"
          options={dictionaries.smallElements}
        />
      </Section>

      <Section number="04" title="Kolory i elewacja">
        <div className="grid grid-cols-2 gap-3">{field('kolorObudowy', 'Kolor obudowy (RAL)')}{field('kolorSlusarki', 'Kolor ślusarki (RAL)')}{field('kolorDachu', 'Kolor dachu (RAL)')}{field('kolorDrzwiKraty', 'Kolor drzwi i krat (RAL)')}</div>
        <div className="grid grid-cols-2 gap-3">{field('tynk', 'Tynk / wykończenie')}{field('tynkStruktura', 'Struktura tynku', { placeholder: 'Np. baranek, gładki' })}{field('antygraffiti', 'Powłoka antygraffiti')}</div>
        {field('opisyDodatkowe', 'Dodatkowe opisy / wymagania wykonawcze', { multiline: true })}
      </Section>

      <Section number="05" title="Przepusty kablowe i otwory">
        <DocumentRowsEditor title="Przepusty kablowe" value={data.przepusty} onChange={(value) => set('przepusty', value)} disabled={disabled} kind="passage" options={dictionaries.passages}/>
        <DocumentRowsEditor title="Pozostałe otwory" value={data.otwory} onChange={(value) => set('otwory', value)} disabled={disabled} kind="passage" options={dictionaries.openings}/>
      </Section>

      <Section number="06" title="Główne urządzenia i instalacje">
        <div className="space-y-3">
          {field('rozdzielnicaSN', 'Rozdzielnica SN', { multiline: true })}
          {field('rozdzielnicaNN', 'Rozdzielnica NN', { multiline: true })}
          {field('telemechanika', 'Telemechanika', { multiline: true })}
          {field('transformator', 'Transformator stacyjny (TRAFO)', { multiline: true })}
          {field('transformatorPotrzebWlasnych', 'Transformator potrzeb własnych (TPW)', { multiline: true })}
          <div className="grid grid-cols-2 gap-3">{field('uziemienie', 'Uziemienie')}{field('instalacjaOswietleniowa', 'Instalacja oświetleniowa')}</div>
          {field('inneUrzadzenia', 'Inne urządzenia / uwagi', { multiline: true })}
        </div>
      </Section>

      <Section number="07" title="Dostawy i magazyn">
        <p className="text-xs leading-5 text-slate-500">Oddzielne listy pozwalają sprawdzić, które elementy dostarcza Warszawa, a które Pyskowice. Lokalizację lub szczegół wpisz w opisie pozycji.</p>
        <DocumentRowsEditor title="Dostarcza Warszawa" value={data.dostawaWarszawa} onChange={(value) => set('dostawaWarszawa', value)} disabled={disabled} addLabel="Dodaj element Warszawy" options={dictionaries.deliveriesWarszawa}/>
        <DocumentRowsEditor title="Dostarczają Pyskowice" value={data.dostawaPyskowice} onChange={(value) => set('dostawaPyskowice', value)} disabled={disabled} addLabel="Dodaj element Pyskowic" options={dictionaries.deliveriesPyskowice}/>
      </Section>

      <Section number="08" title="Montaż i uwagi końcowe">
        <div className="grid grid-cols-2 gap-3">{field('montazWykonawca', 'Wykonawca montażu')}{field('montazTermin', 'Termin montażu')}{field('montazOdpowiedzialny', 'Odpowiedzialny / jednostka')}</div>
        {field('montazUwagi', 'Uwagi dotyczące montażu', { multiline: true })}
        {field('uwagi', 'Uwagi końcowe', { multiline: true })}
      </Section>
    </div>
  );
};

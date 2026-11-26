import React, { useMemo, useState } from 'react';
import { Order, STATUS_META } from '../types/enco';
import { X, Printer, Search, ClipboardList, Copy, Check } from 'lucide-react';

interface OfferDocumentModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  canDownload?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  typObudowy: 'Typ obudowy', rozmiar: 'Rozmiar', szerokosc: 'Szerokość', glebokosc: 'Głębokość',
  wysokosc: 'Wysokość', wymiary: 'Wymiary', typWysokosci: 'Rodzaj wysokości',
  przepustyNN: 'Przepusty NN', przepustySN: 'Przepusty SN', pokrywyNN: 'Pokrywy NN',
  pokrywySN: 'Pokrywy SN', wkladkiSN: 'Wkładki SN', producent: 'Producent', model: 'Model',
  typRozdzielnicy: 'Typ rozdzielnicy', konfiguracjaPol: 'Konfiguracja pól', liczbaPol: 'Liczba pól',
  iloscPol: 'Ilość pól', parametryTechniczne: 'Parametry techniczne',
  wyposazenieDodatkowe: 'Wyposażenie dodatkowe', moc: 'Moc', mocKVA: 'Moc [kVA]',
  numerSeryjny: 'Numer seryjny', typ: 'Typ', ilosc: 'Ilość', lokalizacja: 'Lokalizacja',
  terminDostawy: 'Termin dostawy', dataDostawy: 'Data dostawy', dataGotowosci: 'Data gotowości',
  planowanaGotowoscTransportu: 'Planowana gotowość transportowa', uwagi: 'Uwagi',
  zakres: 'Zakres', opis: 'Opis', kolor: 'Kolor', kolorRAL: 'Kolor RAL',
  typSterownika: 'Typ sterownika', sterownik: 'Sterownik', akumulator: 'Akumulator',
  antena: 'Antena', maszt: 'Maszt', sensory: 'Sensory', dokumentacja: 'Dokumentacja',
  nrZamowienia: 'Numer zamówienia', kategoria: 'Kategoria', kontrahent: 'Kontrahent',
  dataZamowienia: 'Data zamówienia', planowanaDostawa: 'Planowana dostawa',
};

const INTERNAL_KEYS = new Set(['id', 'orderId', 'createdAt', 'updatedAt', 'history', 'attachments']);

function humanizeKey(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie';
  if (Array.isArray(value)) return value.map(formatValue).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key, nested]) => !INTERNAL_KEYS.has(key) && nested !== '' && nested !== null && nested !== undefined)
      .map(([key, nested]) => `${humanizeKey(key)}: ${formatValue(nested)}`)
      .join('; ');
  }
  return String(value);
}

function getItemDetails(item: Order['items'][number]): string[] {
  return Object.entries(item.details || {})
    .filter(([key, value]) => !INTERNAL_KEYS.has(key) && value !== '' && value !== null && value !== undefined)
    .map(([key, value]) => {
      const formatted = formatValue(value);
      return formatted ? `${humanizeKey(key)}: ${formatted}` : '';
    })
    .filter(Boolean);
}

function formatDate(value?: string): string {
  if (!value) return '';
  const parts = value.split('-');
  return parts.length === 3 ? parts.reverse().join('.') : value;
}

export const OfferDocumentModal: React.FC<OfferDocumentModalProps> = ({
  order,
  isOpen,
  onClose,
  canDownload = true,
}) => {
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const items = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pl-PL');
    if (!query) return order.items;
    return order.items.filter((item) => {
      const haystack = [
        item.name, item.shortName, item.type, item.notes,
        ...getItemDetails(item),
      ].join(' ').toLocaleLowerCase('pl-PL');
      return haystack.includes(query);
    });
  }, [order.items, search]);

  if (!isOpen) return null;

  const statusLabel = (status: keyof typeof STATUS_META) => {
    if (status === 'NOT_APPLICABLE') return 'Nie uwzględniono';
    return STATUS_META[status]?.label || status;
  };

  const handlePrint = () => window.print();

  const handleCopy = async () => {
    const lines = [
      `KARTA KOMPLETACJI ZLECENIA ${order.orderNumber}`,
      order.projectName,
      `Klient: ${order.client}`,
      '',
      ...order.items.flatMap((item, index) => [
        `${index + 1}. ${item.name} — ${statusLabel(item.status)}`,
        ...getItemDetails(item).map((detail) => `   ${detail}`),
        item.notes ? `   Uwagi: ${item.notes}` : '',
        '',
      ].filter(Boolean)),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const readyCount = order.items.filter((item) => item.status === 'READY').length;
  const problemCount = order.items.filter((item) => item.status === 'PROBLEM').length;
  const openCount = order.items.filter((item) => !['READY', 'NOT_APPLICABLE'].includes(item.status)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-2 sm:p-5 print:static print:block print:overflow-visible print:bg-white print:p-0">
      <div className="my-3 w-full max-w-6xl overflow-hidden rounded-xl border border-slate-300 bg-white shadow-2xl print:my-0 print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-900 text-white"><ClipboardList className="h-5 w-5" /></div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Karta kompletacji zlecenia</h2>
              <p className="text-xs text-slate-500">{order.orderNumber} · {order.projectName}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handleCopy} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Skopiowano' : 'Kopiuj listę'}
            </button>
            {canDownload && <button type="button" onClick={handlePrint} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"><Printer className="h-4 w-4" /> Drukuj / Zapisz PDF</button>}
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900" aria-label="Zamknij"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="p-5 sm:p-7 print:p-0">
          <div className="mb-5 border-b-2 border-slate-800 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-900">ENCO FLOW · dokument wewnętrzny</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">KARTA KOMPLETACJI ZLECENIA</h1>
                <p className="mt-1 text-sm font-semibold text-slate-700">{order.projectName}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl font-black text-slate-950">{order.orderNumber}</p>
                <p className="text-xs text-slate-500">Wydruk: {new Date().toLocaleDateString('pl-PL')}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
              <div><span className="block text-slate-500">Klient</span><strong>{order.client || '—'}</strong></div>
              <div><span className="block text-slate-500">Gabaryt stacji</span><strong>{order.stationSize || '—'}</strong></div>
              <div><span className="block text-slate-500">Planowany wyjazd</span><strong>{formatDate(order.departureDate) || 'Nieustalony'}</strong></div>
              <div><span className="block text-slate-500">Pozycji na liście</span><strong>{order.items.length}</strong></div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-2"><strong className="block text-lg text-emerald-800">{readyCount}</strong><span className="text-[10px] font-semibold text-emerald-900">Gotowe wg statusu</span></div>
            <div className="rounded border border-amber-200 bg-amber-50 px-2 py-2"><strong className="block text-lg text-amber-900">{openCount}</strong><span className="text-[10px] font-semibold text-amber-950">Wymagają uwagi</span></div>
            <div className="rounded border border-rose-200 bg-rose-50 px-2 py-2"><strong className="block text-lg text-rose-800">{problemCount}</strong><span className="text-[10px] font-semibold text-rose-900">Problemy</span></div>
          </div>

          <div className="print:hidden mb-3 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj pozycji lub parametru..." className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>

          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">Wykaz elementów i wyposażenia</h2>
            <span className="text-[10px] text-slate-500">Zaznaczenie magazynowe wypełnia się podczas kontroli</span>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full border-collapse text-left text-[11px] leading-snug">
              <thead className="bg-slate-100 text-slate-800">
                <tr>
                  <th className="w-8 border border-slate-400 px-2 py-2 text-center">Lp.</th>
                  <th className="w-[18%] border border-slate-400 px-2 py-2">Pozycja</th>
                  <th className="border border-slate-400 px-2 py-2">Parametry / specyfikacja</th>
                  <th className="w-[12%] border border-slate-400 px-2 py-2">Status realizacji</th>
                  <th className="w-[10%] border border-slate-400 px-2 py-2 text-center">Odnaleziono</th>
                  <th className="w-[17%] border border-slate-400 px-2 py-2">Lokalizacja / uwagi magazynu</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const details = getItemDetails(item);
                  const meta = STATUS_META[item.status];
                  return (
                    <tr key={item.id} className="break-inside-avoid align-top">
                      <td className="border border-slate-300 px-2 py-2 text-center font-mono">{order.items.indexOf(item) + 1}</td>
                      <td className="border border-slate-300 px-2 py-2">
                        <strong className="block text-slate-900">{item.name || item.shortName}</strong>
                        <span className="mt-0.5 block text-[9px] text-slate-500">{item.type}</span>
                        {item.orderDate && <span className="mt-1 block text-[9px] text-slate-600">Zlecono: {formatDate(item.orderDate)}</span>}
                        {item.plannedDate && <span className="block text-[9px] text-slate-600">Plan: {formatDate(item.plannedDate)}</span>}
                      </td>
                      <td className="border border-slate-300 px-2 py-2">
                        {details.length ? <ul className="space-y-0.5">{details.map((detail, detailIndex) => <li key={detailIndex}>{detail}</li>)}</ul> : <span className="text-slate-400">Brak uzupełnionych parametrów</span>}
                        {item.notes && <p className="mt-1 border-t border-dashed border-slate-300 pt-1"><strong>Uwagi do pozycji:</strong> {item.notes}</p>}
                        {item.attachments?.length > 0 && <p className="mt-1 text-[9px] text-slate-600"><strong>Załączniki:</strong> {item.attachments.map((attachment) => attachment.name).filter(Boolean).join(', ')}</p>}
                      </td>
                      <td className="border border-slate-300 px-2 py-2">
                        <span className="font-bold">{statusLabel(item.status)}</span>
                        {item.completedDate && <span className="mt-1 block text-[9px] text-slate-600">Data: {formatDate(item.completedDate)}</span>}
                        {meta?.label === 'Problem' && <span className="mt-1 block font-semibold text-rose-700">Wymaga wyjaśnienia</span>}
                      </td>
                      <td className="border border-slate-300 px-2 py-2 text-center">
                        <span className="inline-block h-5 w-5 border-2 border-slate-500" aria-label="Pole do odhaczenia" />
                        <span className="mt-1 block text-[9px] text-slate-500">□ Tak</span>
                      </td>
                      <td className="border border-slate-300 px-2 py-2">
                        <div className="min-h-9" />
                        <div className="border-b border-dotted border-slate-400" />
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && <tr><td colSpan={6} className="border border-slate-300 px-3 py-8 text-center text-slate-500">Brak pozycji pasujących do wyszukiwania.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-8 border-t border-slate-300 pt-4 text-[11px] text-slate-700">
            <div><p className="mb-7 font-semibold">Kontrolę przeprowadził(a):</p><div className="border-t border-slate-500 pt-1">Imię i nazwisko / data</div></div>
            <div><p className="mb-7 font-semibold">Potwierdzenie kompletacji:</p><div className="border-t border-slate-500 pt-1">Podpis</div></div>
          </div>
          {order.generalNotes && <div className="mt-4 rounded border border-slate-300 p-3 text-[11px]"><strong>Uwagi ogólne do zlecenia:</strong><p className="mt-1 whitespace-pre-wrap">{order.generalNotes}</p></div>}
          <p className="mt-4 text-[9px] text-slate-500">Status realizacji pochodzi z ENCO Flow. Pole „Odnaleziono” i lokalizacja służą do fizycznej kontroli magazynowej i nie zmieniają statusu w systemie.</p>
        </div>

        <div className="print:hidden flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
          <span className="text-xs text-slate-500">Wydrukuj lub zapisz jako PDF z poziomu okna drukowania.</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Zamknij</button>
            {canDownload && <button type="button" onClick={handlePrint} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"><Printer className="h-4 w-4" /> Drukuj</button>}
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          html, body { background: #fff !important; }
          body * { visibility: hidden; }
          .fixed.inset-0, .fixed.inset-0 * { visibility: visible; }
          .fixed.inset-0 { position: absolute !important; inset: 0 !important; display: block !important; overflow: visible !important; background: #fff !important; padding: 0 !important; }
          .fixed.inset-0 > div { width: 100% !important; max-width: none !important; margin: 0 !important; border: 0 !important; box-shadow: none !important; overflow: visible !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
};

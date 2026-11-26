import type { Order, OrderItem } from '../../types/enco';

export interface DocumentRow {
  id: string;
  type: string;
  quantity: string;
  position: string;
  width?: string;
  height?: string;
  cableType?: string;
  diameter?: string;
  sealType?: string;
  sealVariant?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface EnclosureDocumentData {
  typBudowli: string;
  typObudowy: string;
  rozmiar: string;
  nazwaObiektu: string;
  oznaczenieStacji: string;
  numerZD: string;
  dataZD: string;
  numerZL: string;
  dataWystawienia: string;
  terminRealizacji: string;
  dotExtra: string;
  opisObudowy: string;
  dlugosc: string;
  szerokosc: string;
  wysokosc: string;
  konstrukcja: string;
  scianyIlosc: string;
  scianyKlasa: string;
  dachTyp: string;
  dachKlasa: string;
  drobneElementy: DocumentRow[];
  slusarka: DocumentRow[];
  przepusty: DocumentRow[];
  otwory: DocumentRow[];
  kolorObudowy: string;
  kolorSlusarki: string;
  kolorDachu: string;
  kolorDrzwiKraty: string;
  tynk: string;
  tynkStruktura: string;
  antygraffiti: string;
  rozdzielnicaSN: string;
  rozdzielnicaNN: string;
  telemechanika: string;
  transformator: string;
  transformatorPotrzebWlasnych: string;
  uziemienie: string;
  instalacjaOswietleniowa: string;
  inneUrzadzenia: string;
  dostawaWarszawa: DocumentRow[];
  dostawaPyskowice: DocumentRow[];
  montazWykonawca: string;
  montazTermin: string;
  montazOdpowiedzialny: string;
  montazUwagi: string;
  uwagi: string;
  dodatkoweWyposazenie: string[];
  customFields: Record<string, unknown>;
  documentContentHtml?: string;
  documentContentUpdatedAt?: string;
  documentContentManual?: boolean;
  __sourceSnapshotApplied?: boolean;
  __templateVersion?: number;
  [key: string]: unknown;
}

const today = () => {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};

const asText = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(', ');
  return '';
};

const firstText = (...values: unknown[]): string => {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return '';
};

const makeRow = (prefix: string, index: number, value: unknown): DocumentRow => {
  if (typeof value === 'string') {
    return { id: `${prefix}-${index + 1}`, type: value, quantity: '1', position: '' };
  }
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    ...row,
    id: String(row.id || `${prefix}-${index + 1}`),
    type: firstText(row.type, row.category, row.label, row.name, row.value),
    quantity: firstText(row.quantity, '1'),
    position: firstText(row.position, row.location),
  };
};

export const normalizeDocumentRows = (value: unknown, prefix: string): DocumentRow[] => {
  const rows = Array.isArray(value)
    ? value
    : typeof value === 'string' && value.trim()
      ? value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      : [];
  return rows.map((row, index) => makeRow(prefix, index, row));
};

const summarizeDetails = (details: Record<string, unknown> | undefined): string => {
  if (!details) return '';
  const preferred = [
    'producent', 'model', 'typ', 'rodzaj', 'moc', 'iloscPol', 'liczbaPol',
    'konfiguracja', 'nazwa', 'opis', 'specyfikacja', 'parametry', 'uwagi',
    'nrSeryjny', 'numerSeryjny', 'seryjny', 'wyposazenie',
  ];
  const values = preferred
    .map((key) => {
      const value = details[key];
      const text = asText(value);
      return text ? text : '';
    })
    .filter(Boolean);
  if (values.length) return Array.from(new Set(values)).join(' · ');

  const ignored = new Set(['formularze', 'attachments', 'files', 'history', 'createdAt', 'updatedAt']);
  return Object.entries(details)
    .filter(([key, value]) => !ignored.has(key) && !key.startsWith('__') && (typeof value === 'string' || typeof value === 'number'))
    .map(([key, value]) => `${key}: ${String(value)}`)
    .filter(Boolean)
    .slice(0, 8)
    .join(' · ');
};

const relatedSummary = (order: Order, type: string): string => {
  const related = order.items.find((candidate) => candidate.type === type);
  return summarizeDetails(related?.details);
};

const sourceRows = (order: Order, type: string): DocumentRow[] => {
  const related = order.items.find((candidate) => candidate.type === type);
  const details = related?.details || {};
  const rows = details.documentRows || details.pozycje || details.elementy;
  if (rows) return normalizeDocumentRows(rows, type.toLowerCase());
  const name = firstText(details.typ, details.rodzaj, details.nazwa, details.opis);
  if (!name) return [];
  return [makeRow(type.toLowerCase(), 0, {
    type: name,
    quantity: firstText(details.ilosc, '1'),
    position: firstText(details.lokalizacja, details.uwagi),
  })];
};

const sourceData = (order: Order, item: OrderItem): EnclosureDocumentData => {
  const details = item.details || {};
  const colors = order.items.find((candidate) => candidate.type === 'KOLORY')?.details || {};
  const descriptions = order.items.find((candidate) => candidate.type === 'OPISY')?.details || {};
  const doorDetails = order.items.find((candidate) => candidate.type === 'DRZWI')?.details || {};
  const doorRows = sourceRows(order, 'DRZWI');
  const stationSize = firstText(details.rozmiar, order.stationSize);
  const stationType = firstText(details.typObudowy, details.typ, stationSize.match(/^(BEK|NZ)\\b/i)?.[1] || '');

  return {
    typBudowli: firstText(details.typBudowli, 'Stacja transformatorowa'),
    typObudowy: stationType,
    rozmiar: stationSize,
    nazwaObiektu: order.projectName || '',
    oznaczenieStacji: firstText(details.oznaczenieStacji, details.oznaczenie),
    numerZD: firstText(details.numerZD, details.nrZD),
    dataZD: firstText(item.orderDate, details.dataZD, details.dataZlecenia),
    numerZL: order.orderNumber || '',
    dataWystawienia: today(),
    terminRealizacji: item.plannedDate || '',
    dotExtra: '',
    opisObudowy: firstText(details.opisObudowy, details.opis) ||
      (details.typObudowy || details.rozmiar
        ? `Wykonanie obudowy ${[asText(details.typObudowy), asText(details.rozmiar)].filter(Boolean).join(' ')} wraz z fundamentem i przepustami kablowymi SN, nN i uziemiającymi.`
        : ''),
    dlugosc: firstText(details.dlugosc, details.glebokosc),
    szerokosc: firstText(details.szerokosc),
    wysokosc: firstText(details.wysokosc),
    konstrukcja: firstText(details.konstrukcja, details.rodzajKonstrukcji),
    scianyIlosc: firstText(details.scianyIlosc, details.iloscScian),
    scianyKlasa: firstText(details.scianyKlasa, details.klasaBetonu),
    dachTyp: firstText(details.dachTyp, details.typDachu),
    dachKlasa: firstText(details.dachKlasa, details.klasaDachu),
    drobneElementy: normalizeDocumentRows(details.drobneElementy || details.elementyDodatkowe, 'element'),
    slusarka: doorRows,
    przepusty: normalizeDocumentRows(details.przepusty, 'przepust'),
    otwory: normalizeDocumentRows(details.otwory, 'otwor'),
    kolorObudowy: firstText(colors.kolorObudowy, details.kolorObudowy),
    kolorSlusarki: firstText(colors.kolorSlusarki, colors.kolorDrzwi, details.kolorSlusarki),
    kolorDachu: firstText(colors.kolorDachu, colors.koloryDodatkowe, details.kolorDachu),
    kolorDrzwiKraty: firstText(colors.kolorDrzwiKraty, colors.kolorDrzwi, details.kolorDrzwiKraty),
    tynk: firstText(details.tynk, details.wykonczenie, details.materialWykonczenia),
    tynkStruktura: firstText(details.tynkStruktura, details.strukturaTynku),
    antygraffiti: firstText(details.antygraffitiStatus, details.antygraffiti),
    rozdzielnicaSN: relatedSummary(order, 'ROZDZIELNICA_SN'),
    rozdzielnicaNN: relatedSummary(order, 'ROZDZIELNICA_NN'),
    telemechanika: relatedSummary(order, 'SZAFKA_TELEMECHANIKI'),
    transformator: relatedSummary(order, 'TRANSFORMATOR'),
    transformatorPotrzebWlasnych: relatedSummary(order, 'TRANSFORMATOR_POTRZEB_WLASNYCH'),
    uziemienie: firstText(details.uziemienie, details.typUziemienia, details.instalacjaUziemiajaca),
    instalacjaOswietleniowa: firstText(details.instalacjaOswietleniowa, details.oswietlenie),
    inneUrzadzenia: relatedSummary(order, 'DODATKOWE') || asText(descriptions.documentSummary),
    dostawaWarszawa: [],
    dostawaPyskowice: [],
    montazWykonawca: '',
    montazTermin: '',
    montazOdpowiedzialny: '',
    montazUwagi: '',
    uwagi: '',
    dodatkoweWyposazenie: [],
    customFields: {
      sourceDoorDetails: doorDetails,
    },
    __sourceSnapshotApplied: true,
  };
};

export const createEnclosureDocumentData = (order: Order): EnclosureDocumentData => {
  const item = order.items.find((candidate) => candidate.type === 'OBUDOWA');
  const base = item ? sourceData(order, item) : sourceData(order, {
    id: 'missing', orderId: order.id, type: 'OBUDOWA', name: 'OBUDOWA', shortName: 'OBUDOWA',
    status: 'NOT_ORDERED', details: {}, attachments: [], createdAt: order.createdAt, updatedAt: order.updatedAt,
  } as OrderItem);
  const saved = item?.details?.formularze?.zlecenieObudowy;
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return base;

  // Legacy forms are imported once. Once marked, blank fields remain blank instead
  // of silently pulling changed source values from the live order on every open.
  const savedData = saved as Partial<EnclosureDocumentData>;
  const hydrated: EnclosureDocumentData = { ...base, ...savedData, __sourceSnapshotApplied: true };
  if (!savedData.__sourceSnapshotApplied) {
    for (const [key, sourceValue] of Object.entries(base)) {
      const savedValue = (savedData as Record<string, unknown>)[key];
      const empty = savedValue === undefined || savedValue === null || savedValue === '' || (Array.isArray(savedValue) && savedValue.length === 0);
      if (empty && sourceValue !== undefined) (hydrated as Record<string, unknown>)[key] = sourceValue;
    }
  }

  hydrated.customFields = { ...base.customFields, ...(savedData.customFields || {}) };
  hydrated.drobneElementy = normalizeDocumentRows(savedData.drobneElementy ?? base.drobneElementy, 'element');
  hydrated.slusarka = normalizeDocumentRows(savedData.slusarka ?? base.slusarka, 'door');
  hydrated.przepusty = normalizeDocumentRows(savedData.przepusty ?? base.przepusty, 'przepust');
  hydrated.otwory = normalizeDocumentRows(savedData.otwory ?? base.otwory, 'otwor');
  hydrated.dostawaWarszawa = normalizeDocumentRows(savedData.dostawaWarszawa, 'warszawa');
  hydrated.dostawaPyskowice = normalizeDocumentRows(savedData.dostawaPyskowice, 'pyskowice');
  hydrated.dodatkoweWyposazenie = Array.isArray(savedData.dodatkoweWyposazenie) ? savedData.dodatkoweWyposazenie : [];
  return hydrated as EnclosureDocumentData;
};

export const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const cell = (value: unknown) => {
  const text = asText(value);
  return text ? escapeHtml(text).replace(/\r\n?|\n/g, '<br>') : '—';
};
const datePL = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? value.split('-').reverse().join('.') : value;
const rowsHtml = (rows: DocumentRow[], columns: string[]) => {
  const visible = rows.filter((row) => row.type.trim());
  if (!visible.length) return '<tr><td colspan="' + columns.length + '">Nie wskazano pozycji.</td></tr>';
  return visible.map((row) => '<tr>' + columns.map((key) => {
    const value = key === 'type' ? row.type : key === 'quantity' ? row.quantity : key === 'position'
      ? [row.position, row.cableType, row.diameter ? 'Ø ' + row.diameter : '', row.sealType, row.sealVariant, row.notes].filter(Boolean).join(' · ')
      : row[key];
    return '<td>' + cell(value) + '</td>';
  }).join('') + '</tr>').join('');
};
const table = (headers: string[], body: string) =>
  '<table><thead><tr>' + headers.map((header) => '<th>' + escapeHtml(header) + '</th>').join('') +
  '</tr></thead><tbody>' + body + '</tbody></table>';
const paragraph = (label: string, value: unknown) => asText(value)
  ? '<p><strong>' + escapeHtml(label) + ':</strong> ' + cell(value) + '</p>' : '';

export const buildEnclosureDocumentHtml = (data: EnclosureDocumentData, order: Order): string => {
  const heading = [data.typObudowy, data.rozmiar, data.oznaczenieStacji, data.nazwaObiektu]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || order.projectName || order.orderNumber;
  const deliveryRows = [
    ...data.dostawaWarszawa.map((row) => ({ ...row, position: ['Warszawa', row.position].filter(Boolean).join(' — ') })),
    ...data.dostawaPyskowice.map((row) => ({ ...row, position: ['Pyskowice', row.position].filter(Boolean).join(' — ') })),
  ];

  return `
    <div class="document-sheet">
      <div class="document-brandline"><span>ENCO</span><span>SP. Z O.O. · DOKUMENTACJA PRODUKCYJNA</span></div>
      <p class="document-kicker">Zlecenie produkcyjne</p>
      <h1>ZLECENIE OBUDOWY</h1>
      <h2 class="document-title">${escapeHtml(heading)}</h2>
      ${paragraph('DOT.', [heading, data.dotExtra].filter(Boolean).join(' — '))}
      ${table(['Nr ZL', 'Nr ZD', 'Data ZD', 'Data wystawienia', 'Termin realizacji'], '<tr>' +
        [data.numerZL, data.numerZD, datePL(data.dataZD), datePL(data.dataWystawienia), datePL(data.terminRealizacji)]
          .map((value) => '<td>' + cell(value) + '</td>').join('') + '</tr>')}
      <h2>1. Typ obudowy i zakres wykonania</h2>
      ${paragraph('Typ budowli', data.typBudowli)}
      ${paragraph('Opis zakresu', data.opisObudowy)}
      ${table(['Długość / głębokość', 'Szerokość', 'Wysokość', 'Konstrukcja'], '<tr>' +
        [data.dlugosc, data.szerokosc, data.wysokosc, data.konstrukcja].map(cell).map((v) => '<td>' + v + '</td>').join('') + '</tr>')}
      ${paragraph('Ściany', [data.scianyIlosc, data.scianyKlasa].filter(Boolean).join(' · '))}
      ${paragraph('Dach', [data.dachTyp, data.dachKlasa].filter(Boolean).join(' · '))}
      <h2>2. Drzwi, ślusarka i mniejsze elementy</h2>
      <h3>Drzwi i ślusarka</h3>
      ${table(['Element', 'Ilość', 'Położenie / opis'], rowsHtml(data.slusarka, ['type', 'quantity', 'position']))}
      <h3>Pozostałe elementy do zamontowania</h3>
      ${table(['Element', 'Ilość', 'Położenie / opis'], rowsHtml([...data.drobneElementy, ...data.dodatkoweWyposazenie.map((type, i) => ({ id: 'extra-' + i, type, quantity: '1', position: '' }))], ['type', 'quantity', 'position']))}
      <h2>3. Kolory i wykończenie elewacji</h2>
      ${table(['Obudowa', 'Ślusarka', 'Dach', 'Drzwi i kraty'], '<tr>' +
        [data.kolorObudowy, data.kolorSlusarki, data.kolorDachu, data.kolorDrzwiKraty].map(cell).map((v) => '<td>' + v + '</td>').join('') + '</tr>')}
      ${paragraph('Tynk', data.tynk)}
      ${paragraph('Struktura', data.tynkStruktura)}
      ${paragraph('Powłoka antygraffiti', data.antygraffiti)}
      <h2>4. Przepusty kablowe i otwory</h2>
      <h3>Przepusty</h3>
      ${table(['Typ', 'Ilość', 'Lokalizacja / parametry'], rowsHtml(data.przepusty, ['type', 'quantity', 'position']))}
      <h3>Pozostałe otwory</h3>
      ${table(['Typ', 'Ilość', 'Lokalizacja / parametry'], rowsHtml(data.otwory, ['type', 'quantity', 'position']))}
      <h2>5. Główne urządzenia i instalacje</h2>
      ${table(['Komponent', 'Opis / konfiguracja'], [
        ['Rozdzielnica SN', data.rozdzielnicaSN], ['Rozdzielnica NN', data.rozdzielnicaNN],
        ['Telemechanika', data.telemechanika], ['Transformator stacyjny (TRAFO)', data.transformator],
        ['Transformator potrzeb własnych (TPW)', data.transformatorPotrzebWlasnych],
        ['Uziemienie', data.uziemienie], ['Instalacja oświetleniowa', data.instalacjaOswietleniowa],
        ['Inne urządzenia', data.inneUrzadzenia],
      ].filter((entry) => asText(entry[1])).map(([label, value]) => '<tr><td><strong>' + escapeHtml(label) + '</strong></td><td>' + cell(value) + '</td></tr>').join('') || '<tr><td colspan="2">Nie uzupełniono danych urządzeń.</td></tr>')}
      <h2>6. Zestawienie dostaw</h2>
      ${table(['Dostawca', 'Element', 'Ilość', 'Lokalizacja / uwagi'], rowsHtml(deliveryRows, ['position', 'type', 'quantity', 'notes']))}
      <h2>7. Wykonanie montażu stacji</h2>
      ${paragraph('Wykonawca', data.montazWykonawca)}
      ${paragraph('Termin montażu', data.montazTermin)}
      ${paragraph('Odpowiedzialny / jednostka', data.montazOdpowiedzialny)}
      ${paragraph('Uwagi montażowe', data.montazUwagi)}
      <h2>Uwagi końcowe</h2>
      ${paragraph('Uwagi', data.uwagi) || '<p>—</p>'}
      <div class="document-footer"><span>ENCO Sp. z o.o.</span><span>${escapeHtml(data.numerZL || order.orderNumber)}</span></div>
    </div>`;
};

export const sanitizeDocumentHtml = (html: string): string => html
  .replace(/<\s*(script|iframe|object|embed|svg|form)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
  .replace(/<\s*(script|iframe|object|embed|svg|form)\b[^>]*\/?>/gi, '')
  .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  .replace(/\s+(href|src)\s*=\s*("|')\s*javascript:[\s\S]*?\2/gi, '')
  .slice(0, 500000);

export const updateOrderWithEnclosureDocument = (order: Order, data: EnclosureDocumentData): Order => {
  const item = order.items.find((candidate) => candidate.type === 'OBUDOWA');
  if (!item) return order;
  const now = new Date().toISOString();
  const persisted = {
    ...data,
    documentContentHtml: data.documentContentHtml ? sanitizeDocumentHtml(data.documentContentHtml) : undefined,
    documentContentUpdatedAt: data.documentContentHtml ? now : data.documentContentUpdatedAt,
    __sourceSnapshotApplied: true,
  };
  return {
    ...order,
    items: order.items.map((candidate) => candidate.id !== item.id ? candidate : {
      ...candidate,
      plannedDate: data.terminRealizacji,
      details: {
        ...candidate.details,
        typBudowli: data.typBudowli,
        typObudowy: data.typObudowy,
        rozmiar: data.rozmiar,
        opisObudowy: data.opisObudowy,
        oznaczenieStacji: data.oznaczenieStacji,
        numerZD: data.numerZD,
        dataZD: data.dataZD,
        formularze: {
          ...(candidate.details?.formularze || {}),
          zlecenieObudowy: persisted,
        },
      },
      updatedAt: now,
    }),
    updatedAt: now,
  };
};

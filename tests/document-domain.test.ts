import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDepartureDateUrgency, type Order, type OrderItem } from '../src/types/enco';
import {
  createEnclosureDocumentData,
  getSmallElementRows,
  type EnclosureDocumentData,
} from '../src/components/documents/documentModel';
import {
  buildEnclosureDocumentHtml,
  renderVersionedEnclosureTemplate,
  sanitizeDocumentHtml,
  type VersionedDocumentTemplate,
} from '../src/components/documents/DocumentTemplateService';
import { updateOrderWithEnclosureDocument } from '../src/components/documents/DocumentPersistence';

const makeItem = (
  id: string,
  type: string,
  details: Record<string, unknown> = {},
  plannedDate = '',
): OrderItem => ({
  id,
  orderId: 'order-1',
  type,
  name: type,
  shortName: type,
  status: 'ORDERED',
  plannedDate,
  details,
  attachments: [],
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
});

const makeOrder = (items: OrderItem[]): Order => ({
  id: 'order-1',
  orderNumber: 'ZL 85/2026',
  client: 'ENCO Test',
  projectName: 'TAMA',
  stationSize: 'NZ 210/240',
  departureDate: '2026-12-10',
  generalNotes: '',
  status: 'IN_PROGRESS',
  items,
  attachments: [],
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
});

const legacyEnclosure = makeItem('obudowa-1', 'OBUDOWA', {
  typObudowy: 'NZ',
  rozmiar: 'NZ 210/240',
  symbolStacji: 'ST-2262',
  numerZD: '85',
  dataZD: '2026-09-16',
  dlugoscObudowy: '2400',
  szerokoscObudowy: '2100',
  wysokoscObudowy: '2400',
  konstrukcjaBudynku: 'Prefabrykat betonowy',
  scianyREIIlosc: '4',
  scianyREIKlasa: 'REI 120',
  typDachu: 'Kopertowy',
  dachMaterial: 'Żelbet',
  dachREIKlasa: 'REI 60',
  kolor: 'RAL 7035',
  antygraffiti: false,
  slusarka: [{ id: 'door-legacy', type: 'Drzwi SN', quantity: '2', position: 'Od strony SN' }],
  drobneElementy: ['Kieszenie na schemat'],
  dodatkoweWyposazenie: ['Otwór do anteny'],
  dostawaWarszawa: [{ id: 'w-1', type: 'Most SN z głowicami', quantity: '1', position: 'Warszawa' }],
  dostawaPyskowice: [{ id: 'p-1', type: 'Zaciski krzyżowe', quantity: '4', position: 'Pyskowice' }],
  wyposazenieDachu: ['Chłodnica gazów'],
  siatkaDrzwi: { enabled: true, quantity: '1' },
  siatkaDach: { enabled: true, quantity: '2' },
  uwagiDoZleceniaObudowy: 'Zdjęcia stacji umieścić na serwerze.',
}, '2026-11-30');

test('imports legacy OBUDOWA details and preserves separate delivery lists', () => {
  const order = makeOrder([
    legacyEnclosure,
    makeItem('sn-1', 'ROZDZIELNICA_SN', { producent: 'Siemens', model: '8DJH', liczbaPol: 3 }),
  ]);

  const data = createEnclosureDocumentData(order);

  assert.equal(data.oznaczenieStacji, 'ST-2262');
  assert.equal(data.dataZD, '2026-09-16');
  assert.equal(data.terminRealizacji, '2026-11-30');
  assert.equal(data.dlugosc, '2400');
  assert.equal(data.szerokosc, '2100');
  assert.equal(data.wysokosc, '2400');
  assert.equal(data.konstrukcja, 'Prefabrykat betonowy');
  assert.equal(data.scianyIlosc, '4');
  assert.equal(data.scianyKlasa, 'REI 120');
  assert.equal(data.dachKlasa, 'REI 60');
  assert.equal(data.kolorObudowy, 'RAL 7035');
  assert.equal(data.antygraffiti, 'Nie');
  assert.equal(data.tynk, 'Tynk akrylowy zewnętrzny o strukturze baranka');
  assert.equal(data.tynkStruktura, '');
  assert.equal(data.slusarka[0]?.type, 'Drzwi SN');
  assert.equal(data.dostawaWarszawa[0]?.type, 'Most SN z głowicami');
  assert.equal(data.dostawaPyskowice[0]?.type, 'Zaciski krzyżowe');
  assert.ok(data.dodatkoweWyposazenie.includes('Otwór do anteny'));
  assert.ok(data.dodatkoweWyposazenie.includes('Chłodnica gazów'));
  assert.ok(data.dodatkoweWyposazenie.includes('Siatka wygradzająca przy drzwiach — 1 szt.'));
  assert.ok(data.dodatkoweWyposazenie.includes('Siatka wygradzająca na dachu — 2 szt.'));
  assert.match(data.rozdzielnicaSN, /Siemens/);
  assert.equal(data.uwagi, 'Zdjęcia stacji umieścić na serwerze.');
});

test('door dimensions are optional and manually supplied dimensions are preserved', () => {
  const dedicatedWithoutSize = makeItem('door-1', 'DRZWI', {
    documentRows: [{ id: 'door-new', type: 'Drzwi Trafo', quantity: '1', position: 'Strona transformatora' }],
  });
  const withDedicated = createEnclosureDocumentData(makeOrder([legacyEnclosure, dedicatedWithoutSize]));
  assert.equal(withDedicated.slusarka[0]?.type, 'Drzwi Trafo');
  assert.equal(withDedicated.slusarka[0]?.width, undefined);
  assert.equal(withDedicated.slusarka[0]?.height, undefined);

  const withoutDedicated = createEnclosureDocumentData(makeOrder([legacyEnclosure]));
  assert.equal(withoutDedicated.slusarka[0]?.type, 'Drzwi SN');
  assert.equal(withoutDedicated.slusarka[0]?.width, undefined);
  assert.equal(withoutDedicated.slusarka[0]?.height, undefined);

  const dedicatedWithSize = makeItem('door-2', 'DRZWI', {
    documentRows: [{ id: 'door-manual', type: 'Drzwi SN', quantity: '1', width: '1050', height: '2150' }],
  });
  const withManualSize = createEnclosureDocumentData(makeOrder([legacyEnclosure, dedicatedWithSize]));
  assert.equal(withManualSize.slusarka[0]?.width, '1050');
  assert.equal(withManualSize.slusarka[0]?.height, '2150');
});

test('anti-graffiti is a Tak/Nie option and the standard facade finish is fixed', () => {
  const order = makeOrder([
    makeItem('obudowa-yes', 'OBUDOWA', {
      antygraffiti: true,
      tynk: 'Tynk mineralny',
      tynkStruktura: 'Gładki',
    }),
  ]);
  const data = createEnclosureDocumentData(order);
  assert.equal(data.antygraffiti, 'Tak');
  assert.equal(data.tynk, 'Tynk akrylowy zewnętrzny o strukturze baranka');
  assert.equal(data.tynkStruktura, '');

  const html = buildEnclosureDocumentHtml(data, order);
  assert.match(html, /Wykończenie elewacji/);
  assert.match(html, /Tynk akrylowy zewnętrzny o strukturze baranka/);
  assert.match(html, /Powłoka antygraffiti/);
  assert.ok(html.includes('Powłoka antygraffiti:</strong> Tak'));
  assert.ok(!html.includes('Struktura:'));
});

test('small elements merge legacy extras into one categorized list with quantities', () => {
  const rows = getSmallElementRows({
    drobneElementy: [
      { id: 'hea-1', type: 'Profil stalowy HEA', quantity: '3', unit: 'szt.', position: 'Ściana od strony SN' },
      { id: 'pocket-1', type: 'Kieszeń na schemat', quantity: '2', unit: 'szt.', position: 'Przy drzwiach' },
    ],
    dodatkoweWyposazenie: [
      'Kieszeń na schemat',
      'Otwór do anteny',
      'Siatka wygradzająca na dachu — 2 szt.',
      '3x HEA',
    ],
  });

  assert.equal(rows.length, 5);
  assert.equal(rows[0].quantity, '3');
  assert.equal(rows[0].category, 'Konstrukcja / mocowanie');
  assert.equal(rows[1].category, 'Wnętrze stacji');
  assert.equal(rows[2].type, 'Otwór do anteny');
  assert.equal(rows[2].quantity, '1');
  assert.equal(rows[3].type, 'Siatka wygradzająca na dachu');
  assert.equal(rows[3].quantity, '2');
  assert.equal(rows[3].unit, 'szt.');
  assert.equal(rows[4].type, 'HEA');
  assert.equal(rows[4].quantity, '3');
  assert.equal(rows[4].category, 'Konstrukcja / mocowanie');
});

test('document generator and legacy array tokens render structured tables', () => {
  const order = makeOrder([legacyEnclosure]);
  const data = createEnclosureDocumentData(order);
  const localHtml = buildEnclosureDocumentHtml(data, order);
  assert.match(localHtml, /ZLECENIE OBUDOWY/);
  assert.match(localHtml, /Most SN z głowicami/);
  assert.match(localHtml, /Zaciski krzyżowe/);
  assert.match(localHtml, /Grupa/);
  assert.match(localHtml, /Otwór do anteny/);
  assert.match(localHtml, /2 szt\./);

  const template: VersionedDocumentTemplate = {
    key: 'zlecenie-obudowy',
    title: 'Test template',
    version: 3,
    contentHtml: '<div><h1>{{derived.title}}</h1><p>{{form.numerZD}}</p><div>{{form.slusarka}}</div><div>{{form.dostawaWarszawa}}</div><div>{{derived.smallElements}}</div><div>{{derived.openings}}</div></div><script>alert(1)</script>',
    sections: [],
    fields: [],
    rules: [],
  };
  const rendered = renderVersionedEnclosureTemplate(template, data, order);
  assert.match(rendered, /<table>/);
  assert.match(rendered, /Drzwi SN/);
  assert.match(rendered, /Most SN z głowicami/);
  assert.match(rendered, /Siatka wygradzająca na dachu/);
  assert.match(rendered, /Grupa/);
  assert.doesNotMatch(rendered, /<script/i);
  assert.doesNotMatch(rendered, /\{\{form\./);
});

test('empty automatic fields remove their whole label paragraph or table row', () => {
  const order = makeOrder([legacyEnclosure]);
  const data: EnclosureDocumentData = {
    ...createEnclosureDocumentData(order),
    antygraffiti: '',
    scianyIlosc: '',
    scianyKlasa: 'REI 120',
  };
  const template: VersionedDocumentTemplate = {
    key: 'zlecenie-obudowy',
    title: 'Empty fields test',
    version: 1,
    contentHtml: '<div>' +
      '<p><strong>Powłoka antygraffiti:</strong> {{form.antygraffiti}}</p>' +
      '<table><tbody>' +
      '<tr><td>Powłoka antygraffiti</td><td>{{form.antygraffiti}}</td></tr>' +
      '<tr><td>Nr ZD</td><td>{{form.numerZD}}</td></tr>' +
      '</tbody></table>' +
      '<p><strong>Ściany:</strong> {{form.scianyIlosc}} · {{form.scianyKlasa}}</p>' +
      '</div>',
    sections: [],
    fields: [],
    rules: [],
  };

  const rendered = renderVersionedEnclosureTemplate(template, data, order);

  assert.doesNotMatch(rendered, /Powłoka antygraffiti/);
  assert.match(rendered, /Nr ZD/);
  assert.match(rendered, /<td>85<\/td>/);
  assert.match(rendered, /<strong>Ściany:<\/strong>\s*REI 120/);
  assert.doesNotMatch(rendered, /—/);
});

test('array-backed document rows are not mistaken for empty fields', () => {
  const order = makeOrder([legacyEnclosure]);
  const data = createEnclosureDocumentData(order);
  const template: VersionedDocumentTemplate = {
    key: 'zlecenie-obudowy',
    title: 'Array fields test',
    version: 1,
    contentHtml:
      '<div><p>Drzwi: {{form.slusarka}}</p>' +
      '<table><tbody><tr><td>Elementy</td><td>{{form.drobneElementy}}</td></tr></tbody></table></div>',
    sections: [],
    fields: [],
    rules: [],
  };

  const rendered = renderVersionedEnclosureTemplate(template, data, order);

  assert.match(rendered, /Drzwi:/);
  assert.match(rendered, /Drzwi SN/);
  assert.match(rendered, /Elementy/);
  assert.match(rendered, /Kieszenie na schemat/);
});

test('filled automatic fields remain visible in the generated document', () => {
  const order = makeOrder([legacyEnclosure]);
  const data = { ...createEnclosureDocumentData(order), antygraffiti: 'Tak' };
  const template: VersionedDocumentTemplate = {
    key: 'zlecenie-obudowy',
    title: 'Filled fields test',
    version: 1,
    contentHtml: '<p><strong>Powłoka antygraffiti:</strong> {{form.antygraffiti}}</p>',
    sections: [],
    fields: [],
    rules: [],
  };

  const rendered = renderVersionedEnclosureTemplate(template, data, order);

  assert.match(rendered, /Powłoka antygraffiti/);
  assert.match(rendered, /Tak/);
});

test('colour summary only displays the elements with an explicitly supplied colour', () => {
  const order = makeOrder([legacyEnclosure]);
  const data: EnclosureDocumentData = {
    ...createEnclosureDocumentData(order),
    kolorObudowy: 'RAL 7035',
    kolorSlusarki: '',
    kolorDachu: '',
    kolorDrzwiKraty: '',
  };
  const template: VersionedDocumentTemplate = {
    key: 'zlecenie-obudowy',
    title: 'Colour visibility test',
    version: 1,
    contentHtml: '<div>{{derived.colours}}</div>',
    sections: [],
    fields: [],
    rules: [],
  };

  const rendered = renderVersionedEnclosureTemplate(template, data, order);

  assert.ok(rendered.includes('Obudowa / elewacja'));
  assert.match(rendered, /RAL 7035/);
  assert.doesNotMatch(rendered, /Ślusarka|Dach|Drzwi i kraty/);
});

test('document save writes the instance into the existing OBUDOWA form path', () => {
  const order = makeOrder([legacyEnclosure]);
  const data: EnclosureDocumentData = {
    ...createEnclosureDocumentData(order),
    terminRealizacji: '2026-12-12',
    uwagi: 'Zatwierdzone uwagi',
    documentContentHtml: '<div><p>Gotowy dokument</p></div>',
  };
  const updated = updateOrderWithEnclosureDocument(order, data);
  const enclosure = updated.items.find((item) => item.type === 'OBUDOWA');

  assert.ok(enclosure);
  assert.equal(enclosure.plannedDate, '2026-12-12');
  assert.equal(enclosure.details.rozmiar, 'NZ 210/240');
  assert.equal(enclosure.details.formularze.zlecenieObudowy.uwagi, 'Zatwierdzone uwagi');
  assert.match(enclosure.details.formularze.zlecenieObudowy.documentContentHtml, /Gotowy dokument/);
  assert.equal(enclosure.details.dachMaterial, 'Żelbet');
});

test('HTML sanitizer removes event handlers and script tags', () => {
  const html = sanitizeDocumentHtml('<p onclick="alert(1)">Tekst</p><script>alert(1)</script>');
  assert.match(html, /Tekst/);
  assert.doesNotMatch(html, /onclick|<script/i);
});

test('departure urgency uses the current local date, not a hard-coded day', () => {
  const now = new Date();
  const future = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
  const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);
  const asLocalDate = (date: Date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

  const upcoming = getDepartureDateUrgency(asLocalDate(future), false);
  const overdue = getDepartureDateUrgency(asLocalDate(past), false);
  const ready = getDepartureDateUrgency('', true);

  assert.equal(upcoming.status, 'urgent');
  assert.equal(upcoming.daysDiff, 3);
  assert.equal(overdue.status, 'overdue');
  assert.equal(overdue.daysDiff, -2);
  assert.equal(ready.status, 'ready');
});

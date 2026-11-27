import type { Order, OrderItem } from '../../types/enco';

export interface DocumentRow {
  id: string;
  type: string;
  quantity: string;
  unit?: string;
  position: string;
  width?: string;
  height?: string;
  cableType?: string;
  diameter?: string;
  sealType?: string;
  sealVariant?: string;
  notes?: string;
  category?: string;
  wings?: string;
  openingSide?: string;
  ventilationGrille?: boolean;
  intakeFan?: boolean;
  exhaustFan?: boolean;
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
  opisyDodatkowe: string;
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
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('enabled' in record && 'quantity' in record) return record.enabled ? 'Tak, ilość: ' + firstText(record.quantity, '1') : 'Nie';
    return Object.values(record).map(asText).filter(Boolean).join(' · ');
  }
  return '';
};

const firstText = (...values: unknown[]): string => {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return '';
};

const DEFAULT_ENCLOSURE_FINISH = 'Tynk akrylowy zewnętrzny o strukturze baranka';

const normalizeYesNo = (value: unknown): string => {
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie';
  const normalized = asText(value).toLocaleLowerCase('pl-PL');
  if (!normalized) return 'Nie';
  if (/^(nie|no|false|0|brak|niewymagan[ay]?|nie dotyczy)\\b/.test(normalized)) return 'Nie';
  return 'Tak';
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
  return rows.map((row, index) => {
    const normalized = makeRow(prefix, index, row);
    return { ...normalized, unit: firstText(normalized.unit, 'szt.') };
  });
};

/**
 * Merge legacy free-text equipment with repeatable rows into one editable list.
 * Duplicate names are shown once. Quantity annotations from older labels are
 * split back into quantity and unit fields.
 */
export const getSmallElementRows = (
  data: Pick<EnclosureDocumentData, 'drobneElementy' | 'dodatkoweWyposazenie'>,
): DocumentRow[] => {
  const rows: DocumentRow[] = normalizeDocumentRows(data.drobneElementy, 'small-element')
    .map((row) => ({
      ...row,
      category: firstText(row.category, inferSmallElementCategory(row.type)),
    }));
  const seen = new Set(rows.map((row) => row.type.trim().toLocaleLowerCase('pl-PL')));
  const legacy = normalizeDocumentRows(data.dodatkoweWyposazenie, 'additional-element');

  for (const row of legacy) {
    const rawName = row.type.trim();
    if (!rawName) continue;
    const leadingQuantity = rawName.match(/^(\d+(?:[.,]\d+)?)\s*x\s*(.+)$/i);
    const trailingQuantity = rawName.match(/\s*[—-]\s*(\d+(?:[.,]\d+)?)\s*(szt\.?|kpl\.?|m|mb|m²)\s*$/i);
    if (leadingQuantity) {
      row.type = leadingQuantity[2].trim();
      row.quantity = leadingQuantity[1].replace(',', '.');
      row.unit = 'szt.';
    } else if (trailingQuantity) {
      row.type = rawName.slice(0, trailingQuantity.index).trim();
      row.quantity = trailingQuantity[1].replace(',', '.');
      row.unit = trailingQuantity[2].toLocaleLowerCase('pl-PL');
    }
    const key = row.type.toLocaleLowerCase('pl-PL');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    row.category = inferSmallElementCategory(row.type);
    row.unit = firstText(row.unit, 'szt.');
    rows.push(row);
  }
  return rows;
};

export const inferSmallElementCategory = (name: string): string => {
  const value = name.toLocaleLowerCase('pl-PL');
  if (/dach|chłodnic|anten|lampk|siatk.*dach/.test(value)) return 'Dach';
  if (/wentyl|krat/.test(value)) return 'Wentylacja';
  if (/kiesze|schemat|tablic/.test(value)) return 'Wnętrze stacji';
  if (/hea|profil|wspornik|uchwyt|kotw/.test(value)) return 'Konstrukcja / mocowanie';
  return 'Pozostałe';
};

const sourceSummary = (...parts: unknown[]): string => parts.map(asText).filter(Boolean).join(' · ');
const labelledSource = (label: string, value: unknown): string => {
  const text = asText(value);
  return text ? label + ': ' + text : '';
};

const relatedSummary = (order: Order, type: string): string => {
  const related = order.items.find((candidate) => candidate.type === type);
  const enclosure = order.items.find((candidate) => candidate.type === 'OBUDOWA')?.details || {};
  if (!related) {
    if (type === 'OPISY') return sourceSummary(labelledSource('Wymagane opisy', enclosure.wymaganeOpisy), labelledSource('Sposób wykonania', enclosure.sposobWykonania));
    if (type === 'DODATKOWE') return asText(enclosure.inneUrzadzenia);
    return '';
  }
  const d = related.details || {};
  switch (type) {
    case 'ROZDZIELNICA_SN': {
      const count = firstText(d.liczbaPol, d.iloscPol);
      return sourceSummary(d.producent, firstText(d.model, d.typRozdzielnicy), count ? count + ' pól' : '', labelledSource('Konfiguracja pól', d.konfiguracjaPol), d.parametryTechniczne) || asText(related.notes);
    }
    case 'ROZDZIELNICA_NN': {
      const count = firstText(d.iloscPol, d.liczbaPol);
      return sourceSummary(firstText(d.typRozdzielnicy, d.typ), count ? count + ' pól' : '', firstText(d.wyposazenieDodatkowe, d.wyposazenie, d.konfiguracja)) || asText(related.notes);
    }
    case 'OPISY':
      return sourceSummary(labelledSource('Wymagane opisy', d.wymaganeOpisy), labelledSource('Sposób wykonania', d.sposobWykonania)) || asText(related.notes);
    case 'SZAFKA_TELEMECHANIKI':
      return sourceSummary(labelledSource('RTU', firstText(d.typ, d.typSterownika)), labelledSource('Wyposażenie', d.wyposazenie), labelledSource('Zakres', d.zakres), labelledSource('Informacje techniczne', d.informacjeTechniczne), labelledSource('Sensory napięciowe', d.sensoryNapieciowe)) || asText(related.notes);
    case 'TRANSFORMATOR': {
      const power = firstText(d.mocKVA, d.moc);
      const powerLabel = power ? (/kva$/i.test(power) ? power : power + ' kVA') : '';
      return sourceSummary(labelledSource('Producent', d.producent), labelledSource('Typ / model', d.typ), labelledSource('Moc znamionowa', powerLabel), labelledSource('Numer seryjny', firstText(d.numerSeryjny, d.nrSeryjny))) || asText(related.notes);
    }
    case 'TRANSFORMATOR_POTRZEB_WLASNYCH': {
      const power = firstText(d.va, d.mocVA);
      const powerLabel = power ? (/va$/i.test(power) ? power : power + ' VA') : '';
      return sourceSummary(labelledSource('Moc znamionowa transformatora potrzeb własnych', powerLabel), labelledSource('Numer seryjny', firstText(d.numerSeryjny, d.nrSeryjny))) || asText(related.notes);
    }
    case 'DODATKOWE':
      return sourceSummary(labelledSource('Opis', firstText(d.opis, related.notes)), labelledSource('Specyfikacja', d.specyfikacja)) || asText(related.notes);
    default:
      return sourceSummary(d.producent, d.model, d.typ, d.rodzaj, d.opis, d.specyfikacja, related.notes);
  }
};

const sourceRows = (order: Order, type: string): DocumentRow[] => {
  const related = order.items.find((candidate) => candidate.type === type);
  const details = related?.details || {};
  const rows = details.documentRows || details.pozycje || details.elementy;
  if (rows && (!Array.isArray(rows) || rows.length > 0)) {
    return normalizeDocumentRows(rows, type.toLowerCase());
  }
  const name = firstText(details.typ, details.rodzaj, details.kategoria, details.nazwa, details.opis);
  if (!name) return [];
  return normalizeDocumentRows([makeRow(type.toLowerCase(), 0, {
    type: name,
    category: name,
    quantity: firstText(details.ilosc, '1'),
    position: [firstText(details.lokalizacja), firstText(details.dodatkoweWyposazenie), firstText(details.uwagi)].filter(Boolean).join(' — '),
    width: firstText(details.szerokosc),
    height: firstText(details.wysokosc),
    wings: firstText(details.skrzydla, details.liczbaSkrzydel),
    openingSide: firstText(details.stronaOtwierania),
    ventilationGrille: Boolean(details.krataWentylacyjna),
    intakeFan: Boolean(details.wentylatorNawiewny),
    exhaustFan: Boolean(details.wentylatorWyciagowy),
  })], type.toLowerCase());
};

const sourceData = (order: Order, item: OrderItem): EnclosureDocumentData => {
  const details = item.details || {};
  const colors = order.items.find((candidate) => candidate.type === 'KOLORY')?.details || {};
  const descriptions = order.items.find((candidate) => candidate.type === 'OPISY')?.details || {};
  const doorDetails = order.items.find((candidate) => candidate.type === 'DRZWI')?.details || {};
  const relatedDoorRows = sourceRows(order, 'DRZWI');
  // Older records kept the door list directly on OBUDOWA. Prefer the dedicated
  // DRZWI position when it contains rows, otherwise retain that legacy list.
  const doorRows = relatedDoorRows.length
    ? relatedDoorRows
    : normalizeDocumentRows(details.slusarka, 'door');
  const stationSize = firstText(details.rozmiar, order.stationSize);
  const stationType = firstText(details.typObudowy, details.typ, stationSize.match(/^(BEK|NZ)\b/i)?.[1] || '');
  const stationVariant = stationSize && stationType && stationSize.toUpperCase().startsWith(stationType.toUpperCase())
    ? stationSize
    : [stationType, stationSize].filter(Boolean).join(' ');

  const additionalEquipment = Array.isArray(details.dodatkoweWyposazenie)
    ? details.dodatkoweWyposazenie.map(asText).filter(Boolean)
    : [];
  const roofEquipment = Array.isArray(details.wyposazenieDachu)
    ? details.wyposazenieDachu.map(asText).filter(Boolean)
    : [];
  for (const entry of roofEquipment) if (!additionalEquipment.includes(entry)) additionalEquipment.push(entry);
  const doorMesh = details.siatkaDrzwi as { enabled?: unknown; quantity?: unknown } | undefined;
  const roofMesh = details.siatkaDach as { enabled?: unknown; quantity?: unknown } | undefined;
  const doorMeshLabel = doorMesh?.enabled ? 'Siatka wygradzająca przy drzwiach — ' + firstText(doorMesh.quantity, '1') + ' szt.' : '';
  const roofMeshLabel = roofMesh?.enabled ? 'Siatka wygradzająca na dachu — ' + firstText(roofMesh.quantity, '1') + ' szt.' : '';
  if (doorMeshLabel && !additionalEquipment.includes(doorMeshLabel)) additionalEquipment.push(doorMeshLabel);
  if (roofMeshLabel && !additionalEquipment.includes(roofMeshLabel)) additionalEquipment.push(roofMeshLabel);

  const legacyCustomFields: Record<string, unknown> = {
    sourceDoorDetails: doorDetails,
    dachMaterial: firstText(details.dachMaterial),
    wyposazenieDachu: roofEquipment,
    siatkaDrzwi: doorMesh || { enabled: false, quantity: '1' },
    siatkaDach: roofMesh || { enabled: false, quantity: '1' },
    opisy: firstText(details.opisy),
    rozdzielnicaSN: firstText(details.rozdzielnicaSN),
    rozdzielnicaNN: firstText(details.rozdzielnicaNN),
    telemechanika: firstText(details.telemechanika),
    transformator: firstText(details.transformator),
    transformatorPotrzebWlasnych: firstText(details.transformatorPotrzebWlasnych),
    uziemienie: firstText(details.uziemienie),
    instalacjaOswietleniowa: firstText(details.instalacjaOswietleniowa),
    inneUrzadzenia: firstText(details.inneUrzadzenia),
  };

  return {
    typBudowli: firstText(details.typBudowli, 'Stacja transformatorowa'),
    typObudowy: stationType,
    rozmiar: stationSize,
    nazwaObiektu: order.projectName || '',
    oznaczenieStacji: firstText(details.oznaczenieStacji, details.symbolStacji, details.oznaczenie),
    numerZD: firstText(details.numerZD, details.nrZD),
    dataZD: firstText(details.dataZD, item.orderDate, details.dataZlecenia),
    numerZL: order.orderNumber || '',
    dataWystawienia: today(),
    terminRealizacji: firstText(item.plannedDate, details.terminRealizacji, details.terminObudowy),
    dotExtra: '',
    opisObudowy: firstText(details.opisObudowy, details.opis) ||
      (stationVariant
        ? 'Wykonanie obudowy ' + stationVariant + ' wraz z fundamentem i przepustami kablowymi SN, nN i uziemiającymi, wraz z montażem ślusarki i rozdzielnicy SN i nN.'
        : ''),
    dlugosc: firstText(details.dlugoscObudowy, details.dlugosc, details.glebokosc),
    szerokosc: firstText(details.szerokoscObudowy, details.szerokosc),
    wysokosc: firstText(details.wysokoscObudowy, details.wysokosc),
    konstrukcja: firstText(details.konstrukcjaBudynku, details.konstrukcja, details.rodzajKonstrukcji),
    scianyIlosc: firstText(details.scianyIlosc, details.scianyREIIlosc, details.iloscScian),
    scianyKlasa: firstText(details.scianyKlasa, details.scianyREIKlasa, details.klasaBetonu),
    dachTyp: firstText(details.dachTyp, details.typDachu, 'Kopertowy'),
    dachKlasa: firstText(details.dachKlasa, details.dachREIKlasa, details.klasaDachu, details.dachMaterial),
    drobneElementy: normalizeDocumentRows(details.drobneElementy || details.elementyDodatkowe, 'element'),
    slusarka: doorRows,
    przepusty: normalizeDocumentRows(details.przepusty, 'przepust'),
    otwory: normalizeDocumentRows(details.otwory, 'otwor'),
    kolorObudowy: firstText(colors.kolorObudowy, details.kolorObudowy, details.kolor),
    kolorSlusarki: firstText(colors.kolorSlusarki, colors.kolorDrzwi, details.kolorSlusarki, details.kolorDrzwi),
    kolorDachu: firstText(colors.kolorDachu, colors.koloryDodatkowe, details.kolorDachu, details.koloryDodatkowe),
    kolorDrzwiKraty: firstText(colors.kolorDrzwiKraty, colors.kolorDrzwi, details.kolorDrzwiKraty, details.kolorDrzwi),
    // The enclosure uses one fixed finish standard; the user only decides whether
    // the optional anti-graffiti coating is required.
    tynk: DEFAULT_ENCLOSURE_FINISH,
    tynkStruktura: '',
    antygraffiti: normalizeYesNo(firstText(details.antygraffitiStatus, details.antygraffiti)),
    opisyDodatkowe: relatedSummary(order, 'OPISY') || firstText(descriptions.documentSummary, details.opisy),
    rozdzielnicaSN: relatedSummary(order, 'ROZDZIELNICA_SN') || firstText(details.rozdzielnicaSN),
    rozdzielnicaNN: relatedSummary(order, 'ROZDZIELNICA_NN') || firstText(details.rozdzielnicaNN),
    telemechanika: relatedSummary(order, 'SZAFKA_TELEMECHANIKI') || firstText(details.telemechanika),
    transformator: relatedSummary(order, 'TRANSFORMATOR') || firstText(details.transformator),
    transformatorPotrzebWlasnych: relatedSummary(order, 'TRANSFORMATOR_POTRZEB_WLASNYCH') || firstText(details.transformatorPotrzebWlasnych),
    uziemienie: firstText(details.uziemienie, details.typUziemienia, details.instalacjaUziemiajaca, details.opisUziemienia, details.sposobUziemienia),
    instalacjaOswietleniowa: firstText(details.instalacjaOswietleniowa, details.instalacjaOswietlenia, details.oswietlenie, details.oswietlenieWewnetrzneZewnetrzne, details.oswietlenieOpis),
    inneUrzadzenia: relatedSummary(order, 'DODATKOWE') || firstText(descriptions.documentSummary, details.inneUrzadzenia),
    dostawaWarszawa: normalizeDocumentRows(details.dostawaWarszawa, 'warszawa'),
    dostawaPyskowice: normalizeDocumentRows(details.dostawaPyskowice, 'pyskowice'),
    montazWykonawca: firstText(details.montazWykonawca),
    montazTermin: firstText(details.montazTermin),
    montazOdpowiedzialny: firstText(details.montazOdpowiedzialny),
    montazUwagi: firstText(details.montazUwagi),
    uwagi: firstText(details.uwagiDoZleceniaObudowy, details.uwagi, 'Proszę o umieszczenie zdjęć stacji po wykonaniu na serwerze.'),
    dodatkoweWyposazenie: additionalEquipment,
    customFields: legacyCustomFields,
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
  // Enclosure finish is a fixed standard, not a per-order choice. Normalize old
  // saved anti-graffiti values (including booleans) to the explicit Tak/Nie field.
  hydrated.tynk = DEFAULT_ENCLOSURE_FINISH;
  hydrated.tynkStruktura = '';
  hydrated.antygraffiti = normalizeYesNo(savedData.antygraffiti ?? base.antygraffiti);
  if (!savedData.__sourceSnapshotApplied) {
    for (const [key, sourceValue] of Object.entries(base)) {
      const savedValue = (savedData as Record<string, unknown>)[key];
      const empty = savedValue === undefined || savedValue === null || savedValue === '' || (Array.isArray(savedValue) && savedValue.length === 0);
      if (empty && sourceValue !== undefined) (hydrated as Record<string, unknown>)[key] = sourceValue;
    }
  }

  const legacyCustom = savedData.customFields && typeof savedData.customFields === 'object'
    ? savedData.customFields as Record<string, unknown>
    : {};
  const legacyFieldMap: Array<[keyof EnclosureDocumentData, string]> = [
    ['rozdzielnicaSN', 'rozdzielnicaSN'],
    ['rozdzielnicaNN', 'rozdzielnicaNN'],
    ['telemechanika', 'telemechanika'],
    ['transformator', 'transformator'],
    ['transformatorPotrzebWlasnych', 'transformatorPotrzebWlasnych'],
    ['uziemienie', 'uziemienie'],
    ['instalacjaOswietleniowa', 'instalacjaOswietleniowa'],
    ['inneUrzadzenia', 'inneUrzadzenia'],
    ['opisyDodatkowe', 'opisy'],
  ];
  for (const [documentKey, legacyKey] of legacyFieldMap) {
    const savedCurrent = (savedData as Record<string, unknown>)[documentKey];
    if ((savedCurrent === undefined || savedCurrent === null || savedCurrent === '') && legacyCustom[legacyKey] !== undefined) {
      (hydrated as Record<string, unknown>)[documentKey] = legacyCustom[legacyKey];
    }
  }
  const savedRoofMaterial = (savedData as Record<string, unknown>).dachKlasa;
  if ((savedRoofMaterial === undefined || savedRoofMaterial === null || savedRoofMaterial === '') && legacyCustom.dachMaterial) {
    hydrated.dachKlasa = asText(legacyCustom.dachMaterial);
  }
  const legacyRoofItems = Array.isArray(legacyCustom.wyposazenieDachu) ? legacyCustom.wyposazenieDachu.map(asText).filter(Boolean) : [];
  const additionalItems = [...(hydrated.dodatkoweWyposazenie || [])];
  for (const entry of legacyRoofItems) if (entry && !additionalItems.includes(entry)) additionalItems.push(entry);
  const doorMesh = legacyCustom.siatkaDrzwi as { enabled?: unknown; quantity?: unknown } | undefined;
  const roofMesh = legacyCustom.siatkaDach as { enabled?: unknown; quantity?: unknown } | undefined;
  const doorMeshLabel = doorMesh?.enabled ? 'Siatka wygradzająca przy drzwiach — ' + firstText(doorMesh.quantity, '1') + ' szt.' : '';
  const roofMeshLabel = roofMesh?.enabled ? 'Siatka wygradzająca na dachu — ' + firstText(roofMesh.quantity, '1') + ' szt.' : '';
  if (doorMeshLabel && !additionalItems.includes(doorMeshLabel)) additionalItems.push(doorMeshLabel);
  if (roofMeshLabel && !additionalItems.includes(roofMeshLabel)) additionalItems.push(roofMeshLabel);
  hydrated.dodatkoweWyposazenie = additionalItems;

  hydrated.customFields = { ...base.customFields, ...legacyCustom };
  hydrated.drobneElementy = normalizeDocumentRows(savedData.drobneElementy ?? base.drobneElementy, 'element');
  hydrated.slusarka = normalizeDocumentRows(savedData.slusarka ?? base.slusarka, 'door');
  hydrated.przepusty = normalizeDocumentRows(savedData.przepusty ?? base.przepusty, 'przepust');
  hydrated.otwory = normalizeDocumentRows(savedData.otwory ?? base.otwory, 'otwor');
  hydrated.dostawaWarszawa = normalizeDocumentRows(savedData.dostawaWarszawa, 'warszawa');
  hydrated.dostawaPyskowice = normalizeDocumentRows(savedData.dostawaPyskowice, 'pyskowice');
  hydrated.dodatkoweWyposazenie = Array.isArray(hydrated.dodatkoweWyposazenie) ? hydrated.dodatkoweWyposazenie : [];
  return hydrated as EnclosureDocumentData;
};

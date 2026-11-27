export const DOCUMENT_DICTIONARY_CATEGORIES = [
  { key: 'doors', label: 'Drzwi i ślusarka' },
  { key: 'smallElements', label: 'Pozostałe elementy do zamontowania' },
  { key: 'passages', label: 'Przepusty kablowe' },
  { key: 'openings', label: 'Pozostałe otwory' },
  { key: 'deliveriesWarszawa', label: 'Dostawy — Warszawa' },
  { key: 'deliveriesPyskowice', label: 'Dostawy — Pyskowice' },
] as const;

export type DocumentDictionaryKey = typeof DOCUMENT_DICTIONARY_CATEGORIES[number]['key'];
export type DocumentDictionaries = Record<DocumentDictionaryKey, string[]>;

export const DEFAULT_DOCUMENT_DICTIONARIES: DocumentDictionaries = {
  doors: [
    'Drzwi SN i NN', 'Drzwi SN', 'Drzwi NN', 'Drzwi Trafo',
    'Drzwi do komory transformatora', 'Drzwi techniczne', 'Drzwi wentylacyjne',
    'Krata wentylacyjna', 'Drzwi jednoskrzydłowe pełne',
    'Drzwi dwuskrzydłowe z kratą wentylacyjną', 'Drzwi EI 120', 'Drzwi EI 60',
    'Otwór fi 100 z zaślepieniem',
  ],
  smallElements: [
    'Profil stalowy HEA', 'Kieszeń na schemat', 'Otwór do anteny',
    'Chłodnica gazów', 'Krata wentylacyjna',
    'Siatka wygradzająca przy drzwiach', 'Siatka wygradzająca na dachu',
    'Uchwyt / wspornik', 'Element mocujący', 'Inny element',
  ],
  passages: ['BWS 150', 'BWS 100', 'HEA', 'HSI 90', 'HSI 150', 'Przepust kablowy innego typu'],
  openings: ['Otwór Ø100', 'Otwór kablowy', 'Otwór wentylacyjny', 'Otwór drzwiowy', 'Inny'],
  deliveriesWarszawa: [
    'Rozdzielnica SN', 'Rozdzielnica NN', 'Most SN z głowicami', 'Most NN RTS-z',
    'Wkłady HSD / HRD', 'Czujniki', 'Przyrząd do kolejności faz',
  ],
  deliveriesPyskowice: [
    'Zaciski krzyżowe', 'Rozdzielnica SN Siemens', 'Mosty NN', 'Podkładki antywibracyjne',
  ],
};

export const PASSAGE_SIDES = ['Przód', 'Tył', 'Lewo', 'Prawo'] as const;

export const DOOR_DIMENSIONS = [
  { value: '950x2100', label: '950 × 2100 mm', width: '950', height: '2100' },
  { value: '1170x2100', label: '1170 × 2100 mm', width: '1170', height: '2100' },
] as const;

export const mergeDocumentDictionaries = (incoming: unknown): DocumentDictionaries => {
  const source = incoming && typeof incoming === 'object' && !Array.isArray(incoming)
    ? incoming as Record<string, unknown>
    : {};
  const merged = {} as DocumentDictionaries;

  for (const { key } of DOCUMENT_DICTIONARY_CATEGORIES) {
    // The server returns the complete resolved list, including user additions
    // and excluding intentionally removed built-ins. Do not re-add defaults here.
    const incomingValues = Array.isArray(source[key]) ? source[key] as unknown[] : DEFAULT_DOCUMENT_DICTIONARIES[key];
    const seen = new Set<string>();
    merged[key] = incomingValues
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => {
        const normalized = value.toLocaleLowerCase('pl-PL');
        if (!normalized || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
  }
  return merged;
};

export const fetchDocumentDictionaries = async (): Promise<DocumentDictionaries> => {
  try {
    const response = await fetch('/api/document-form-dictionaries', { credentials: 'same-origin' });
    if (!response.ok) return DEFAULT_DOCUMENT_DICTIONARIES;
    const result = await response.json();
    return result?.success ? mergeDocumentDictionaries(result.dictionaries) : DEFAULT_DOCUMENT_DICTIONARIES;
  } catch {
    return DEFAULT_DOCUMENT_DICTIONARIES;
  }
};

export const appendDocumentDictionaryValue = async (
  dictionaryKey: DocumentDictionaryKey,
  value: string,
): Promise<DocumentDictionaries> => {
  const response = await fetch('/api/document-form-dictionaries/' + encodeURIComponent(dictionaryKey), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.error || 'Nie udało się zapisać pozycji w słowniku.');
  }
  return mergeDocumentDictionaries(result.dictionaries);
};

export const removeDocumentDictionaryValue = async (
  dictionaryKey: DocumentDictionaryKey,
  value: string,
): Promise<DocumentDictionaries> => {
  const response = await fetch('/api/document-form-dictionaries/' + encodeURIComponent(dictionaryKey), {
    method: 'DELETE',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new Error(result?.error || 'Nie udało się usunąć pozycji ze słownika.');
  }
  return mergeDocumentDictionaries(result.dictionaries);
};

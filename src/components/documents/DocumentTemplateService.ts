import type { Order } from '../../types/enco';
import { getSmallElementRows, type EnclosureDocumentData, type DocumentRow } from './documentModel';

const asText = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie';
  if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(', ');
  if (typeof value === 'object') return '';
  return String(value).trim();
};

export const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const cell = (value: unknown) => {
  const text = asText(value);
  return text ? escapeHtml(text).replace(/\r\n?|\n/g, '<br>') : '';
};
const datePL = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? value.split('-').reverse().join('.') : value;
const rowsHtml = (rows: DocumentRow[], columns: string[]) => {
  const visible = rows.filter((row) => row.type.trim());
  if (!visible.length) return '<tr><td colspan="' + columns.length + '">Nie wskazano pozycji.</td></tr>';
  return visible.map((row) => '<tr>' + columns.map((key) => {
    const value = key === 'type' ? row.type
      : key === 'quantity' ? row.quantity
      : key === 'unit' ? row.unit || 'szt.'
      : key === 'quantityWithUnit' ? [row.quantity || '1', row.unit || 'szt.'].join(' ')
      : key === 'category' ? row.category
      : key === 'mountingLocation' ? row.position
      : key === 'mountingDetails' ? [row.position, row.notes].filter(Boolean).join(' · ')
      : key === 'notes' ? row.notes
      : key === 'position'
        ? [row.position, row.wings, row.openingSide ? 'otwierane ' + row.openingSide : '', row.width && row.height ? row.width + ' × ' + row.height + ' mm' : '', row.ventilationGrille ? 'krata wentylacyjna' : '', row.intakeFan ? 'wentylator nawiewny' : '', row.exhaustFan ? 'wentylator wyciągowy' : '', row.cableType ? 'kabel ' + row.cableType : '', row.diameter ? 'Ø ' + row.diameter : '', row.sealType, row.sealVariant, row.notes].filter(Boolean).join(' · ')
        : row[key];
    return '<td>' + cell(value) + '</td>';
  }).join('') + '</tr>').join('');
};
const table = (headers: string[], body: string, className = '') =>
  '<table' + (className ? ' class="' + escapeHtml(className) + '"' : '') + '><thead><tr>' +
  headers.map((header) => '<th>' + escapeHtml(header) + '</th>').join('') +
  '</tr></thead><tbody>' + body + '</tbody></table>';
const paragraph = (label: string, value: unknown) => asText(value)
  ? '<p><strong>' + escapeHtml(label) + ':</strong> ' + cell(value) + '</p>' : '';
const deliveryCell = (row: DocumentRow | undefined): string => {
  if (!row || !asText(row.type)) return '';
  const quantity = asText(row.quantity);
  const unit = asText(row.unit || 'szt.');
  const amount = quantity && (quantity !== '1' || unit !== 'szt.') ? ' – ' + quantity + ' ' + unit : '';
  const details = [row.position, row.notes].map(asText).filter(Boolean).join(' – ');
  return cell(asText(row.type) + amount + (details ? ' – ' + details : ''));
};

const deliveryListsTable = (data: EnclosureDocumentData): string => {
  const warsaw = data.dostawaWarszawa.filter((row) => asText(row.type));
  const pyskowice = data.dostawaPyskowice.filter((row) => asText(row.type));
  const rowCount = Math.max(warsaw.length, pyskowice.length, 1);
  const body = Array.from({ length: rowCount }, (_, index) =>
    '<tr><td>' + deliveryCell(warsaw[index]) + '</td><td>' + deliveryCell(pyskowice[index]) + '</td></tr>'
  ).join('');
  return '<table class="document-delivery-table"><thead><tr><th>Dostarcza Warszawa</th><th>Dostarczają Pyskowice</th></tr></thead><tbody>' +
    body + '</tbody></table>';
};

const colourTable = (data: EnclosureDocumentData): string => {
  const roofMetalworkColour = [data.kolorDachu, data.kolorSlusarki, data.kolorDrzwiKraty]
    .map(asText).find(Boolean) || '';
  const rows: Array<[string, string]> = [
    ['Kolor elewacji', data.kolorObudowy],
    ['Kolor dachu i ślusarki', roofMetalworkColour],
  ].filter((entry): entry is [string, string] => Boolean(asText(entry[1])));
  if (!rows.length) return '';
  return table(
    ['Element', 'Kolor (RAL)'],
    rows.map(([label, value]) => '<tr><td>' + escapeHtml(label) + '</td><td>' + cell(value) + '</td></tr>').join(''),
  );
};

export const DEFAULT_ENCLOSURE_TEMPLATE_HTML = [
  '<div class="document-sheet document-layout-v4">',
  '<h1 class="document-document-heading">WYKONANIE STACJI TRANSFORMATOROWEJ {{derived.title}}</h1>',
  '<div class="document-center-meta"><p><strong>{{derived.zdHeader}}</strong></p><p><strong>{{derived.orderNumberHeader}}</strong></p></div>',
  '<p class="document-dot"><strong>DOT. WYKONANIA STACJI TRANSFORMATOROWEJ {{derived.stationVariant}} {{form.dotExtra}}</strong></p>',
  '<p class="document-inline-field"><strong>TERMIN REALIZACJI:</strong> {{form.terminRealizacji}}</p>',
  '<p class="document-section-label"><strong>ZAKRES PRAC:</strong></p>',
  '<p class="document-subheading"><strong>TYP OBUDOWY</strong></p>',
  '<p>1. {{form.opisObudowy}}</p>',
  '{{derived.enclosureScope}}',
  '{{derived.colours}}',
  '{{derived.passages}}',
  '<p class="document-subheading"><strong>W stacji będą zamontowane następujące urządzenia:</strong></p>',
  '{{derived.mainEquipment}}',
  '{{derived.deliveryLists}}',
  '{{derived.descriptionNote}}',
  '<p><strong>UWAGA:</strong> {{form.uwagi}}</p>',
  '{{derived.mountingSection}}',
  '<p class="document-closing-location">{{form.montazOdpowiedzialny}}</p>',
  '</div>',
].join('\n');

export const buildEnclosureDocumentHtml = (data: EnclosureDocumentData, order: Order): string =>
  renderVersionedEnclosureTemplate({
    key: 'zlecenie-obudowy',
    title: 'Domyślny wzór zlecenia obudowy',
    version: CURRENT_ENCLOSURE_DOCUMENT_LAYOUT_VERSION,
    contentHtml: DEFAULT_ENCLOSURE_TEMPLATE_HTML,
    fields: [],
  }, data, order);

export interface VersionedDocumentTemplate {
  key: string;
  title: string;
  version: number;
  contentHtml: string;
  updatedAt?: string;
  updatedBy?: string;
  sections?: unknown[];
  fields?: Array<{ id?: string; type?: string; valueKey?: string; defaultValue?: unknown; helpText?: string; label?: string }>;
  rules?: unknown[];
}

export const CURRENT_ENCLOSURE_DOCUMENT_LAYOUT_VERSION = 4;

/**
 * Only templates carrying the current layout marker can drive the live document.
 * Old server-side templates remain available in history/editor, but are not
 * allowed to silently hide fields or keep the previous page layout.
 */
export const isCurrentEnclosureDocumentTemplate = (
  template: VersionedDocumentTemplate | null | undefined,
): template is VersionedDocumentTemplate =>
  Boolean(template?.contentHtml?.includes('document-layout-v4'));


export const fetchEnclosureDocumentTemplate = async (): Promise<VersionedDocumentTemplate | null> => {
  try {
    const response = await fetch('/api/document-form-templates/zlecenie-obudowy', { credentials: 'same-origin' });
    if (!response.ok) return null;
    const result = await response.json();
    const template = result?.success && result?.template && typeof result.template === 'object'
      ? result.template as VersionedDocumentTemplate
      : null;
    if (!template || typeof template.contentHtml !== 'string' || !template.contentHtml.trim()) return null;
    return { ...template, contentHtml: sanitizeDocumentHtml(template.contentHtml) };
  } catch {
    return null;
  }
};

const rowDescription = (row: DocumentRow): string => [
  row.type,
  row.quantity ? 'ilość: ' + row.quantity : '',
  row.position,
  row.wings,
  row.openingSide ? 'otwierane ' + row.openingSide : '',
  row.width && row.height ? row.width + ' × ' + row.height + ' mm' : '',
  row.ventilationGrille ? 'krata wentylacyjna' : '',
  row.intakeFan ? 'wentylator nawiewny' : '',
  row.exhaustFan ? 'wentylator wyciągowy' : '',
  row.cableType ? 'kabel ' + row.cableType : '',
  row.diameter ? 'Ø ' + row.diameter : '',
  row.sealType,
  row.sealVariant,
  row.notes,
].filter(Boolean).join(' — ');

const getNestedValue = (root: unknown, path: string[]): unknown => {
  let value = root as any;
  for (const key of path) {
    if (value === undefined || value === null) return undefined;
    value = value[key];
  }
  return value;
};

const getTemplatePathValue = (path: string, data: EnclosureDocumentData, order: Order): unknown => {
  if (path === 'system.today') {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  }

  if (path.startsWith('order.itemByType.')) {
    const [, , type, ...tail] = path.split('.');
    const related = order.items.find((entry) => entry.type === type);
    if (tail.length === 1 && tail[0] === 'documentSummary') {
      const summary: Record<string, string> = {
        OBUDOWA: data.opisObudowy,
        DRZWI: data.slusarka.map(rowDescription).join('; '),
        ROZDZIELNICA_SN: data.rozdzielnicaSN,
        ROZDZIELNICA_NN: data.rozdzielnicaNN,
        SZAFKA_TELEMECHANIKI: data.telemechanika,
        TRANSFORMATOR: data.transformator,
        TRANSFORMATOR_POTRZEB_WLASNYCH: data.transformatorPotrzebWlasnych,
        DODATKOWE: data.inneUrzadzenia,
        OPISY: data.opisyDodatkowe,
      };
      return summary[type] ?? '';
    }
    if (tail.length === 1 && tail[0].startsWith('document')) {
      const documentFields: Record<string, unknown> = {
        documentFinish: data.tynk,
        documentAntigraffiti: data.antygraffiti,
        documentGrounding: data.uziemienie,
        documentLighting: data.instalacjaOswietleniowa,
        documentRows: data.slusarka,
        documentColorShell: data.kolorObudowy,
        documentColorMetalwork: data.kolorSlusarki,
        documentColorRoof: data.kolorDachu,
        documentColorDoorsAndGrilles: data.kolorDrzwiKraty,
      };
      return documentFields[tail[0]] ?? '';
    }
    return getNestedValue(related, tail);
  }

  // These aliases represent one logical list. Resolve the merged rows here as well as
  // during rendering, so the empty-block pass cannot remove legacy-only entries.
  if (path === 'form.drobneElementy' || path === 'form.dodatkoweWyposazenie') {
    return getSmallElementRows(data);
  }
  if (path.startsWith('form.')) return getNestedValue(data, path.slice(5).split('.'));
  if (path.startsWith('order.')) return getNestedValue(order, path.slice(6).split('.'));
  if (path.startsWith('item.')) {
    const enclosure = order.items.find((entry) => entry.type === 'OBUDOWA');
    return getNestedValue(enclosure, path.slice(5).split('.'));
  }
  return undefined;
};

const getResolvedTemplatePathValue = (
  path: string,
  data: EnclosureDocumentData,
  order: Order,
  template: VersionedDocumentTemplate,
): unknown => {
  const derived = renderDerivedTemplateToken(path, data, order);
  if (derived !== null) return derived;

  const staticField = path.startsWith('form.')
    ? template.fields?.find((field) => field.type === 'static' && path === 'form.' + field.valueKey)
    : undefined;
  if (staticField) return asText(staticField.defaultValue ?? staticField.helpText ?? staticField.label);

  let value = getTemplatePathValue(path, data, order);
  if ((path === 'form.dataWystawienia' || path === 'form.dataZD' || path === 'form.terminRealizacji') &&
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    value = value.slice(8, 10) + '.' + value.slice(5, 7) + '.' + value.slice(0, 4);
  }
  return value;
};

const hasTemplateContent = (value: unknown): boolean => {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) {
    return value.some((entry) => {
      if (entry && typeof entry === 'object') {
        const row = entry as Partial<DocumentRow>;
        return typeof row.type === 'string'
          ? Boolean(row.type.trim())
          : Object.values(entry as Record<string, unknown>).some(hasTemplateContent);
      }
      return hasTemplateContent(entry);
    });
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(hasTemplateContent);
  }
  return asText(value).length > 0;
};

const omitEmptyTemplateBlocks = (html: string, isEmptyPath: (path: string) => boolean): string => {
  let result = html;
  // Remove the complete labelled paragraph or table row only if every bound
  // field in that block is empty. Array-backed document tables count as content.
  for (const tag of ['tr', 'p', 'li', 'h1', 'h2', 'h3', 'h4']) {
    const blockPattern = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '\\s*>', 'gi');
    result = result.replace(blockPattern, (block, inner: string) => {
      const paths = Array.from(inner.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g), (match) => match[1]);
      return paths.length > 0 && paths.every(isEmptyPath) ? '' : block;
    });
  }
  return result;
};

const EMPTY_TEMPLATE_VALUE = '\uE000__ENCO_EMPTY_DOCUMENT_FIELD__\uE001';

const formatScopeRow = (row: DocumentRow): string => {
  const quantity = asText(row.quantity || '1');
  const details = [
    row.position,
    row.width && row.height ? row.width + ' × ' + row.height + ' mm' : '',
    row.wings,
    row.openingSide ? 'otwierane ' + row.openingSide : '',
    row.ventilationGrille ? 'krata wentylacyjna' : '',
    row.intakeFan ? 'wentylator nawiewny' : '',
    row.exhaustFan ? 'wentylator wyciągowy' : '',
    row.notes,
  ].map(asText).filter(Boolean).join(' – ');
  const type = /^hea\b/i.test(asText(row.type)) ? 'przepust HEA' : asText(row.type);
  return quantity + ' x ' + type + (details ? ' – ' + details : '');
};

const formatPassageRow = (row: DocumentRow): string => {
  const quantity = asText(row.quantity || '1');
  const rawType = asText(row.type);
  const cable = asText(row.cableType);
  const name = /przepust/i.test(rawType)
    ? rawType
    : 'przepust kablowy ' + (cable ? cable + ' ' : '') + 'typu ' + rawType;
  const seals = [row.sealType, row.sealVariant].map(asText).filter(Boolean);
  const sealText = seals.length
    ? ' wraz z wkładami uszczelniającymi ' + [...new Set(seals)].join(' ')
    : '';
  const details = [
    row.diameter ? 'fi ' + asText(row.diameter) : '',
    row.position,
    row.notes,
  ].map(asText).filter(Boolean).join(' – ');
  return quantity + ' x ' + name + sealText + (details ? ' – ' + details : '');
};

const listItems = (items: string[], className = ''): string => {
  const visible = items.map((item) => item.trim()).filter(Boolean);
  if (!visible.length) return '';
  return '<ul' + (className ? ' class="' + escapeHtml(className) + '"' : '') + '>' +
    visible.map((item) => '<li>' + cell(item) + '</li>').join('') + '</ul>';
};

const renderDerivedTemplateToken = (path: string, data: EnclosureDocumentData, order: Order): string | null => {
  const titleVariant = data.rozmiar && data.typObudowy && data.rozmiar.toUpperCase().startsWith(data.typObudowy.toUpperCase())
    ? data.rozmiar
    : [data.typObudowy, data.rozmiar].filter(Boolean).join(' ');
  const title = [titleVariant, data.oznaczenieStacji, data.nazwaObiektu].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || order.projectName || order.orderNumber;
  if (path === 'derived.zdHeader') {
    const zdNumber = asText(data.numerZD);
    const zdDate = asText(data.dataZD);
    const numberLabel = zdNumber
      ? (/^zd\s*nr\b/i.test(zdNumber) ? zdNumber : 'ZD NR ' + zdNumber)
      : '';
    const dateLabel = zdDate ? 'z dnia ' + datePL(zdDate) : '';
    return escapeHtml([numberLabel, dateLabel].filter(Boolean).join(' '));
  }
  if (path === 'derived.orderNumberHeader') {
    const orderNumber = asText(data.numerZL);
    return escapeHtml(orderNumber
      ? (/^zl\b/i.test(orderNumber) ? orderNumber : 'ZL ' + orderNumber)
      : '');
  }
  if (path === 'derived.title') return escapeHtml(title);
  if (path === 'derived.stationVariant') return escapeHtml(titleVariant || data.typObudowy || data.rozmiar);
  if (path === 'derived.dot') return escapeHtml([title, data.dotExtra].filter(Boolean).join(' — ') || '—');

  if (path === 'derived.deliveryTable' || path === 'derived.deliveryLists') {
    return deliveryListsTable(data);
  }
  if (path === 'derived.enclosureScope') {
    const scopeRows = [
      ...data.slusarka,
      ...getSmallElementRows(data),
      ...data.otwory,
      ...data.przepusty.filter((row) => /hea/i.test(asText(row.type))),
    ].filter((row) => asText(row.type));
    const scopeLines = scopeRows.map(formatScopeRow);
    const roof = 'Dach ' + [asText(data.dachKlasa) || 'betonowy', asText(data.dachTyp) || 'kopertowy'].join(' ');
    if (!scopeLines.some((line) => line.trim().toLocaleLowerCase('pl-PL').startsWith('dach '))) scopeLines.push(roof);
    return listItems(scopeLines, 'document-scope-list');
  }
  if (path === 'derived.colours') {
    const roofColour = [data.kolorDachu, data.kolorSlusarki, data.kolorDrzwiKraty].map(asText).find(Boolean) || '';
    const colours = [
      asText(data.kolorObudowy) ? 'kolor elewacji: ' + asText(data.kolorObudowy) : '',
      roofColour ? 'kolor dachu i ślusarki: ' + roofColour : '',
    ].filter(Boolean).join('; ');
    const finish = asText(data.tynk) || 'Tynk akrylowy zewnętrzny o strukturze baranka';
    const antiGraffiti = data.antygraffiti === 'Tak' ? ' + powłoka antygraffiti' : '';
    return (colours ? '<p><strong>Kolory:</strong> ' + cell(colours) + '</p>' : '') +
      '<p>+ ' + cell(finish) + antiGraffiti + '</p>';
  }
  if (path === 'derived.passages') {
    const cableRows = data.przepusty.filter((row) => asText(row.type) && !/hea/i.test(asText(row.type)));
    return listItems(cableRows.map(formatPassageRow), 'document-passage-list');
  }
  if (path === 'derived.doors') {
    return listItems(data.slusarka.map(formatScopeRow), 'document-scope-list');
  }
  if (path === 'derived.smallElements') {
    return listItems(getSmallElementRows(data).map(formatScopeRow), 'document-scope-list');
  }
  if (path === 'derived.openings') {
    return listItems(data.otwory.map(formatScopeRow), 'document-scope-list');
  }
  if (path === 'derived.mainEquipment') {
    const entries: Array<[string, unknown]> = [
      ['Rozdzielnica SN typu:', data.rozdzielnicaSN],
      ['Rozdzielnica nN typu:', data.rozdzielnicaNN],
      ['Telemechanika:', data.telemechanika],
      ['Transformator:', data.transformator],
      ['Transformator potrzeb własnych:', data.transformatorPotrzebWlasnych],
      ['Wewnętrzna instalacja uziemiająca –', data.uziemienie],
      ['Wewnętrzna instalacja oświetleniowa –', data.instalacjaOswietleniowa],
      ['Inne urządzenia:', data.inneUrzadzenia],
    ];
    return listItems(entries.filter(([, value]) => asText(value)).map(([label, value]) => label + ' ' + asText(value)), 'document-equipment-list');
  }
  if (path === 'derived.descriptionNote') {
    return '<p><strong>OPIS</strong> – ' + cell(asText(data.opisyDodatkowe) || 'potwierdzimy') + '</p>';
  }
  if (path === 'derived.mountingSection') {
    const executor = asText(data.montazWykonawca) || 'firma zewnętrzna';
    const term = paragraph('Termin realizacji', data.montazTermin);
    const notes = paragraph('Uwagi montażowe', data.montazUwagi);
    return '<p class="document-mounting-heading"><strong>DOTYCZY WYKONANIA MONTAŻU STACJI</strong> – ' + cell(executor) + '</p>' + term + notes;
  }
  return null;
};
export const renderVersionedEnclosureTemplate = (
  template: VersionedDocumentTemplate,
  data: EnclosureDocumentData,
  order: Order,
): string => {
  const safeTemplate = sanitizeDocumentHtml(template.contentHtml);
  const preparedTemplate = omitEmptyTemplateBlocks(
    safeTemplate,
    (path) => !hasTemplateContent(getResolvedTemplatePathValue(path, data, order, template)),
  );
  const rendered = preparedTemplate.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, path: string) => {
    const derived = renderDerivedTemplateToken(path, data, order);
    if (derived !== null) return derived;
    const value = getResolvedTemplatePathValue(path, data, order, template);
    if (Array.isArray(value)) {
      const rows = value.filter((entry) => entry && typeof entry === 'object') as DocumentRow[];
      if (path === 'form.slusarka') {
        return table(['Element', 'Ilość', 'Położenie / opis'], rowsHtml(rows, ['type', 'quantity', 'position']));
      }
      if (path === 'form.przepusty' || path === 'form.otwory') {
        return table(['Typ', 'Ilość', 'Lokalizacja / parametry'], rowsHtml(rows, ['type', 'quantity', 'position']));
      }
      if (path === 'form.dostawaWarszawa' || path === 'form.dostawaPyskowice') {
        const supplier = path.endsWith('Warszawa') ? 'Warszawa' : 'Pyskowice';
        return '<p><strong>Dostawca:</strong> ' + supplier + '</p>' +
          table(['Element', 'Ilość', 'Lokalizacja / uwagi'], rowsHtml(rows, ['type', 'quantity', 'position']));
      }
      if (path === 'form.drobneElementy' || path === 'form.dodatkoweWyposazenie') {
        return table(
          ['Grupa', 'Element do zamontowania', 'Ilość', 'Miejsce montażu / uwagi'],
          rowsHtml(getSmallElementRows(data), ['category', 'type', 'quantityWithUnit', 'mountingDetails']),
        );
      }
      return value.map((entry) => entry && typeof entry === 'object'
        ? escapeHtml(rowDescription(entry as DocumentRow))
        : escapeHtml(asText(entry))).filter(Boolean).join('<br>');
    }
    if (value && typeof value === 'object') return escapeHtml(asText(value));
    const text = asText(value);
    return text ? escapeHtml(text).replace(/\r\n?|\n/g, '<br>') : EMPTY_TEMPLATE_VALUE;
  });
  const cleaned = rendered
    .replace(new RegExp('\\s*(?:·|,|;|—|–|/)\\s*' + EMPTY_TEMPLATE_VALUE, 'g'), '')
    .replace(new RegExp(EMPTY_TEMPLATE_VALUE + '\\s*(?:·|,|;|—|–|/)\\s*', 'g'), '')
    .replaceAll(EMPTY_TEMPLATE_VALUE, '');
  return sanitizeDocumentHtml(cleaned);
};

/**
 * Normalize the fragment emitted by contentEditable before it is stored.
 * Chromium may append empty DIV/P blocks after the last document element when
 * the caret leaves an editable region. Persisting those placeholders makes
 * another blank paragraph appear after every edit/reopen cycle.
 */
export const normalizeDocumentEditorHtml = (html: string): string => {
  let clean = sanitizeDocumentHtml(html);

  if (typeof DOMParser === 'undefined') {
    // The browser path below is authoritative. This fallback also makes the
    // normalizer deterministic in the Node-based domain tests.
    let previous = '';
    while (previous !== clean) {
      previous = clean;
      clean = clean.replace(
        /(?:\s*<(?:p|div)\b[^>]*>\s*(?:(?:<br\s*\/?\s*>|&nbsp;|&#160;|\s)*)<\/(?:p|div)>\s*)+$/gi,
        '',
      );
    }
    return clean;
  }

  const parsed = new DOMParser().parseFromString(clean, 'text/html');
  const isEmptyPlaceholder = (node: Node): boolean => {
    if (node.nodeType === Node.TEXT_NODE) return !(node.textContent || '').trim();
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const element = node as HTMLElement;
    if (!['P', 'DIV', 'BR'].includes(element.tagName)) return false;
    if (element.tagName === 'BR') return true;
    if (element.querySelector('img, table, hr, input, video, audio')) return false;
    return !(element.textContent || '').replace(/\u00a0/g, '').trim();
  };
  const trimTrailingPlaceholders = (parent: Node): void => {
    while (parent.lastChild && isEmptyPlaceholder(parent.lastChild)) {
      parent.removeChild(parent.lastChild);
    }
  };

  const sheets = Array.from(parsed.querySelectorAll('.document-sheet'));
  for (const sheet of sheets) {
    // Remove empty browser-created blocks at the end of the page body.
    trimTrailingPlaceholders(sheet);
    // contentEditable sometimes puts its terminal placeholder next to the
    // document sheet rather than inside it.
    if (sheet.parentNode) {
      let next = sheet.nextSibling;
      while (next && isEmptyPlaceholder(next)) {
        const remove = next;
        next = next.nextSibling;
        sheet.parentNode.removeChild(remove);
      }
    }
  }

  return Array.from(parsed.body.childNodes).map((node) => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || '');
    return (node as Element).outerHTML || '';
  }).join('').slice(0, 500000);
};

export const sanitizeDocumentHtml = (html: string): string => {
  const source = String(html || '').slice(0, 500000);
  if (typeof DOMParser === 'undefined') {
    return source
      .replace(/<\s*(script|style|iframe|object|embed|svg|math|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      .replace(/<\s*(script|style|iframe|object|embed|svg|math|form)\b[^>]*\/?>/gi, '')
      .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+(href|src)\s*=\s*("|')\s*(javascript|data):[\s\S]*?\2/gi, '');
  }

  const parsed = new DOMParser().parseFromString(source, 'text/html');
  const allowedTags = new Set([
    'DIV', 'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'H1', 'H2', 'H3', 'H4',
    'UL', 'OL', 'LI', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR',
    'TH', 'TD', 'SPAN', 'HR',
  ]);
  const dangerousTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'FORM', 'LINK', 'META']);
  const allowedClasses = new Set([
    'document-sheet', 'document-layout-v3', 'document-layout-v4', 'document-brandline', 'document-kicker', 'document-title', 'document-footer', 'document-two-column', 'document-order-meta', 'document-document-heading', 'document-center-meta', 'document-dot', 'document-inline-field', 'document-section-label', 'document-subheading', 'document-scope-list', 'document-passage-list', 'document-equipment-list', 'document-delivery-table', 'document-mounting-heading', 'document-closing-location',
  ]);
  const allowedStyles = new Set([
    'font-family', 'font-size', 'font-weight', 'font-style', 'color', 'background-color',
    'text-align', 'text-decoration', 'line-height', 'margin', 'margin-top', 'margin-bottom',
    'margin-left', 'margin-right', 'padding', 'padding-top', 'padding-bottom', 'padding-left',
    'padding-right', 'border', 'border-top', 'border-bottom', 'border-left', 'border-right',
    'border-collapse', 'border-spacing', 'border-color', 'border-width', 'border-style',
    'width', 'height', 'min-width', 'vertical-align', 'letter-spacing',
  ]);

  const cleanNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const element = node as HTMLElement;
    if (dangerousTags.has(element.tagName)) return '';
    const children = Array.from(element.childNodes).map(cleanNode).join('');
    if (!allowedTags.has(element.tagName)) return children;

    let attributes = '';
    const classNames = (element.getAttribute('class') || '').split(/\s+/).filter((name) => allowedClasses.has(name));
    if (classNames.length) attributes += ' class="' + escapeHtml(classNames.join(' ')) + '"';

    const style = element.getAttribute('style');
    if (style) {
      const safeStyle = style.split(';').map((entry) => entry.trim()).filter(Boolean).filter((entry) => {
        const colon = entry.indexOf(':');
        if (colon < 0) return false;
        const name = entry.slice(0, colon).trim().toLowerCase();
        const value = entry.slice(colon + 1).trim();
        return allowedStyles.has(name) && !/url\s*\(|expression|javascript:|behavior\s*:/i.test(value);
      }).join('; ');
      if (safeStyle) attributes += ' style="' + escapeHtml(safeStyle) + '"';
    }

    if (['TD', 'TH'].includes(element.tagName)) {
      for (const attribute of ['colspan', 'rowspan']) {
        const raw = element.getAttribute(attribute);
        if (raw && /^\d{1,2}$/.test(raw)) attributes += ' ' + attribute + '="' + raw + '"';
      }
    }
    return '<' + element.tagName.toLowerCase() + attributes + '>' + children + '</' + element.tagName.toLowerCase() + '>';
  };

  return Array.from(parsed.body.childNodes).map(cleanNode).join('').slice(0, 500000);
};

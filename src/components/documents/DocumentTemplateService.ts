import type { Order } from '../../types/enco';
import type { EnclosureDocumentData, DocumentRow } from './documentModel';

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
  return text ? escapeHtml(text).replace(/\r\n?|\n/g, '<br>') : '—';
};
const datePL = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  ? value.split('-').reverse().join('.') : value;
const rowsHtml = (rows: DocumentRow[], columns: string[]) => {
  const visible = rows.filter((row) => row.type.trim());
  if (!visible.length) return '<tr><td colspan="' + columns.length + '">Nie wskazano pozycji.</td></tr>';
  return visible.map((row) => '<tr>' + columns.map((key) => {
    const value = key === 'type' ? row.type : key === 'quantity' ? row.quantity : key === 'position'
      ? [row.position, row.wings, row.openingSide ? 'otwierane ' + row.openingSide : '', row.width && row.height ? row.width + ' × ' + row.height + ' mm' : '', row.ventilationGrille ? 'krata wentylacyjna' : '', row.intakeFan ? 'wentylator nawiewny' : '', row.exhaustFan ? 'wentylator wyciągowy' : '', row.cableType ? 'kabel ' + row.cableType : '', row.diameter ? 'Ø ' + row.diameter : '', row.sealType, row.sealVariant, row.notes].filter(Boolean).join(' · ')
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
      ${paragraph('Dodatkowe opisy / wymagania wykonawcze', data.opisyDodatkowe)}
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
    'document-sheet', 'document-brandline', 'document-kicker', 'document-title', 'document-footer',
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

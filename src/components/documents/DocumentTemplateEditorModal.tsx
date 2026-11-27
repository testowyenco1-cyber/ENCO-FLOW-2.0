import React, { useState } from 'react';
import { X, Save, ShieldCheck } from 'lucide-react';
import { DocumentPreviewEditor } from './DocumentPreviewEditor';
import { sanitizeDocumentHtml, type VersionedDocumentTemplate } from './DocumentTemplateService';

type Props = {
  template: VersionedDocumentTemplate | null;
  onClose: () => void;
  onPublished: (template: VersionedDocumentTemplate) => void;
};

const DEFAULT_TEMPLATE_HTML = "<div class=\"document-sheet document-layout-v2\">\n<div class=\"document-brandline\"><span>ENCO</span><span>SP. Z O.O. · DOKUMENTACJA PRODUKCYJNA</span></div>\n<p class=\"document-kicker\">Zlecenie produkcyjne</p>\n<h1>ZLECENIE OBUDOWY</h1>\n<h2 class=\"document-title\">{{derived.title}}</h2>\n<p><strong>DOT.:</strong> {{derived.dot}}</p>\n<table><thead><tr><th>Nr ZL</th><th>Nr ZD</th><th>Data ZD</th><th>Data wystawienia</th><th>Termin realizacji</th></tr></thead><tbody><tr><td>{{form.numerZL}}</td><td>{{form.numerZD}}</td><td>{{form.dataZD}}</td><td>{{form.dataWystawienia}}</td><td>{{form.terminRealizacji}}</td></tr></tbody></table>\n<h2>1. Typ obudowy i zakres wykonania</h2>\n<p><strong>Typ budowli:</strong> {{form.typBudowli}}</p><p><strong>Opis zakresu:</strong> {{form.opisObudowy}}</p>\n<table><thead><tr><th>Długość / głębokość</th><th>Szerokość</th><th>Wysokość</th><th>Konstrukcja</th></tr></thead><tbody><tr><td>{{form.dlugosc}}</td><td>{{form.szerokosc}}</td><td>{{form.wysokosc}}</td><td>{{form.konstrukcja}}</td></tr></tbody></table>\n<p><strong>Ściany:</strong> {{form.scianyIlosc}} · {{form.scianyKlasa}}</p><p><strong>Dach:</strong> {{form.dachTyp}} · {{form.dachKlasa}}</p>\n<h2>2. Drzwi, ślusarka i mniejsze elementy</h2><h3>Drzwi i ślusarka</h3>{{derived.doors}}\n<h3>Pozostałe elementy do zamontowania</h3>{{derived.smallElements}}\n<h2>3. Kolory i wykończenie elewacji</h2>{{derived.colours}}\n<h2>4. Przepusty kablowe i otwory</h2><h3>Przepusty kablowe</h3>{{derived.passages}}<h3>Pozostałe otwory</h3>{{derived.openings}}\n<h2>5. Główne urządzenia i instalacje</h2>{{derived.mainEquipment}}\n<h2>6. Zestawienie dostaw</h2>{{derived.deliveryLists}}\n<h2>7. Wykonanie montażu stacji</h2>{{derived.mountingSection}}\n<h2>Uwagi końcowe</h2><p>{{form.uwagi}}</p>\n<div class=\"document-footer\"><span>ENCO Sp. z o.o.</span><span>{{form.numerZL}}</span></div>\n</div>";

export const DocumentTemplateEditorModal: React.FC<Props> = ({ template, onClose, onPublished }) => {
  const [title, setTitle] = useState(template?.title || 'Wzorzec zlecenia obudowy');
  const [html, setHtml] = useState(() => sanitizeDocumentHtml(
    template?.contentHtml?.includes('document-layout-v2') ? template.contentHtml : DEFAULT_TEMPLATE_HTML,
  ));
  const [resetToken] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const publish = async () => {
    if (saving || !title.trim() || !html.trim()) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/document-form-templates/zlecenie-obudowy', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: {
            key: 'zlecenie-obudowy',
            title: title.trim(),
            contentHtml: sanitizeDocumentHtml(html),
            sections: template?.sections || [],
            fields: template?.fields || [],
            rules: template?.rules || [],
          },
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !result?.template) {
        throw new Error(result?.error || 'Nie udało się opublikować wzorca.');
      }
      onPublished(result.template as VersionedDocumentTemplate);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się opublikować wzorca.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-slate-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
        <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><ShieldCheck size={18}/></span><div><h2 className="text-sm font-bold text-slate-900">Edytor wspólnego wzorca</h2><p className="text-xs text-slate-500">Publikacja dotyczy nowych dokumentów. Zapisane dokumenty zachowują własną treść i wersję wzorca.</p></div></div>
        <div className="flex items-center gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"><X size={14} className="mr-1 inline"/> Zamknij</button><button type="button" disabled={saving || !title.trim() || !html.trim()} onClick={() => void publish()} className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Save size={14} className="mr-1 inline"/> {saving ? 'Publikowanie…' : 'Opublikuj nową wersję'}</button></div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <label className="block max-w-xl"><span className="mb-1 block text-xs font-semibold text-slate-600">Nazwa wzorca</span><input value={title} maxLength={160} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"/></label>
          <p className="mt-2 text-[11px] text-slate-500">Edytuj tekst, nagłówki i tabele bezpośrednio na stronie. Pola automatyczne pozostaw w podwójnych nawiasach, np. <code>{'{{form.numerZL}}'}</code> i <code>{'{{derived.title}}'}</code>. Dostępne zestawienia: <code>{'{{derived.smallElements}}'}</code>, <code>{'{{derived.colours}}'}</code>, <code>{'{{derived.passages}}'}</code>, <code>{'{{derived.mainEquipment}}'}</code>, <code>{'{{derived.deliveryLists}}'}</code>, <code>{'{{derived.mountingSection}}'}</code>. Dane formularza: <code>{'{{form.nazwaPola}}'}</code>; dane zlecenia: <code>{'{{order.nazwaPola}}'}</code>.</p>
          {template?.version ? <p className="mt-1 text-[11px] font-semibold text-blue-700">Aktualnie opublikowana wersja: v{template.version}{template.updatedAt ? ' · ' + new Date(template.updatedAt).toLocaleString('pl-PL') : ''}</p> : <p className="mt-1 text-[11px] text-amber-700">To pierwszy wzorzec — publikacja utworzy wersję 1.</p>}
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto bg-slate-200/60 p-3 md:p-5">
          <DocumentPreviewEditor html={html} resetToken={resetToken} editable onChange={setHtml}/>
        </main>
        {error && <p role="alert" className="shrink-0 border-t border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      </div>
    </div>
  );
};

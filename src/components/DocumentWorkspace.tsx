import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, CheckCircle2, Eye, FileText, Printer, RefreshCw } from 'lucide-react';
import type { Order } from '../types/enco';
import type { UserRoleProfile } from '../types/userRole';
import { canEditItemType } from '../types/userRole';
import { EnclosureDocumentForm } from './documents/EnclosureDocumentForm';
import { DocumentPreviewEditor } from './documents/DocumentPreviewEditor';
import { createEnclosureDocumentData, type EnclosureDocumentData } from './documents/documentModel';
import { buildEnclosureDocumentHtml, fetchEnclosureDocumentTemplate, renderVersionedEnclosureTemplate, sanitizeDocumentHtml, type VersionedDocumentTemplate } from './documents/DocumentTemplateService';
import { updateOrderWithEnclosureDocument } from './documents/DocumentPersistence';
import { DocumentTemplateEditorModal } from './documents/DocumentTemplateEditorModal';
import { DocumentDictionariesManager } from './documents/DocumentDictionariesManager';
import { DEFAULT_DOCUMENT_DICTIONARIES, fetchDocumentDictionaries, type DocumentDictionaries } from './documents/documentDictionaries';

interface Props {
  order: Order;
  onClose: () => void;
  onSaveOrderChanges: (order: Order) => Promise<boolean> | boolean | void;
  currentProfile: UserRoleProfile;
  canDownload: boolean;
}

export const DocumentWorkspace: React.FC<Props> = ({
  order, onClose, onSaveOrderChanges, currentProfile, canDownload,
}) => {
  const [data, setData] = useState<EnclosureDocumentData>(() => createEnclosureDocumentData(order));
  const [previewHtml, setPreviewHtml] = useState(() => {
    const initial = createEnclosureDocumentData(order);
    return sanitizeDocumentHtml(initial.documentContentHtml ?? buildEnclosureDocumentHtml(initial, order));
  });
  const [previewResetToken, setPreviewResetToken] = useState(0);
  const dataRef = useRef(data);
  dataRef.current = data;
  const sharedTemplateRef = useRef<VersionedDocumentTemplate | null>(null);
  const previewTemplateRef = useRef<VersionedDocumentTemplate | null>(
    data.__templateSnapshot && typeof data.__templateSnapshot === 'object'
      ? data.__templateSnapshot as VersionedDocumentTemplate
      : null
  );
  const previewChangedRef = useRef(false);
  const [sharedTemplate, setSharedTemplate] = useState<VersionedDocumentTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [formChanged, setFormChanged] = useState(false);
  const [previewChanged, setPreviewChanged] = useState(() => {
    const initial = createEnclosureDocumentData(order);
    return initial.documentContentManual ?? Boolean(initial.documentContentHtml);
  });
  previewChangedRef.current = previewChanged;
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [dictionariesManagerOpen, setDictionariesManagerOpen] = useState(false);
  const [dictionaries, setDictionaries] = useState<DocumentDictionaries>(DEFAULT_DOCUMENT_DICTIONARIES);
  const canEdit = canEditItemType(currentProfile, 'OBUDOWA');
  const hasEnclosure = order.items.some((item) => item.type === 'OBUDOWA');

  useEffect(() => {
    let active = true;
    void fetchDocumentDictionaries().then((loaded) => { if (active) setDictionaries(loaded); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const next = createEnclosureDocumentData(order);
    dataRef.current = next;
    setData(next);
    setPreviewHtml(sanitizeDocumentHtml(next.documentContentHtml ?? buildEnclosureDocumentHtml(next, order)));
    previewTemplateRef.current = next.__templateSnapshot && typeof next.__templateSnapshot === 'object'
      ? next.__templateSnapshot as VersionedDocumentTemplate
      : null;
    setPreviewResetToken((value) => value + 1);
    setFormChanged(false);
    const hasManualPreview = next.documentContentManual ?? Boolean(next.documentContentHtml);
    previewChangedRef.current = hasManualPreview;
    setPreviewChanged(hasManualPreview);
    sharedTemplateRef.current = null;
    setSharedTemplate(null);
    setTemplateLoading(true);
    setMessage('');
  }, [order.id]);

  useEffect(() => {
    let active = true;
    const initial = createEnclosureDocumentData(order);
    const storedTemplate = initial.__templateSnapshot && typeof initial.__templateSnapshot === 'object'
      ? initial.__templateSnapshot as VersionedDocumentTemplate
      : null;

    const applyTemplate = (template: VersionedDocumentTemplate | null, allowRender: boolean) => {
      if (!active) return;
      sharedTemplateRef.current = template;
      setSharedTemplate(template);
      setTemplateLoading(false);
      // A stored template snapshot belongs to this document. Only a document
      // without its own snapshot may adopt the newest shared server version.
      if (template && allowRender && initial.documentContentHtml === undefined && !previewChangedRef.current) {
        const nextHtml = renderVersionedEnclosureTemplate(template, dataRef.current, order);
        previewTemplateRef.current = template;
        setPreviewHtml(sanitizeDocumentHtml(nextHtml));
        setPreviewResetToken((value) => value + 1);
      }
    };

    if (initial.documentContentHtml !== undefined) {
      // The saved HTML is authoritative. Track the template snapshot that
      // belongs to this body, while loading the current shared template only
      // for the administrator's template editor.
      previewTemplateRef.current = storedTemplate;
      void fetchEnclosureDocumentTemplate().then((activeTemplate) => {
        applyTemplate(activeTemplate ?? (storedTemplate?.contentHtml ? storedTemplate : null), false);
      });
    } else if (storedTemplate?.contentHtml && typeof storedTemplate.version === 'number') {
      applyTemplate(storedTemplate, true);
    } else {
      void fetchEnclosureDocumentTemplate().then((template) => applyTemplate(template, true));
    }
    return () => { active = false; };
  }, [order.id]);

  const statusText = useMemo(() => {
    if (!canEdit) return 'Tryb podglądu — profil nie ma uprawnień do edycji obudowy.';
    if (saving) return 'Zapisywanie lokalnych zmian…';
    return 'Zmiany zostaną najpierw zatwierdzone lokalnie. Zapis na serwer wykonuje przycisk w lewym panelu.';
  }, [canEdit, saving]);

  const changeForm = (next: EnclosureDocumentData) => {
    dataRef.current = next;
    setData(next);
    setFormChanged(true);
    // Keep the generated document live until the user starts editing the page itself.
    // After that point, form edits never overwrite the user's manual wording.
    if (!previewChangedRef.current) {
      const activeTemplate = sharedTemplateRef.current;
      const html = activeTemplate
        ? renderVersionedEnclosureTemplate(activeTemplate, next, order)
        : buildEnclosureDocumentHtml(next, order);
      previewTemplateRef.current = activeTemplate;
      setPreviewHtml(sanitizeDocumentHtml(html));
      setPreviewResetToken((value) => value + 1);
    }
  };

  const regeneratePreview = () => {
    const activeTemplate = sharedTemplateRef.current;
    const html = activeTemplate
      ? renderVersionedEnclosureTemplate(activeTemplate, data, order)
      : buildEnclosureDocumentHtml(data, order);
    previewTemplateRef.current = activeTemplate;
    // Explicit regeneration is the only action that replaces an existing
    // saved/manual body with the currently selected template.
    const regeneratedData: EnclosureDocumentData = {
      ...data,
      documentContentHtml: undefined,
      documentContentManual: false,
      __templateVersion: activeTemplate?.version ?? data.__templateVersion,
      __templateSnapshot: activeTemplate ?? data.__templateSnapshot,
    };
    dataRef.current = regeneratedData;
    setData(regeneratedData);
    setPreviewHtml(sanitizeDocumentHtml(html));
    setPreviewResetToken((value) => value + 1);
    setFormChanged(false);
    previewChangedRef.current = false;
    setPreviewChanged(false);
    setMessage('Podgląd został ponownie wygenerowany z aktualnych danych formularza. Ręczne zmiany w poprzedniej wersji treści zostały zastąpione.');
  };

  const save = async () => {
    if (!canEdit || !hasEnclosure || saving) return;
    setSaving(true);
    setMessage('');
    try {
      const nextData = {
        ...data,
        documentContentHtml: sanitizeDocumentHtml(previewHtml),
        documentContentUpdatedAt: new Date().toISOString(),
        documentContentManual: previewChanged,
        // Save the exact template version used to generate the current preview,
        // not merely whichever version is currently published on the server.
        __templateVersion: previewTemplateRef.current?.version ?? data.__templateVersion,
        __templateSnapshot: previewTemplateRef.current ?? data.__templateSnapshot,
        __sourceSnapshotApplied: true,
      };
      const updatedOrder = updateOrderWithEnclosureDocument(order, nextData);
      const result = await onSaveOrderChanges(updatedOrder);
      if (result === false) {
        setMessage('Nie udało się zatwierdzić dokumentu. Dane pozostały w bieżącym widoku.');
        return;
      }
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nie udało się zatwierdzić dokumentu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50" aria-label="Wróć do centrum dokumentów"><ArrowLeft size={17}/></button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><FileText size={18}/></div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-slate-900">Zlecenie obudowy</h1>
            <p className="truncate text-xs text-slate-500">{order.orderNumber} · {order.projectName || 'Bez nazwy obiektu'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden max-w-[340px] text-right text-[11px] text-slate-500 xl:block">{statusText}</span>
          {canEdit && <button type="button" onClick={() => setDictionariesManagerOpen(true)} title="Dodawaj pozycje do wspólnych list wyboru" className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"><BookOpen size={14}/> Słowniki</button>}
          {currentProfile.id === 'admin' && <button type="button" disabled={templateLoading} onClick={() => setTemplateEditorOpen(true)} title={templateLoading ? 'Trwa wczytywanie wzorca' : 'Edytuj wspólny wzorzec dla nowych dokumentów'} className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:cursor-wait disabled:opacity-50"><FileText size={14}/> {templateLoading ? 'Wczytywanie wzorca…' : 'Edytuj wzorzec'}</button>}
          <button type="button" disabled={!canDownload} onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"><Printer size={14}/> Drukuj / PDF</button>
          {canEdit && <button type="button" onClick={regeneratePreview} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"><RefreshCw size={14}/> Odśwież podgląd</button>}
          {canEdit && <button type="button" disabled={saving || !hasEnclosure} onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={15}/> Zatwierdź dokument</button>}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(220px,42%)_minmax(0,1fr)] overflow-hidden xl:grid-cols-[minmax(500px,42%)_minmax(0,1fr)] xl:grid-rows-1">
        <aside className="min-h-0 overflow-y-auto border-b border-slate-200 bg-slate-50 p-3 md:p-4 xl:border-b-0 xl:border-r">
          <div className="mb-3 flex items-center justify-between">
            <div><h2 className="text-sm font-bold text-slate-800">Formularz dokumentu</h2><p className="mt-0.5 text-[11px] text-slate-500">Wypełnij dane i skonfiguruj listy pozycji.</p></div>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500"><Eye size={12} className="mr-1 inline"/> {canEdit ? 'Edycja' : 'Podgląd'}</span>
          </div>
          <EnclosureDocumentForm data={data} onChange={changeForm} disabled={!canEdit} dictionaries={dictionaries}/>
        </aside>

        <main className="min-h-0 overflow-y-auto bg-slate-200/60 p-3 md:p-5 xl:p-6">
          <div className="mx-auto mb-3 flex max-w-[980px] flex-wrap items-center justify-between gap-2">
            <div><h2 className="text-sm font-bold text-slate-800">Podgląd końcowego dokumentu</h2><p className="mt-0.5 text-[11px] text-slate-500">{canEdit ? 'Kliknij dowolny tekst lub komórkę tabeli, aby poprawić treść bezpośrednio na dokumencie.' : 'Dokument w trybie tylko do odczytu.'}</p></div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-500"><span>{previewChanged ? 'Podgląd zawiera ręczne zmiany' : 'Podgląd wygenerowany z formularza'}</span><span>·</span><span>{templateLoading ? 'Wczytywanie wzorca…' : sharedTemplate ? 'Wspólny wzorzec · v' + sharedTemplate.version : 'Wzorzec lokalny · v1'}</span></div>
          </div>
          <DocumentPreviewEditor html={previewHtml} resetToken={previewResetToken} editable={canEdit} onChange={(html) => { setPreviewHtml(html); previewChangedRef.current = true; setPreviewChanged(true); }}/>
          {formChanged && previewChanged && <p className="mx-auto mt-3 max-w-[980px] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Zmieniłeś formularz, ale podgląd zawiera już ręczne poprawki. Nie nadpisuję ich automatycznie. Użyj „Odśwież podgląd”, aby świadomie zastąpić ręczną treść wersją z formularza.</p>}
          {message && <p role="status" className="mx-auto mt-3 max-w-[980px] rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">{message}</p>}
        </main>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5 md:px-6">
        <p className="text-[11px] text-slate-500">Zatwierdzenie zapisuje zmiany lokalnie w zleceniu. Użyj „Zapisz zmiany” w lewym panelu, aby wysłać je na serwer.</p>
        <button type="button" onClick={onClose} className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Zamknij</button>
      </footer>
      {dictionariesManagerOpen && canEdit && <DocumentDictionariesManager dictionaries={dictionaries} onClose={() => setDictionariesManagerOpen(false)} onSaved={setDictionaries}/>}
      {templateEditorOpen && currentProfile.id === 'admin' && (
        <DocumentTemplateEditorModal
          template={sharedTemplate}
          onClose={() => setTemplateEditorOpen(false)}
          onPublished={(published) => {
            sharedTemplateRef.current = published;
            setSharedTemplate(published);
            setTemplateLoading(false);
            // A not-yet-saved, untouched document can adopt the new version
            // immediately. Saved documents and manual edits are never replaced.
            if (dataRef.current.documentContentHtml === undefined && !previewChangedRef.current) {
              const nextHtml = renderVersionedEnclosureTemplate(published, dataRef.current, order);
              previewTemplateRef.current = published;
              setPreviewHtml(sanitizeDocumentHtml(nextHtml));
              setPreviewResetToken((value) => value + 1);
              setFormChanged(false);
            }
            setMessage('Opublikowano wspólny wzorzec v' + published.version + '. Nowe dokumenty użyją tej wersji; istniejąca treść i ręczne poprawki pozostają bez zmian.');
          }}
        />
      )}
    </div>
  );
};

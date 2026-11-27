import React, { useEffect, useRef } from 'react';
import { normalizeDocumentEditorHtml } from './DocumentTemplateService';

type Props = {
  html: string;
  resetToken: number;
  editable: boolean;
  onChange: (html: string) => void;
};

export const DocumentPreviewEditor: React.FC<Props> = ({ html, resetToken, editable, onChange }) => {
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current.innerHTML = normalizeDocumentEditorHtml(html);
  }, [resetToken]);

  const handleBlur = () => {
    if (!contentRef.current || !editable) return;
    // Normalize only the value persisted in React state. Never rewrite the live
    // contentEditable DOM on blur: Chromium may recreate its terminal paragraph
    // after an innerHTML replacement, so doing this repeatedly can accumulate
    // empty paragraphs across edit/save/reopen cycles.
    const currentHtml = contentRef.current.innerHTML;
    const normalizedHtml = normalizeDocumentEditorHtml(currentHtml);
    // onInput already forwarded unchanged content. Emit again only when
    // normalization actually removed browser-generated placeholders.
    if (currentHtml !== normalizedHtml) onChange(normalizedHtml);
  };

  return (
    <div className="document-preview-stage">
      <div className="document-print-target">
        <div
          ref={contentRef}
          className={'document-live-preview document-editor-content ' + (editable ? 'is-editable' : 'is-readonly')}
          contentEditable={editable}
          suppressContentEditableWarning
          spellCheck={false}
          onInput={(event) => onChange(event.currentTarget.innerHTML)}
          onBlur={handleBlur}
          aria-label={editable ? 'Edytowalny podgląd dokumentu' : 'Podgląd dokumentu'}
        />
      </div>
    </div>
  );
};

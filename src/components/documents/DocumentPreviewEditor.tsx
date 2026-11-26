import React, { useEffect, useRef } from 'react';
import { sanitizeDocumentHtml } from './documentModel';

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
    contentRef.current.innerHTML = sanitizeDocumentHtml(html);
  }, [resetToken]);

  const handleBlur = () => {
    if (!contentRef.current || !editable) return;
    const clean = sanitizeDocumentHtml(contentRef.current.innerHTML);
    contentRef.current.innerHTML = clean;
    onChange(clean);
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

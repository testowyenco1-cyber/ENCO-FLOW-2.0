import type { Order } from '../../types/enco';
import type { EnclosureDocumentData } from './documentModel';
import { sanitizeDocumentHtml } from './DocumentTemplateService';

export const updateOrderWithEnclosureDocument = (order: Order, data: EnclosureDocumentData): Order => {
  const item = order.items.find((candidate) => candidate.type === 'OBUDOWA');
  if (!item) return order;
  const now = new Date().toISOString();
  const persisted = {
    ...data,
    documentContentHtml: data.documentContentHtml !== undefined ? sanitizeDocumentHtml(data.documentContentHtml) : undefined,
    documentContentUpdatedAt: data.documentContentHtml !== undefined ? now : data.documentContentUpdatedAt,
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

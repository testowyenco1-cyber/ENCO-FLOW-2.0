import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_DOCUMENT_DICTIONARIES,
  DOOR_DIMENSIONS,
  mergeDocumentDictionaries,
  PASSAGE_SIDES,
} from '../src/components/documents/documentDictionaries';

test('document dictionaries accept the complete server list and remove duplicates', () => {
  const dictionaries = mergeDocumentDictionaries({
    smallElements: ['  Profil dodatkowy ', 'Kieszeń na schemat', 'profil dodatkowy', 42],
    passages: ['Przepust BWS 200', ' BWS 150 '],
    doors: DEFAULT_DOCUMENT_DICTIONARIES.doors,
    openings: DEFAULT_DOCUMENT_DICTIONARIES.openings,
    deliveriesWarszawa: DEFAULT_DOCUMENT_DICTIONARIES.deliveriesWarszawa,
    deliveriesPyskowice: DEFAULT_DOCUMENT_DICTIONARIES.deliveriesPyskowice,
  });

  assert.ok(dictionaries.smallElements.includes('Kieszeń na schemat'));
  assert.ok(dictionaries.smallElements.includes('Profil dodatkowy'));
  assert.equal(dictionaries.smallElements.filter((value) => value.toLocaleLowerCase('pl-PL') === 'profil dodatkowy').length, 1);
  assert.ok(dictionaries.passages.includes('BWS 150'));
  assert.ok(dictionaries.passages.includes('Przepust BWS 200'));
  assert.deepEqual(dictionaries.deliveriesWarszawa, DEFAULT_DOCUMENT_DICTIONARIES.deliveriesWarszawa);
});

test('a built-in item omitted by the server stays deleted in the client list', () => {
  const remaining = DEFAULT_DOCUMENT_DICTIONARIES.smallElements.filter((entry) => entry !== 'Kieszeń na schemat');
  const dictionaries = mergeDocumentDictionaries({ smallElements: remaining });

  assert.ok(!dictionaries.smallElements.includes('Kieszeń na schemat'));
  assert.deepEqual(dictionaries.smallElements, remaining);
});

test('missing dictionary categories fall back to the built-in list', () => {
  const dictionaries = mergeDocumentDictionaries({ smallElements: ['Nowa pozycja'] });

  assert.deepEqual(dictionaries.doors, DEFAULT_DOCUMENT_DICTIONARIES.doors);
  assert.deepEqual(dictionaries.passages, DEFAULT_DOCUMENT_DICTIONARIES.passages);
});

test('passage location selector contains only the four station sides', () => {
  assert.deepEqual(PASSAGE_SIDES, ['Przód', 'Tył', 'Lewo', 'Prawo']);
});

test('door size selector contains only the two standard dimensions', () => {
  assert.deepEqual(DOOR_DIMENSIONS.map((item) => [item.width, item.height]), [
    ['950', '2100'],
    ['1170', '2100'],
  ]);
});

import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_DOCUMENT_DICTIONARIES,
  DOOR_DIMENSIONS,
  mergeDocumentDictionaries,
  PASSAGE_SIDES,
} from '../src/components/documents/documentDictionaries';

test('document dictionaries retain built-in options and merge persisted additions without duplicates', () => {
  const dictionaries = mergeDocumentDictionaries({
    smallElements: ['  Nowa szafka pomocnicza ', 'Kieszeń na schemat', 'nowa szafka pomocnicza', 42],
    passages: ['Przepust BWS 200', ' BWS 150 '],
  });

  assert.ok(dictionaries.smallElements.includes('Kieszeń na schemat'));
  assert.ok(dictionaries.smallElements.includes('Nowa szafka pomocnicza'));
  assert.equal(dictionaries.smallElements.filter((value) => value.toLocaleLowerCase('pl-PL') === 'nowa szafka pomocnicza').length, 1);
  assert.ok(dictionaries.passages.includes('BWS 150'));
  assert.ok(dictionaries.passages.includes('Przepust BWS 200'));
  assert.deepEqual(dictionaries.deliveriesWarszawa, DEFAULT_DOCUMENT_DICTIONARIES.deliveriesWarszawa);
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

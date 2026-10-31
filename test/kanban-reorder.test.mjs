import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ContentStore } from '../content-store.mjs';

test('reorderContents reorders by ids array', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kanban-reorder-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new ContentStore(path.join(dir, 'contents.json'));

  const c1 = await store.create({ title: 'Card 1', stage: 'idea' });
  const c2 = await store.create({ title: 'Card 2', stage: 'idea' });
  const c3 = await store.create({ title: 'Card 3', stage: 'idea' });

  let db = await store.read();
  // store.create unshifts cards, so initial order is [c3, c2, c1]
  assert.deepEqual(db.contents.map(c => c.id), [c3.id, c2.id, c1.id]);

  // Reorder to [c1, c2, c3]
  await store.reorderContents({ ids: [c1.id, c2.id, c3.id] });
  db = await store.read();
  assert.deepEqual(db.contents.map(c => c.id), [c1.id, c2.id, c3.id]);
});

test('reorderContents supports position before, after, top, and bottom', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kanban-reorder-pos-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new ContentStore(path.join(dir, 'contents.json'));

  const c1 = await store.create({ title: 'Card 1', stage: 'script' });
  const c2 = await store.create({ title: 'Card 2', stage: 'script' });
  const c3 = await store.create({ title: 'Card 3', stage: 'script' });

  // Explicitly initialize order to [c1, c2, c3]
  await store.reorderContents({ ids: [c1.id, c2.id, c3.id] });
  let db = await store.read();
  assert.deepEqual(db.contents.map(c => c.id), [c1.id, c2.id, c3.id]);

  // Move c3 before c1 -> [c3, c1, c2]
  await store.reorderContents({ id: c3.id, targetId: c1.id, position: 'before' });
  db = await store.read();
  assert.deepEqual(db.contents.map(c => c.id), [c3.id, c1.id, c2.id]);

  // Move c3 after c2 -> [c1, c2, c3]
  await store.reorderContents({ id: c3.id, targetId: c2.id, position: 'after' });
  db = await store.read();
  assert.deepEqual(db.contents.map(c => c.id), [c1.id, c2.id, c3.id]);

  // Move c2 to top -> [c2, c1, c3]
  await store.reorderContents({ id: c2.id, position: 'top' });
  db = await store.read();
  assert.deepEqual(db.contents.map(c => c.id), [c2.id, c1.id, c3.id]);

  // Move c2 to bottom -> [c1, c3, c2]
  await store.reorderContents({ id: c2.id, position: 'bottom' });
  db = await store.read();
  assert.deepEqual(db.contents.map(c => c.id), [c1.id, c3.id, c2.id]);
});

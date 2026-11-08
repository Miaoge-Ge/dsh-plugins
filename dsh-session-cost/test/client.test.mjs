import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// The browser artefact registers a lazy factory; loading it must not touch the
// document or the host services. Only building the element tree may do that.
test('client bundle registers a side-effect-free factory and the expected services', async () => {
  let descriptor;
  const source = await readFile(new URL('../client.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, {window:{__ModuleLoader__:{load(value){descriptor=value;}}}});
  assert.equal(descriptor.id, '@local/session-cost');
  const imports = [];
  const client = descriptor.factory(name => {
    imports.push(name);
    return {createElement(){}};
  });
  assert.deepEqual(imports, ['react', 'react-dom']);
  assert.deepEqual(Array.from(client.inject), ['slots', 'locale', 'remote', 'remote.session', 'configForms']);
  assert.equal(typeof client.apply, 'function');
});

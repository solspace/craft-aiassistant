const assert = require('node:assert/strict');
const { after, afterEach, test } = require('node:test');
const { mkdtempSync, rmSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');
const { JSDOM } = require('jsdom');

const output = mkdtempSync(path.join(tmpdir(), 'ai-model-tests-'));
buildSync({
    entryPoints: [path.join(__dirname, '../resources/js/views/integrations/model-picker.js')],
    bundle: true, platform: 'node', format: 'cjs', outfile: path.join(output, 'picker.js'),
});
const { initializeModelPicker, recommendModel } = require(path.join(output, 'picker.js'));
after(() => rmSync(output, { recursive: true, force: true }));

let dom;
let callbacks;
let requests;
function mount({ model = '', key = 'test-key', provider = 'gemini', id = '', selectize = false } = {}) {
    dom = new JSDOM('<form id="integration-form"><input name="id"><select id="type"></select><input id="apiKey"><select id="aiassistant-model-picker"></select><button type="button" id="aiassistant-refresh-models"></button><p id="aiassistant-model-status"></p><div id="aiassistant-custom-model-field"><input id="model"></div></form>', { runScripts: 'outside-only' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    global.Craft = { t: (_, text) => text, getCpUrl: (url) => url, csrfTokenValue: 'test-csrf' };
    const type = document.getElementById('type');
    ['gemini', 'openai', 'anthropic', 'xai', 'replicate'].forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        type.append(option);
    });
    type.value = provider;
    document.querySelector('[name="id"]').value = id;
    document.getElementById('model').value = model;
    document.getElementById('apiKey').value = key;
    if (selectize) {
        window.eval(readFileSync(require.resolve('jquery/dist/jquery.js'), 'utf8'));
        window.eval(readFileSync(require.resolve('@selectize/selectize'), 'utf8'));
        window.jQuery('#aiassistant-model-picker').selectize({ searchField: ['text', 'value'] });
    }
    callbacks = new Map();
    global.setTimeout = (callback) => { const id = Symbol(); callbacks.set(id, callback); return id; };
    global.clearTimeout = (id) => callbacks.delete(id);
    requests = [];
    global.fetch = async (url, options) => {
        requests.push({ url, options });
        return { ok: true, json: async () => ({ models: [], available: true }) };
    };
    initializeModelPicker();
    return (id) => document.getElementById(id);
}
const originalTimers = { setTimeout: global.setTimeout, clearTimeout: global.clearTimeout };
const originalFetch = global.fetch;
async function flush() {
    const pending = [...callbacks.values()];
    callbacks.clear();
    for (const callback of pending) await callback();
}
afterEach(() => {
    dom?.window.dispatchEvent(new dom.window.Event('pagehide'));
    dom?.window.close();
    Object.assign(global, originalTimers, { fetch: originalFetch });
    for (const key of ['window', 'document', 'Event', 'Craft']) delete global[key];
});

test('loads models automatically with CSRF and credentials in the POST body', async () => {
    mount();
    await flush();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'ai-assistant/integrations/models');
    assert.equal(requests[0].options.headers['X-CSRF-Token'], 'test-csrf');
    assert.deepEqual(JSON.parse(requests[0].options.body), { provider: 'gemini', apiKey: 'test-key' });
});

test('without a key offers only Other and does not request models', async () => {
    const get = mount({ key: '' });
    await flush();
    assert.equal(requests.length, 0);
    assert.equal(get('aiassistant-model-picker').options.length, 1);
    assert.equal(get('aiassistant-refresh-models').disabled, true);
    assert.equal(get('aiassistant-custom-model-field').hidden, false);
});

test('preserves existing custom and environment-variable models', async () => {
    for (const model of ['custom-model', '$MY_MODEL', 'gemini-3-flash']) {
        const get = mount({ id: '12', model });
        await flush();
        assert.equal(get('model').value, model);
        assert.equal(get('aiassistant-model-picker').value, '__custom__');
        assert.equal(get('aiassistant-custom-model-field').hidden, false);
        dom.window.close();
    }
});

test('selects verified latest alias for new Gemini setups and allows a custom ID', async () => {
    const get = mount({ model: 'gemini-3.5-flash-lite' });
    global.fetch = async () => ({ ok: true, json: async () => ({
        available: true, models: [
            { id: 'gemini-3.5-flash-lite', label: 'Gemini Flash Lite' },
            { id: 'gemini-flash-lite-latest', label: 'Flash Lite (latest alias)' },
        ],
    }) });
    await flush();
    assert.equal(get('model').value, 'gemini-flash-lite-latest');
    assert.equal(get('aiassistant-custom-model-field').hidden, true);
    const picker = get('aiassistant-model-picker');
    picker.value = '__custom__';
    picker.dispatchEvent(new Event('change'));
    get('model').value = 'my-new-model';
    get('model').dispatchEvent(new Event('input'));
    get('aiassistant-refresh-models').click();
    await flush();
    assert.equal(get('model').value, 'my-new-model');
    assert.equal(get('aiassistant-custom-model-field').hidden, false);
});

test('preserves saved models even when a newer recommended model is available', async () => {
    const get = mount({ id: '12', model: 'gemini-3.5-flash-lite' });
    global.fetch = async () => ({ ok: true, json: async () => ({
        available: true, models: [
            { id: 'gemini-3.5-flash-lite', label: 'Flash Lite' },
            { id: 'gemini-flash-lite-latest', label: 'Latest alias' },
        ],
    }) });
    await flush();
    assert.equal(get('model').value, 'gemini-3.5-flash-lite');
    assert.equal(get('aiassistant-model-picker').value, 'gemini-3.5-flash-lite');
});

test('does not overwrite a custom selection made while models are loading', async () => {
    const get = mount();
    get('aiassistant-model-picker').dispatchEvent(new Event('change'));
    get('model').value = 'manual-model';
    get('model').dispatchEvent(new Event('input'));
    global.fetch = async () => ({ ok: true, json: async () => ({
        available: true, models: [{ id: 'gemini-flash-lite-latest', label: 'Latest alias' }],
    }) });
    await flush();
    assert.equal(get('model').value, 'manual-model');
});

test('ignores stale responses after changing provider or API key', async () => {
    const get = mount();
    let resolveFirst;
    global.fetch = () => new Promise((resolve) => { resolveFirst = resolve; });
    const first = flush();
    get('type').value = 'openai';
    get('type').dispatchEvent(new Event('change'));
    resolveFirst({ ok: true, json: async () => ({
        available: true, models: [{ id: 'gemini-flash-lite-latest', label: 'Stale' }],
    }) });
    await first;
    assert.equal(get('model').value, '');
    global.fetch = async () => ({ ok: true, json: async () => ({
        available: true, models: [{ id: 'gpt-5.4-mini', label: 'GPT Mini' }],
    }) });
    await flush();
    assert.equal(get('model').value, 'gpt-5.4-mini');
});

test('failed loading keeps custom IDs usable, and Refresh retries', async () => {
    const get = mount({ id: '12', model: 'my-model' });
    global.fetch = async () => { throw new Error('Network failure'); };
    await flush();
    assert.match(get('aiassistant-model-status').textContent, /Could not load models/);
    assert.equal(get('model').value, 'my-model');
    let retried = false;
    global.fetch = async () => { retried = true; return { ok: true, json: async () => ({ available: true, models: [] }) }; };
    get('aiassistant-refresh-models').click();
    await flush();
    assert.equal(retried, true);
});

test('Replicate remains usable with custom IDs without unsupported discovery requests', async () => {
    const get = mount({ provider: 'replicate', model: 'black-forest-labs/flux-2-pro' });
    await flush();
    assert.equal(requests.length, 0);
    assert.equal(get('model').value, 'black-forest-labs/flux-2-pro');
});

test('recommendations sort version numbers numerically', () => {
    assert.equal(recommendModel('gemini', [
        { id: 'gemini-3.9-flash-lite', label: '3.9' },
        { id: 'gemini-3.10-flash-lite', label: '3.10' },
    ]), 'gemini-3.10-flash-lite');
});

test('Craft-style Selectize searches models and saves selections from jQuery change events', async () => {
    const get = mount({ id: '12', model: 'gemini-3.5-flash-lite', selectize: true });
    global.fetch = async () => ({ ok: true, json: async () => ({
        available: true, models: [
            { id: 'gemini-3.5-flash-lite', label: 'Gemini Flash Lite' },
            { id: 'gemini-3.8-flash', label: 'Gemini Flash' },
        ],
    }) });
    await flush();
    const picker = get('aiassistant-model-picker').selectize;
    assert.equal(picker.getValue(), 'gemini-3.5-flash-lite');
    assert.equal(picker.search('Lite').items.length, 1);
    picker.setValue('gemini-3.8-flash');
    assert.equal(get('model').value, 'gemini-3.8-flash');
    assert.equal(picker.getValue(), 'gemini-3.8-flash');
    assert.equal(get('aiassistant-custom-model-field').hidden, true);
    picker.setValue('__custom__');
    assert.equal(get('aiassistant-custom-model-field').hidden, false);
    assert.equal(get('model').value, 'gemini-3.8-flash');
});

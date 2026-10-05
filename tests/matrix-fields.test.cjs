const assert = require('node:assert/strict');
const { after, beforeEach, afterEach, test } = require('node:test');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { buildSync } = require('esbuild');
const { JSDOM } = require('jsdom');

// Test the shipped source modules without changing the build tooling to ESM.
const output = mkdtempSync(path.join(tmpdir(), 'ai-assistant-tests-'));
buildSync({
    entryPoints: {
        fields: path.join(__dirname, '../resources/js/utils/field.js'),
        buttons: path.join(__dirname, '../resources/js/components/inline-buttons.js'),
    },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outdir: output,
});
const { getFieldHandle, getFieldTag, getFieldInput } = require(path.join(output, 'fields.js'));
const { attachInlineButtons, initializeInlineButtons } = require(path.join(output, 'buttons.js'));
after(() => rmSync(output, { recursive: true, force: true }));

let dom;
let stop;
beforeEach(() => {
    dom = new JSDOM('<!doctype html><body></body>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.MutationObserver = dom.window.MutationObserver;
    global.Event = dom.window.Event;
    window.aiAssistantSettings = { enabledFieldHandles: ['body', 'title'] };
});
afterEach(() => {
    stop?.();
    stop = undefined;
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.MutationObserver;
    delete global.Event;
});

function field(name, { handle, prompt = '', multiline = true } = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field';
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'input';
    const input = document.createElement(multiline ? 'textarea' : 'input');
    if (!multiline) input.type = 'text';
    input.name = name;
    inputWrapper.append(input);
    if (handle) {
        const tag = document.createElement('div');
        tag.className = 'ai-assistant-field';
        tag.dataset.fieldHandle = handle;
        tag.dataset.fieldPrompt = prompt;
        inputWrapper.append(tag);
    }
    wrapper.append(inputWrapper);
    return wrapper;
}

function matrix(...children) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field';
    wrapper.dataset.handle = 'contentBuilder';
    const input = document.createElement('div');
    input.className = 'input';
    input.append(...children);
    wrapper.append(input);
    return wrapper;
}

test('reads the enabled nested field metadata instead of the outer Matrix handle', () => {
    const child = field('fields[contentBuilder][entries][uid:one][fields][body]', {
        handle: 'body', prompt: '17',
    });
    const parent = matrix(child);
    document.body.append(parent);
    assert.equal(getFieldHandle(child), 'body');
    assert.equal(getFieldTag(child).dataset.fieldPrompt, '17');
    assert.equal(getFieldHandle(parent), 'contentBuilder');
    assert.equal(getFieldTag(parent), null);
});

test('handles plain, namespaced, deeply nested, and title inputs without metadata', () => {
    const cases = [
        ['title', 'title'],
        ['fields[body]', 'body'],
        ['fields[contentBuilder][entries][uid:one][fields][body]', 'body'],
        ['fields[contentBuilder][entries][uid:one][fields][inner][entries][uid:two][fields][body]', 'body'],
        ['namespace[fields][body]', 'body'],
        ['fields[contentBuilder][entries][uid:one][title]', 'title'],
        ['namespace[title]', 'title'],
    ];
    for (const [name, expected] of cases) {
        assert.equal(getFieldHandle(field(name)), expected, name);
    }
    const overridden = field('namespace[fields][original]');
    overridden.dataset.handle = 'body';
    assert.equal(getFieldHandle(overridden), 'body');
});

test('does not borrow metadata or an input from a descendant field', () => {
    const parent = matrix(field('fields[body]', { handle: 'body' }));
    delete parent.dataset.handle;
    assert.equal(getFieldHandle(parent), '');
    assert.equal(getFieldTag(parent), null);
});

test('buttons open and update the correct repeated Matrix field instance', () => {
    const first = field('fields[contentBuilder][entries][uid:one][fields][body]');
    const second = field('fields[contentBuilder][entries][uid:two][fields][body]', { multiline: false });
    const disabled = field('fields[contentBuilder][entries][uid:two][fields][disabled]');
    document.body.append(matrix(first, second, disabled));
    const opened = [];
    const onOpen = (target) => opened.push(target);
    attachInlineButtons(onOpen);
    attachInlineButtons(onOpen);
    assert.equal(document.querySelectorAll('.aiassistant-inline-btn').length, 2);
    second.querySelector('button').click();
    assert.deepEqual(opened, [second]);
    let changes = 0;
    second.addEventListener('input', () => changes++);
    getFieldInput(opened[0]).setValue('Generated text');
    assert.equal(getFieldInput(first).value(), '');
    assert.equal(getFieldInput(second).value(), 'Generated text');
    assert.equal(changes, 1);
});

test('CKEditor uses the selected Matrix editor and creates only one button', () => {
    const children = ['one', 'two'].map((uid) => {
        const child = field(`fields[contentBuilder][entries][uid:${uid}][fields][body]`, { handle: 'body' });
        const editor = document.createElement('div');
        editor.className = 'ck-editor';
        const editable = document.createElement('div');
        editable.className = 'ck-editor__editable';
        let content = uid;
        editable.ckeditorInstance = {
            getData: () => content,
            setData: (value) => { content = value; },
        };
        editor.append(editable);
        child.querySelector('.input').append(editor);
        return child;
    });
    document.body.append(matrix(...children));
    attachInlineButtons((target) => getFieldInput(target).setValue('<p>Generated</p>'));
    assert.equal(document.querySelectorAll('.aiassistant-inline-btn').length, 2);
    children[1].querySelector('button').click();
    assert.equal(getFieldInput(children[0]).value(), 'one');
    assert.equal(getFieldInput(children[1]).value(), '<p>Generated</p>');
});

test('duplicated DOM gets a working button bound to the duplicate', () => {
    const original = field('fields[body]', { handle: 'body' });
    document.body.append(matrix(original));
    const opened = [];
    const onOpen = (target) => opened.push(target);
    attachInlineButtons(onOpen);
    const duplicate = original.cloneNode(true);
    original.after(duplicate);
    attachInlineButtons(onOpen);
    assert.equal(duplicate.querySelectorAll('button').length, 1);
    duplicate.querySelector('button').click();
    original.querySelector('button').click();
    assert.deepEqual(opened, [duplicate, original]);
});

test('adds buttons automatically for asynchronous Matrix entries and slideout fields', async () => {
    // Wait for jsdom's DOMContentLoaded before starting the observer.
    if (document.readyState === 'loading') {
        await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    }
    const opened = [];
    stop = initializeInlineButtons((target) => opened.push(target));
    const child = field('fields[contentBuilder][entries][uid:new][fields][body]', { handle: 'body' });
    document.body.append(matrix(child));
    const slideout = document.createElement('div');
    slideout.className = 'slideout';
    const slideoutField = field('namespace[fields][body]');
    slideout.append(slideoutField);
    document.body.append(slideout);

    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(document.querySelectorAll('.aiassistant-inline-btn').length, 2);
    child.querySelector('button').click();
    slideoutField.querySelector('button').click();
    assert.deepEqual(opened, [child, slideoutField]);
    // A subsequent observer/click scan must not create duplicate buttons.
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(document.querySelectorAll('.aiassistant-inline-btn').length, 2);
});

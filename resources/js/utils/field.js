/**
 * Field Utilities
 * Common field detection and manipulation helpers
 */

import { qs, isString } from './dom.js';

/**
 * Get field handle from a field element
 */
export function getFieldHandle(field) {
    if (!field) return '';

    // Try name attribute on input/textarea
    const nameInput = qs('input[name], textarea[name]', field);
    if (nameInput && isString(nameInput.name)) {
        if (nameInput.name === 'title') return 'title';
        const match = nameInput.name.match(/fields\[(.*?)\]/);
        if (match && match[1]) return match[1];
    }

    // Fallback to data attribute
    return field.getAttribute('data-handle') || field.dataset.handle || '';
}

/**
 * Check if a field handle is enabled
 */
export function isFieldEnabled(handle) {
    const enabled = Array.isArray(window.aiAssistantSettings?.enabledFieldHandles)
        ? window.aiAssistantSettings.enabledFieldHandles
        : [];
    return enabled.length > 0 && handle && enabled.includes(handle);
}

/**
 * Returns a uniform interface for reading/setting field values.
 * { type, element, value: () => string, setValue: (val) => void }
 */
export function getFieldInput(field) {
    if (!field) return null;

    // CKEditor
    const ckEditor = qs('.ck-editor', field);
    if (ckEditor) {
        return {
            type: 'ckeditor',
            element: ckEditor,
            value: () => {
                const editable = qs('.ck-editor__editable', ckEditor);
                const instance = editable?.ckeditorInstance;
                return instance ? instance.getData() : '';
            },
            setValue: (val) => {
                const editable = qs('.ck-editor__editable', ckEditor);
                const instance = editable?.ckeditorInstance;
                if (instance && typeof instance.setData === 'function') instance.setData(val);
            }
        };
    }

    // TinyMCE
    const tinymceTextarea = qs('textarea[id*="tinymce"], .tinymce textarea', field);
    if (tinymceTextarea) {
        return {
            type: 'tinymce',
            element: tinymceTextarea,
            value: () => tinymceTextarea.value || '',
            setValue: (val) => {
                const instance = window.tinymce?.get(tinymceTextarea.id);
                if (instance && typeof instance.setContent === 'function') {
                    instance.setContent(val);
                } else {
                    tinymceTextarea.value = val;
                }
            }
        };
    }

    // Redactor
    const redactorTextarea = qs('textarea[id*="redactor"], .redactor textarea', field);
    if (redactorTextarea) {
        return {
            type: 'redactor',
            element: redactorTextarea,
            value: () => redactorTextarea.value || '',
            setValue: (val) => {
                if (window.Redactor && redactorTextarea.id) {
                    const redactorInstance = window.Redactor.get(redactorTextarea.id);
                    if (redactorInstance) {
                        redactorInstance.code.set(val);
                    } else {
                        redactorTextarea.value = val;
                    }
                } else {
                    redactorTextarea.value = val;
                }
            }
        };
    }

    // Assets (elementselect)
    const elementSelect = qs('.elementselect', field);
    if (elementSelect) {
        return {
            type: 'assets',
            element: elementSelect,
            value: () => qs('input[type="hidden"]', field)?.value || '',
            setValue: (val) => {
                // Custom asset logic would go here — placeholder for now.
                // Implementation is project-specific and may require Craft API calls.
            }
        };
    }

    // Plain input/textarea
    const textInput = qs('input[type="text"], textarea', field);
    if (textInput) {
        return {
            type: textInput.tagName.toLowerCase(),
            element: textInput,
            value: () => textInput.value || '',
            setValue: (val) => { textInput.value = val; }
        };
    }

    return null;
}

/**
 * Get field type from element
 */
export function getFieldType(el) {
    if (el.classList.contains('ck-editor')) return 'ckeditor';
    if (el.classList.contains('tinymce')) return 'tinymce';
    if (el.classList.contains('redactor')) return 'redactor';
    if (el.tagName === 'TEXTAREA') return 'textarea';
    if (el.tagName === 'INPUT') return 'input';
    return 'input';
}


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
            value: () => {
                // Try to get value from Redactor instance
                if (window.$ && window.$(redactorTextarea).data('redactor')) {
                    const instance = window.$(redactorTextarea).data('redactor');
                    if (instance && typeof instance.code.get === 'function') {
                        return instance.code.get();
                    }
                }
                // Fallback to textarea value
                return redactorTextarea.value || '';
            },
            setValue: (val) => {
                // Method 1: Try $R API (Redactor global function) - most common in Craft
                if (typeof window.$R === 'function' && redactorTextarea.id) {
                    try {
                        window.$R('#' + redactorTextarea.id, 'source.setCode', val);
                        // Also sync to update the editor
                        window.$R('#' + redactorTextarea.id, 'sync');
                        return;
                    } catch (e) {
                        // Continue to next method
                    }
                }
                
                // Method 2: Try jQuery data('redactor') - Craft's way
                if (window.$) {
                    const $textarea = window.$(redactorTextarea);
                    const instance = $textarea.data('redactor');
                    
                    if (instance) {
                        // Try code.set (most common)
                        if (instance.code && typeof instance.code.set === 'function') {
                            instance.code.set(val);
                            // Sync to update the editor
                            if (typeof instance.sync === 'function') {
                                instance.sync();
                            }
                            return;
                        }
                        // Try insert.set
                        if (instance.insert && typeof instance.insert.set === 'function') {
                            instance.insert.set(val);
                            if (typeof instance.sync === 'function') {
                                instance.sync();
                            }
                            return;
                        }
                        // Try set method
                        if (typeof instance.set === 'function') {
                            instance.set(val);
                            if (typeof instance.sync === 'function') {
                                instance.sync();
                            }
                            return;
                        }
                    }
                }
                
                // Method 3: Try window.Redactor.get API (older versions)
                if (window.Redactor && redactorTextarea.id) {
                    if (typeof window.Redactor.get === 'function') {
                        try {
                            const redactorInstance = window.Redactor.get(redactorTextarea.id);
                            if (redactorInstance) {
                                if (redactorInstance.code && typeof redactorInstance.code.set === 'function') {
                                    redactorInstance.code.set(val);
                                    if (typeof redactorInstance.sync === 'function') {
                                        redactorInstance.sync();
                                    }
                                    return;
                                }
                            }
                        } catch (e) {
                            // Continue to fallback
                        }
                    }
                }
                
                // Final fallback: set textarea value directly and trigger events
                redactorTextarea.value = val;
                // Trigger multiple events for Craft compatibility
                if (window.$) {
                    const $ta = window.$(redactorTextarea);
                    $ta.trigger('change');
                    $ta.trigger('input');
                }
                if (redactorTextarea.dispatchEvent) {
                    redactorTextarea.dispatchEvent(new Event('change', { bubbles: true }));
                    redactorTextarea.dispatchEvent(new Event('input', { bubbles: true }));
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

    // Plain input/textarea (covers PlainText fields and Title field)
    const textInput = qs('input[type="text"], textarea:not([id*="redactor"]):not([id*="tinymce"])', field);
    if (textInput) {
        return {
            type: textInput.tagName.toLowerCase(),
            element: textInput,
            value: () => textInput.value || '',
            setValue: (val) => {
                textInput.value = val;
                // Trigger events for Craft CMS to detect the change
                if (window.$) {
                    $(textInput).trigger('change').trigger('input');
                }
                if (textInput.dispatchEvent) {
                    textInput.dispatchEvent(new Event('change', { bubbles: true }));
                    textInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
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


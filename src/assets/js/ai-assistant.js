/**
 * AI Assistant Plugin - Frontend JavaScript
 * 
 * Handles inline AI button injection and modal functionality for Craft CMS.
 * Provides seamless integration with various field types including CKEditor,
 * TinyMCE, plain text, and asset fields.
 * 
 * @package solspace\aiassistant
 * @author solspace
 * @since 1.0.0
 */

(function() {
    'use strict';
    const CONFIG = {
        selectors: {
            fields: '.field .input input[type="text"]:not(.hidden), .field .input textarea:not(.hidden), .field .ck-editor, .field .tinymce',
            input: '.input',
            field: '.field'
        },
        button: {
            size: '22px',
            padding: 26,
            position: {
                right: '6px',
                top: '6px'
            }
        }
    };

    function getFieldHandle(field) {
        if (!field) return '';
        
        // Try to get from input name attribute
        const input = field.querySelector('input[name], textarea[name]');
        if (input && input.name) {
            if (input.name === 'title') return 'title';
            const match = input.name.match(/fields\[(.*?)\]/);
            if (match && match[1]) return match[1];
        }
        
        // Fallback to data attribute
        return field.getAttribute('data-handle') || '';
    }

    function getFieldInput(field) {
        if (!field) return null;

        // Check for CKEditor
        const ckEditor = field.querySelector('.ck-editor');
        if (ckEditor) {
            return {
                type: 'ckeditor',
                element: ckEditor,
                value: () => {
                    const instance = ckEditor.querySelector('.ck-editor__editable')?.ckeditorInstance;
                    return instance ? instance.getData() : '';
                },
                setValue: (val) => {
                    const instance = ckEditor.querySelector('.ck-editor__editable')?.ckeditorInstance;
                    if (instance) instance.setData(val);
                }
            };
        }

        // Check for TinyMCE
        const tinymceTextarea = field.querySelector('textarea[id*="tinymce"], .tinymce textarea');
        if (tinymceTextarea) {
            return {
                type: 'tinymce',
                element: tinymceTextarea,
                value: () => tinymceTextarea.value,
                setValue: (val) => {
                    if (window.tinymce && window.tinymce.get(tinymceTextarea.id)) {
                        window.tinymce.get(tinymceTextarea.id).setContent(val);
                    } else {
                        tinymceTextarea.value = val;
                    }
                }
            };
        }

        // Check for Assets field
        const elementSelect = field.querySelector('.elementselect');
        if (elementSelect) {
            return {
                type: 'assets',
                element: elementSelect,
                value: () => {
                    const hiddenInput = field.querySelector('input[type="hidden"]');
                    return hiddenInput ? hiddenInput.value : '';
                },
                setValue: (val) => {
                    // Placeholder for assets - would need custom implementation
                }
            };
        }

        // Default to text input/textarea
        const input = field.querySelector('input[type="text"], textarea');
        if (input) {
            return {
                type: input.tagName.toLowerCase(),
                element: input,
                value: () => input.value,
                setValue: (val) => { input.value = val; }
            };
        }

        return null;
    }

    function createAiButton() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = 'AI Assistant';
        btn.setAttribute('aria-label', 'AI Assistant');
        btn.className = 'aiassistant-inline-btn';
        
        // Apply button styles
        Object.assign(btn.style, {
            position: 'absolute',
            right: CONFIG.button.position.right,
            top: CONFIG.button.position.top,
            width: CONFIG.button.size,
            height: CONFIG.button.size,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--hairline-color, #e5e7eb)',
            borderRadius: '6px',
            background: 'var(--ui-control-bg, #fff)',
            cursor: 'pointer',
            zIndex: '2',
            padding: '0px',
            lineHeight: '1'
        });
        
        // Add SVG icon
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" 
                 aria-hidden="true" 
                 viewBox="0 0 30 30" 
                 width="14" 
                 height="14" 
                 style="display: block;">
                <path fill="#111" d="m14.2 19.7-1 2.6c-.5 1-1.9 1-2.3 0l-1.1-2.6q-1.6-3.5-5-5l-3-1.4c-1-.4-1-1.9 0-2.3l2.9-1.3q3.5-1.6 5-5.2L11 1.8c.4-1 1.8-1 2.2 0l1.1 2.7q1.6 3.6 5.1 5.2l3 1.3c1 .4 1 1.9 0 2.3l-3 1.4q-3.5 1.5-5 5m10.1 8.1-.4.8c-.2.5-1 .5-1.2 0l-.4-.8a6 6 0 0 0-3-3.1l-1-.5a.7.7 0 0 1 0-1.3l1-.4a6 6 0 0 0 3-3.2l.4-.9c.2-.5 1-.5 1.2 0l.4.9a6 6 0 0 0 3 3.2l1 .4q.9.7 0 1.3l-1 .5a6 6 0 0 0-3 3.1"></path>
            </svg>
        `;
        
        return btn;
    }

    function addInputPadding(input) {
        if (input.tagName !== 'INPUT' || input.type !== 'text') {
            return;
        }

        try {
            const currentPaddingRight = parseInt(
                window.getComputedStyle(input).paddingRight || '0', 
                10
            ) || 0;
            
            if (currentPaddingRight < CONFIG.button.padding) {
                input.style.paddingRight = CONFIG.button.padding + 'px';
            }
        } catch (error) {
            // Ignore padding errors
        }
    }

    function isFieldEnabled(handle) {
        const allowed = Array.isArray(window.aiAssistantSettings?.enabledFieldHandles) 
            ? window.aiAssistantSettings.enabledFieldHandles 
            : [];
        
        return allowed.length > 0 && handle && allowed.includes(handle);
    }

    function attachButtonToField(el) {
        if (el.dataset.aiassistantBtn) return;
        
        const field = el.closest(CONFIG.selectors.field);
        if (!field) return;
        
        const handle = getFieldHandle(field);
        if (!isFieldEnabled(handle)) return;
        
        // Check if this field already has an AI button
        const inputWrapper = el.closest(CONFIG.selectors.input);
        if (inputWrapper && inputWrapper.querySelector('.aiassistant-inline-btn')) {
            return; // Already has a button
        }
        
        el.dataset.aiassistantBtn = '1';
        
        if (!inputWrapper) return;
        
        // Set up container positioning
        const container = inputWrapper;
        if (!container.style.position) { 
            container.style.position = 'relative'; 
        }
        
        // Add padding for plain text fields
        addInputPadding(el);
        
        // Create and attach button
        const btn = createAiButton();
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try { 
                btn.blur(); 
            } catch (error) {
                // Ignore blur errors
            }
            openGenerateModal(field);
        });
        
        container.appendChild(btn);
    }

    function attachInlineButtons() {
        const selector = CONFIG.selectors.fields;
        document.querySelectorAll(selector).forEach(attachButtonToField);
    }

    async function openGenerateModal(field) {
        if (window.AiAssistantModal && window.AiAssistantModal.openGenerateModal) {
            await window.AiAssistantModal.openGenerateModal(field);
        }
    }

    function initialize() {
        // Attach buttons on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', attachInlineButtons);
        } else {
            attachInlineButtons();
        }

        // Re-attach on dynamic content changes
        document.addEventListener('click', attachInlineButtons);
    }

    // Initialize when script loads
    initialize();

    // Expose functions globally for external access
    window.AiAssistant = {
        attachInlineButtons,
        openGenerateModal,
        getFieldHandle,
        getFieldInput,
        CONFIG
    };
})();
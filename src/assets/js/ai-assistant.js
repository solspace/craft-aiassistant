/**
 * AI Assistant Plugin - Frontend JavaScript
 *
 * Handles inline AI button injection and modal functionality for Craft CMS.
 * Integrates with CKEditor, TinyMCE, plain text, and asset fields.
 *
 * @package solspace\aiassistant
 * @author solspace
 * @since 1.0.0
 */

(() => {
    'use strict';

    /**
     * ---------------------------------------------------------------------
     * Configuration
     * ---------------------------------------------------------------------
     */
    const CONFIG = {
        selectors: {
            fields: [
                '.field .input input[type="text"]:not(.hidden)',
                '.field .input textarea:not(.hidden)',
                '.field .ck-editor',
                '.field .tinymce'
            ].join(', '),
            inputWrapper: '.input',
            field: '.field'
        },
        button: {
            size: '22px',
            paddingRight: 26,
            position: { right: '6px', top: '6px' }
        },
        cssClass: {
            inlineButton: 'aiassistant-inline-btn',
            typeBadge: 'ai-assistant-type-badge',
            chipContainer: 'ai-prompts-chip'
        }
    };

    /**
     * ---------------------------------------------------------------------
     * Utilities
     * ---------------------------------------------------------------------
     */
    const qs = (selector, ctx = document) => ctx.querySelector(selector);
    const qsa = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));
    const noop = () => {};
    const isString = (v) => typeof v === 'string' && v.length > 0;

    /**
     * ---------------------------------------------------------------------
     * Field helpers
     * ---------------------------------------------------------------------
     */
    function getFieldHandle(field) {
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

    function isFieldEnabled(handle) {
        const enabled = Array.isArray(window.aiAssistantSettings?.enabledFieldHandles)
            ? window.aiAssistantSettings.enabledFieldHandles
            : [];
        return enabled.length > 0 && handle && enabled.includes(handle);
    }

    /**
     * Returns a uniform interface for reading/setting field values.
     * { type, element, value: () => string, setValue: (val) => void }
     */
    function getFieldInput(field) {
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
     * ---------------------------------------------------------------------
     * Inline button creation & injection
     * ---------------------------------------------------------------------
     */
    function createAiButtonElement() {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = 'AI Assistant';
        btn.setAttribute('aria-label', 'AI Assistant');
        btn.className = CONFIG.cssClass.inlineButton;

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
            padding: '3px',
            lineHeight: '1'
        });

        // SVG icon (kept inline for portability)
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 30 30">
                <path fill="#111" d="m14.2 19.7-1 2.6c-.5 1-1.9 1-2.3 0l-1.1-2.6q-1.6-3.5-5-5l-3-1.4c-1-.4-1-1.9 0-2.3l2.9-1.3q3.5-1.6 5-5.2L11 1.8c.4-1 1.8-1 2.2 0l1.1 2.7q1.6 3.6 5.1 5.2l3 1.3c1 .4 1 1.9 0 2.3l-3 1.4q-3.5 1.5-5 5m10.1 8.1-.4.8c-.2.5-1 .5-1.2 0l-.4-.8a6 6 0 0 0-3-3.1l-1-.5a.7.7 0 0 1 0-1.3l1-.4a6 6 0 0 0 3-3.2l.4-.9c.2-.5 1-.5 1.2 0l.4.9a6 6 0 0 0 3 3.2l1 .4q.9.7 0 1.3l-1 .5a6 6 0 0 0-3 3.1"/>
            </svg>
        `;

        return btn;
    }

    function ensureInputPaddingForButton(inputEl) {
        try {
            if (inputEl.tagName === 'INPUT' && inputEl.type === 'text') {
                const computed = window.getComputedStyle(inputEl);
                const right = parseInt(computed.paddingRight || '0', 10) || 0;
                if (right < CONFIG.button.paddingRight) {
                    inputEl.style.paddingRight = `${CONFIG.button.paddingRight}px`;
                }
            }
        } catch (err) {
            // Fail silently — styling enhancement only
        }
    }

    function attachButtonToField(inputEl) {
        if (!inputEl || inputEl.dataset.aiassistantBtn) return;

        const field = inputEl.closest(CONFIG.selectors.field);
        if (!field) return;

        const handle = getFieldHandle(field);
        if (!isFieldEnabled(handle)) return;

        // Prevent duplicate button in the same input wrapper
        const inputWrapper = inputEl.closest(CONFIG.selectors.inputWrapper);
        if (!inputWrapper) return;
        if (qs(`.${CONFIG.cssClass.inlineButton}`, inputWrapper)) return;

        // mark as processed
        inputEl.dataset.aiassistantBtn = '1';

        // ensure wrapper is positioned so absolute child positions correctly
        if (!inputWrapper.style.position) {
            inputWrapper.style.position = 'relative';
        }

        ensureInputPaddingForButton(inputEl);

        const btn = createAiButtonElement();
        btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            try { btn.blur(); } catch (e) { /* ignore */ }
            openGenerateModal(field);
        });

        inputWrapper.appendChild(btn);
    }

    function attachInlineButtons() {
        const nodes = qsa(CONFIG.selectors.fields);
        nodes.forEach(attachButtonToField);
    }

    /**
     * ---------------------------------------------------------------------
     * Modal & Prompt picker logic (modularized)
     * ---------------------------------------------------------------------
     */

    /**
     * Open the field-specific generate modal (if available)
     * field: DOM node for the field (closest .field)
     */
    async function openGenerateModal(field) {
        if (window.AiAssistantModal?.openGenerateModal) {
            try {
                await window.AiAssistantModal.openGenerateModal(field);
            } catch (err) {
                // Log but don't break
                /* eslint-disable no-console */
                console.error('Failed to open generate modal:', err);
                /* eslint-enable no-console */
            }
        }
    }

    /**
     * Open the prompt picker modal for a given field handle. This function
     * requests the HTML, inserts it into the page, initializes UI, loads
     * integrations and prompt details when needed, and wires up handlers.
     *
     * fieldHandle: String
     */
    function openPromptPicker(fieldHandle) {
        if (!isString(fieldHandle)) {
            Craft.cp.displayError('Field handle is required to open prompt picker.');
            return;
        }

        const url = Craft.getCpUrl('ai-assistant/ui/prompt-edit-modal');
        fetch(url, { credentials: 'same-origin' })
            .then((res) => {
                if (!res.ok) throw new Error(`Failed to fetch prompt modal HTML (status ${res.status})`);
                return res.text();
            })
            .then((html) => {
                _renderPromptModal(html, fieldHandle);
            })
            .catch(() => {
                Craft.cp.displayError('Could not open prompt picker');
            });
    }

    /**
     * Internal: render modal HTML into document and initialize behavior
     */
    function _renderPromptModal(html, fieldHandle) {
        // Remove existing modal safely (stop animations to avoid Velocity errors)
        const $existing = $('.ai-assistant-prompt-modal');
        if ($existing.length) {
            const existingModal = $existing.data('modal');
            if (existingModal && typeof existingModal.hide === 'function') {
                if (existingModal.$shade?.length) existingModal.$shade.stop(true, false);
                $existing.stop(true, false);
                $existing.remove();
            } else {
                $existing.remove();
            }
        }

        const $modal = $(html);
        $modal.appendTo(document.body);
        const modalInstance = new Garnish.Modal($modal, { onHide: () => $modal.remove() });
        $modal.data('modal', modalInstance);
        $modal.data('fieldHandle', fieldHandle);

        // Initialize internal module state + UI
        _initPromptModalUI($modal, modalInstance, fieldHandle);
    }

    /**
     * Initialize UI controls and event handlers inside the prompt modal
     */
    function _initPromptModalUI($modal, modalInstance, fieldHandle) {
        // Populate current prompt selection from hidden input (if exists)
        let currentPromptId = '';
        const $hiddenInput = $(`input[name="settings[fieldPrompts][${fieldHandle}]"]`);
        if ($hiddenInput.length) currentPromptId = $hiddenInput.val() || '';

        // Utility to find elements inside modal
        const $selectExisting = $modal.find('#prompt-existing-select');
        const $detailsSection = $modal.find('#prompt-details-section');
        const $saveNewBtn = $modal.find('#save-prompt-btn');
        const $saveSelectedBtn = $modal.find('#save-selected-prompt-btn');
        const $integrationSelect = $modal.find('#modal-integration');

        // Insert icon if available
        const iconContainer = $modal.find('#aiassistant-prompt-modal-icon');
        if (iconContainer.length && window.aiAssistantIconSvg) {
            iconContainer.html(window.aiAssistantIconSvg);
        }

        // Initialize Craft UI elements if function available
        try { if (typeof Craft.initUiElements === 'function') Craft.initUiElements($modal.find('.body')); } catch (e) {}

        // Load integrations when needed
        if ($integrationSelect.length) {
            _loadModalIntegrations($integrationSelect);
        }

        // If there is already a selected prompt, show save button and details
        if (currentPromptId && $selectExisting.length && $selectExisting.find(`option[value="${currentPromptId}"]`).length) {
            $saveSelectedBtn.show();
            // Set the select dropdown value to the current prompt
            // Use small delay so modal finishes rendering and Craft UI is initialized
            setTimeout(() => {
                $selectExisting.val(currentPromptId).trigger('change');
                // The change handler will automatically load the details
            }, 100);
        }

        // Toggle create/select modes
        $modal.on('click', '#show-create-prompt-form', () => {
            $modal.find('#prompt-select-mode').hide();
            $modal.find('#prompt-create-mode').show();
            $saveNewBtn.show();
            $saveSelectedBtn.hide();
            // Ensure integrations are fresh
            if ($integrationSelect.length) _loadModalIntegrations($integrationSelect);
        });

        $modal.on('click', '#show-select-prompt', () => {
            $modal.find('#prompt-create-mode').hide();
            $modal.find('#prompt-select-mode').show();
            $saveNewBtn.hide();

            // Show save selected if an option is selected
            const val = $modal.find('#prompt-existing-select').val();
            if (val) $saveSelectedBtn.show();
            else $saveSelectedBtn.hide();
        });

        // Save selected prompt -> apply selection to field and optionally submit settings
        $modal.on('click', '#save-selected-prompt-btn', () => {
            const $sel = $modal.find('#prompt-existing-select');
            const id = $sel.val() || '';
            const $selectedOption = $sel.find('option:selected');
            let name = $selectedOption.text().trim();
            let type = '';

            if (id) {
                // Remove trailing " (Type)" from text if present
                name = name.replace(/\s*\([^)]*\)$/, '');
                type = ($selectedOption.data('type') || '').toString().toLowerCase();
            } else {
                name = 'Any';
            }

            applyPromptSelection(fieldHandle, id, name, type);

            // Close modal
            modalInstance.hide();

            // Auto-submit settings form if present
            const $settingsForm = $('#ai-assistant-settings-form');
            if ($settingsForm.length) {
                Craft.cp.displayNotice('Saving settings...');
                $settingsForm.submit();
            } else {
                Craft.cp.displayNotice('Prompt selection updated. Please save the settings form to persist this change.');
            }
        });

        // Save new prompt form handler (delegated submit)
        $modal.on('submit', '#ai-assistant-create-prompt-form', (e) => {
            e.preventDefault();
            _savePromptFromModal(e, $modal, modalInstance);
            return false;
        });

        // Close modal via data attribute
        $modal.on('click', '[data-close-modal]', () => modalInstance.hide());

        // Show prompt details when selection changes
        $modal.on('change', '[data-existing-select], #prompt-existing-select', (ev) => {
            const $target = $(ev.currentTarget);
            const id = $target.val() || '';

            // Always show save button on change
            if ($saveSelectedBtn.length) $saveSelectedBtn.show();

            if (id && $detailsSection.length) {
                _loadPromptDetails($modal, id);
            } else if ($detailsSection.length) {
                $detailsSection.hide();
            }
        });
    }

    /**
     * Load prompt details (from API) and display in modal details section
     * $modal: jQuery modal element, promptId: string
     */
    function _loadPromptDetails($modal, promptId) {
        if (!promptId) return;
        const $detailsSection = $modal.find('#prompt-details-section');
        if (!$detailsSection.length) return;

        fetch(Craft.getCpUrl('ai-assistant/api/prompts'), {
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
        })
            .then((res) => res.json())
            .then((data) => {
                const prompt = Array.isArray(data.prompts)
                    ? data.prompts.find(p => String(p.id) === String(promptId))
                    : null;

                if (!prompt) {
                    $detailsSection.hide();
                    return;
                }

                $modal.find('#prompt-details-name').text(prompt.name || '');
                const $typeBadge = $modal.find('#prompt-details-type');
                const prettyType = prompt.type ? prompt.type.charAt(0).toUpperCase() + prompt.type.slice(1) : '';
                $typeBadge.text(prettyType);
                $typeBadge.attr('class', `ai-assistant-type-badge ai-assistant-type-${prompt.type || 'any'}`);

                const integrationText = prompt.integrationHandle ? prompt.integrationHandle : 'Default';
                $modal.find('#prompt-details-integration').text(`Integration: ${integrationText}`);

                $modal.find('#prompt-details-text').text(prompt.promptText || '');
                $detailsSection.show();
            })
            .catch(() => {
                $detailsSection.hide();
            });
    }

    /**
     * Load available integrations into a <select> in the modal
     * $integrationSelect: jQuery element
     */
    function _loadModalIntegrations($integrationSelect) {
        if (!$integrationSelect.length) return;

        fetch(Craft.getCpUrl('ai-assistant/api/integrations'), {
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
        })
            .then((res) => res.json())
            .then((result) => {
                $integrationSelect.empty();
                if (result?.success && Array.isArray(result.integrations) && result.integrations.length) {
                    $integrationSelect.append('<option value="">Use default (Any)</option>');
                    result.integrations.forEach((integration) => {
                        $integrationSelect.append(`<option value="${integration.handle}">${integration.name}</option>`);
                    });
                } else {
                    $integrationSelect.append('<option value="">No integrations available</option>');
                }

                try { if (typeof Craft.initUiElements === 'function') Craft.initUiElements($integrationSelect.closest('.field')); } catch (e) {}
            })
            .catch(() => {
                $integrationSelect.empty().append('<option value="">Failed to load integrations</option>');
            });
    }

    /**
     * Save prompt created from modal form. Called on form submit.
     * e: submit event, $modal: jQuery modal element, modalInstance: Garnish modal instance
     */
    function _savePromptFromModal(e, $modal, modalInstance) {
        e.preventDefault();

        const name = $modal.find('#modal-name').val();
        const type = ($modal.find('#modal-type').val() || '').toString();
        const promptText = $modal.find('#modal-promptText').val();
        const integrationHandle = $modal.find('#modal-integration').val() || '';
        const fieldHandle = $modal.data('fieldHandle');

        if (!fieldHandle) {
            Craft.cp.displayError('Field handle not found. Cannot save prompt selection.');
            return false;
        }

        Craft.postActionRequest('ai-assistant/api/save-prompt', {
            name, type, promptText, integrationHandle
        }, (response) => {
            if (response && response.success && response.prompt) {
                const p = response.prompt;
                const promptId = String(p.id);

                // Apply selection to field BEFORE closing modal (ensures DOM presence)
                applyPromptSelection(fieldHandle, promptId, p.name, p.type);

                if (modalInstance) modalInstance.hide();

                const $settingsForm = $('#ai-assistant-settings-form');
                if ($settingsForm.length) {
                    Craft.cp.displayNotice('Prompt saved and settings updated. Saving...');
                    $settingsForm.submit();
                } else {
                    Craft.cp.displayNotice('Prompt saved. Please save the settings form to persist this change.');
                }
            } else {
                Craft.cp.displayError(response?.error || 'Save failed');
            }
        });

        return false;
    }

    /**
     * ---------------------------------------------------------------------
     * applyPromptSelection - Set the hidden input and update visual chip
     * - fieldHandle: string
     * - id: prompt id (string or empty)
     * - name: display name for the prompt (string)
     * - type: prompt type (string)
     *
     * Returns true if updated, false otherwise.
     * ---------------------------------------------------------------------
     */
    function applyPromptSelection(fieldHandle, id, name, type) {
        if (!fieldHandle) return false;

        const inputName = `settings[fieldPrompts][${fieldHandle}]`;
        let hidden = document.querySelector(`input[name="${inputName}"]`);

        // Fallback to data attribute if not found
        if (!hidden) {
            hidden = document.querySelector(`input[data-prompt-value="${fieldHandle}"]`);
        }

        if (!hidden) {
            /* eslint-disable no-console */
            console.error('Could not find hidden input for field:', fieldHandle);
            /* eslint-enable no-console */
            return false;
        }

        const promptId = id ? String(id) : '';
        hidden.value = promptId;
        // Trigger change so other code picks it up
        $(hidden).trigger('change');

        // Try to find chip container near the hidden input
        let chipContainer = null;

        // Check previous sibling
        if (hidden.previousElementSibling && hidden.previousElementSibling.classList?.contains(CONFIG.cssClass.chipContainer)) {
            chipContainer = hidden.previousElementSibling;
        } else {
            // Walk previous siblings
            let sib = hidden.previousElementSibling;
            while (sib) {
                if (sib.classList && sib.classList.contains(CONFIG.cssClass.chipContainer)) {
                    chipContainer = sib;
                    break;
                }
                sib = sib.previousElementSibling;
            }
        }

        // Try row fallback
        if (!chipContainer) {
            const $row = $(hidden).closest('tr');
            if ($row.length) {
                chipContainer = $row.find(`.${CONFIG.cssClass.chipContainer}`).get(0);
            }
        }

        // Final fallback: search entire document for matching chip whose hidden input matches
        if (!chipContainer) {
            const all = qsa(`.${CONFIG.cssClass.chipContainer}`);
            for (let i = 0; i < all.length; i++) {
                const chip = all[i];
                const foundHidden = chip.parentElement?.querySelector(`input[name="${inputName}"]`);
                if (foundHidden === hidden) {
                    chipContainer = chip;
                    break;
                }
            }
        }

        if (!chipContainer) {
            /* eslint-disable no-console */
            console.error('Could not find chip container for field:', fieldHandle, 'Hidden input:', hidden);
            /* eslint-enable no-console */
            return false;
        }

        // Update badge inside chip
        const badge = chipContainer.querySelector(`.${CONFIG.cssClass.typeBadge}`);
        if (badge) {
            badge.textContent = promptId ? name : 'Any';
            const typeClass = promptId ? `ai-assistant-type-${(type || 'any')}` : 'ai-assistant-type-any';
            badge.className = `${CONFIG.cssClass.typeBadge} ${typeClass}`;
            return true;
        } else {
            /* eslint-disable no-console */
            console.error('Found chip container but no badge element inside for field:', fieldHandle);
            /* eslint-enable no-console */
        }

        return false;
    }

    /**
     * ---------------------------------------------------------------------
     * Initialization
     * ---------------------------------------------------------------------
     */
    function initialize() {
        // Attach on DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', attachInlineButtons);
        } else {
            attachInlineButtons();
        }

        // Re-attach when users click (covers some dynamic UI cases)
        document.addEventListener('click', attachInlineButtons);
    }

    // Run init immediately
    initialize();

    /**
     * ---------------------------------------------------------------------
     * Public API (exposed on window.AiAssistant)
     * Order places commonly-used helpers at top for discoverability.
     * ---------------------------------------------------------------------
     */
    window.AiAssistant = {
        // Common helpers
        attachInlineButtons,
        openGenerateModal,
        openPromptPicker,
        applyPromptSelection,

        // Field introspection
        getFieldHandle,
        getFieldInput,

        // Config exposure for debugging/extensions
        CONFIG
    };

})();

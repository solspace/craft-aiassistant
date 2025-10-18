/**
 * AI Assistant Modal Functionality
 * 
 * Handles modal operations and AI text generation for Craft CMS.
 * Provides a unified interface for text and image generation across
 * different field types and AI integrations.
 * 
 * @package solspace\aiassistant
 * @author solspace
 * @since 1.0.0
 */

(function() {
    'use strict';

    const MODAL_CONFIG = {
        options: {
            resizable: false,
            closeOnEsc: true,
            shade: true,
            shadeCloseOnClick: true,
            autoShow: true,
            hideOnEsc: true,
            hideOnShadeClick: true
        },
        focusDelay: 100
    };

    async function fetchModalHtml() {
        const url = Craft.getCpUrl('ai-assistant/ui/generate-text-modal');
        const response = await fetch(url, { 
            headers: { 'Accept': 'text/html' } 
        });
        
        if (!response.ok) {
            throw new Error('Failed to load modal');
        }
        
        return await response.text();
    }

    function getFieldType(el) {
        if (el.classList.contains('ck-editor')) return 'ckeditor';
        if (el.classList.contains('tinymce')) return 'tinymce';
        if (el.classList.contains('redactor')) return 'redactor';
        if (el.tagName === 'TEXTAREA') return 'textarea';
        if (el.tagName === 'INPUT') return 'input';
        return 'input';
    }

    function getFieldInput(field) {
        if (!field) return null;
        
        // Check for CKEditor first
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

        // Check for Redactor
        const redactorTextarea = field.querySelector('textarea[id*="redactor"], .redactor textarea');
        if (redactorTextarea) {
            return {
                type: 'redactor',
                element: redactorTextarea,
                value: () => redactorTextarea.value,
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
                    // Placeholder for assets
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

    function initializeRichTextEditors(fieldType, field, $comparisonSection) {
        const $inputRich = $comparisonSection.find('#aiassistant-text-input-rich');
        const $generatedRich = $comparisonSection.find('#aiassistant-text-generated-rich');
        
        // Get current content from the original field
        const inputObj = getFieldInput(field);
        const currentContent = inputObj ? inputObj.value() : '';
        
        // Set initial content in input context editor
        $inputRich.html(currentContent);
        
        // Initialize editors based on field type
        switch (fieldType) {
            case 'ckeditor':
                initializeCKEditorEditors($inputRich, $generatedRich);
                break;
            case 'tinymce':
                initializeTinyMCEEditors($inputRich, $generatedRich);
                break;
            case 'redactor':
                initializeRedactorEditors($inputRich, $generatedRich);
                break;
            default:
                // Fallback to simple HTML display
                $inputRich.html(currentContent);
                $generatedRich.html('');
        }
    }

    function initializeCKEditorEditors($inputRich, $generatedRich) {
        // For CKEditor, we'll use simple HTML display since initializing full CKEditor instances
        // in modals can be complex. Users can still see the HTML content clearly.
        $inputRich.addClass('aiassistant-html-display');
        $generatedRich.addClass('aiassistant-html-display');
    }

    function initializeTinyMCEEditors($inputRich, $generatedRich) {
        // For TinyMCE, we'll use simple HTML display since initializing full TinyMCE instances
        // in modals can be complex. Users can still see the HTML content clearly.
        $inputRich.addClass('aiassistant-html-display');
        $generatedRich.addClass('aiassistant-html-display');
    }

    function initializeRedactorEditors($inputRich, $generatedRich) {
        // For Redactor, we'll use simple HTML display since initializing full Redactor instances
        // in modals can be complex. Users can still see the HTML content clearly.
        $inputRich.addClass('aiassistant-html-display');
        $generatedRich.addClass('aiassistant-html-display');
    }

    function getFieldHandle(field) {
        if (!field) return '';
        
        // First try to get from the injected AI Assistant field tag
        const fieldTag = field.querySelector('.ai-assistant-field');
        if (fieldTag && fieldTag.dataset.fieldHandle) {
            return fieldTag.dataset.fieldHandle;
        }
        
        // Fallback: Craft renders field inputs as name="fields[handle]"
        const inputObj = getFieldInput(field);
        if (inputObj && inputObj.element && inputObj.element.name) {
            if (inputObj.element.name === 'title') return 'title';
            const match = inputObj.element.name.match(/fields\[(.*?)\]/);
            if (match && match[1]) return match[1];
        }
        
        // Final fallback: data attribute on field
        return field.getAttribute('data-handle') || '';
    }

    function injectModalIcon(modalElement) {
        const $iconContainer = $(modalElement).find('#aiassistant-modal-icon');
        if ($iconContainer.length && window.aiAssistantIconSvg) {
            // Replace the text content with the SVG icon
            $iconContainer.html(window.aiAssistantIconSvg);
        } else {
            // Silently ignore missing icon
        }
    }

    function createModal(modalHtml) {
        const modal = new Garnish.Modal(modalHtml, MODAL_CONFIG.options);

        // Set up modal cleanup
        modal.on('hide', function() {
            $(document).off('mousedown.aiassistant click.aiassistant activate.aiassistant');
        });

        // Handle focus management after modal is shown
        modal.on('show', function() {
            setTimeout(() => {
                try {
                    // Use DOM element directly for focus management
                    const modalElement = document.querySelector('.modal:last-of-type');
                    if (modalElement) {
                        const $body = $(modalElement).find('.body');
                        if ($body && $body.length) {
                            const firstInput = $body.find('input, textarea, select').first();
                            if (firstInput.length) {
                                firstInput.focus();
                            }
                        }
                    }
                } catch (error) {
                    // ignore
                }
            }, MODAL_CONFIG.focusDelay);
        });

        return modal;
    }

    async function loadIntegrations($select) {
        try {
            const response = await fetch(Craft.getCpUrl('ai-assistant/api/integrations'), {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            });
            const result = await response.json();
            
            $select.empty();
            if (result.success && result.integrations) {
                result.integrations.forEach(integration => {
                    $select.append(
                        `<option value="${integration.handle}">${integration.name}</option>`
                    );
                });
            } else {
                $select.append('<option value="">No integrations available</option>');
            }
        } catch (error) {
            $select.empty().append('<option value="">Failed to load integrations</option>');
        }
    }

    async function loadPrompts($select, $promptText, $integration) {
        try {
            const response = await fetch(Craft.getCpUrl('ai-assistant/api/prompts'), {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            });
            const result = await response.json();

            $select.empty();
            
            if (result.success && result.prompts) {
                // Filter out image prompts
                const textPrompts = result.prompts.filter(prompt => 
                    !prompt.name.toLowerCase().includes('image')
                );
                
                textPrompts.forEach(prompt => {
                    $select.append(
                        `<option value="${prompt.id}" data-integration="${prompt.integrationHandle || ''}" data-prompt-text="${prompt.promptText.replace(/"/g, '&quot;')}">${prompt.name}</option>`
                    );
                });
                
                // Add custom prompt option
                $select.append('<option value="custom">Custom…</option>');

                // Handle prompt selection
                $select.off('change').on('change', function() {
                    const selectedId = $(this).val();
                    const selectedOption = $(this).find('option:selected');
                    const integrationHandle = selectedOption.data('integration');
                    
                    // selection changed
                    
                    if (selectedId === 'custom') {
                        // Clear prompt text for custom input
                        $promptText.val('');
                        $promptText.prop('placeholder', 'Enter your custom prompt here...');
                        // custom prompt
                    } else if (selectedId) {
                        // Try to find the prompt in the current result first
                        let prompt = result.prompts.find(p => p.id === selectedId);
                        
                        // If not found, try to get it from the option's data attribute
                        if (!prompt) {
                            const promptText = selectedOption.data('prompt-text');
                            if (promptText) {
                                $promptText.val(promptText);
                                $promptText.prop('placeholder', '');
                                // updated prompt text
                                if (integrationHandle) {
                                    $integration.val(integrationHandle);
                                }
                                return;
                            }
                        }
                        
                        if (prompt) {
                            $promptText.val(prompt.promptText);
                            $promptText.prop('placeholder', '');
                            // updated prompt text
                            if (integrationHandle) {
                                $integration.val(integrationHandle);
                            }
                        } else {
                            // prompt not found
                            // Clear the text if prompt not found
                            $promptText.val('');
                            $promptText.prop('placeholder', '');
                        }
                    } else {
                        $promptText.val('');
                        $promptText.prop('placeholder', '');
                    }
                });

                // Return the prompts for external use
                return result.prompts;
            } else {
                $select.append('<option value="">No prompts available</option>');
                return [];
            }

        } catch (error) {
            $select.empty().append('<option value="">Failed to load prompts</option>');
            return [];
        }
    }

    async function generateText(params) {
        const { promptText, integrationHandle, fieldType } = params;
        
        try {
            
            const response = await fetch(Craft.getCpUrl('ai-assistant/api/generate-text'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-Token': Craft.csrfTokenValue
                },
                body: JSON.stringify({
                    promptText,
                    integration: integrationHandle,
                    fieldType
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`API Error: ${response.status} - ${text}`);
            }

            const result = await response.json();
            return result;
        } catch (error) {
            throw error;
        }
    }

    function setupGenerateHandler($btn, $promptText, $customPrompt, $integration, $customIntegration, $input, $btnInsert, $loading, field, $includeContext) {
        $btn.on('click', async function() {
            const promptText = $promptText.val();
            const integrationHandle = $integration.val();
            const inputContext = ($customPrompt && $customPrompt.length)
                ? ($customPrompt.hasClass('aiassistant-rich-editor') ? $customPrompt.html() : ($customPrompt.is('textarea, input') ? $customPrompt.val() : $customPrompt.text()))
                : '';
            let includeContext = true;
            if ($includeContext && $includeContext.length) {
                const $ls = $includeContext.closest('.lightswitch');
                if ($ls && $ls.length) {
                    includeContext = $ls.hasClass('on');
                } else if ($includeContext.is(':checkbox')) {
                    includeContext = $includeContext.is(':checked');
                } else {
                    const val = ($includeContext.val && $includeContext.val()) || '1';
                    includeContext = (val === '1' || val === 'true');
                }
            }
            
            if (!promptText || !integrationHandle) {
                Craft.cp.displayError('Please select a prompt and integration.');
                return;
            }

            // Build full prompt with optional input context
            let fullPrompt = promptText;
            if (includeContext && inputContext && inputContext.trim()) {
                fullPrompt += '\n\n' + inputContext.trim();
            }

            // Disable button and show loading
            $btn.prop('disabled', true);
            if ($loading && $loading.length) { 
                $loading.show(); 
            }

            try {
                const fieldType = getFieldType(getFieldInput(field).element);
                
                const result = await generateText({
                    promptText: fullPrompt,
                    integrationHandle,
                    fieldType
                });

                if (result.success) {
                    // Handle different response formats
                    const generatedText = result.data || result.content || result.text || '';
                    
                    // Check if this is a rich text editor comparison view
                    const isRichTextEditor = $input.hasClass('aiassistant-rich-editor');
                    
                    if (isRichTextEditor) {
                        // For rich text editors, display HTML content
                        $input.html(generatedText);
                    } else {
                        // For plain text fields, use val()
                        $input.val(generatedText);
                    }
                    
                    $btnInsert.prop('disabled', false);
                } else {
                    Craft.cp.displayError(result.message || result.error || 'Generation failed');
                }
            } catch (error) {
                Craft.cp.displayError('Failed to generate text');
            } finally {
                $btn.prop('disabled', false);
                if ($loading && $loading.length) { 
                    $loading.hide(); 
                }
            }
        });
    }

    function setupCancelHandler(modal) {
        const $cancelBtn = modal.$container.find('button.cancel');
        $cancelBtn.on('click', function() {
            modal.hide();
        });
    }

    function setupInsertHandler($btn, $input, modal, field) {
        $btn.on('click', function() {
            // Check if this is a rich text editor comparison view
            const isRichTextEditor = $input.hasClass('aiassistant-rich-editor');
            const generatedText = isRichTextEditor ? $input.html() : $input.val();
            
            const inputObj = getFieldInput(field);
            
            if (inputObj && inputObj.element) {
                // Use the setValue method which handles different editor types
                inputObj.setValue(generatedText);
                
                // Trigger change event for Craft to detect the change
                $(inputObj.element).trigger('change');
            }
            modal.hide();
        });
    }

    async function openGenerateModal(field) {
        // Get field type from the injected AI Assistant field tag
        const fieldTag = field.querySelector('.ai-assistant-field');
        const fieldType = fieldTag ? fieldTag.dataset.fieldType : 'craft\\fields\\PlainText';
        
        // Handle Assets fields differently
        if (fieldType === 'craft\\fields\\Assets') {
            await openImageGenerationModal(field);
            return;
        }

        try {
            const modalHtml = await fetchModalHtml();
            const modal = createModal(modalHtml);

            // Wait for modal to be fully initialized before accessing elements
            const initializeModalElements = () => {
                try {
                    // Use the DOM element directly since we know it exists
                    const modalElement = document.querySelector('.modal:last-of-type');
                    if (!modalElement) {
                        setTimeout(initializeModalElements, 50);
                        return;
                    }

                    const $body = $(modalElement).find('.body');
                    if (!$body || !$body.length) {
                        setTimeout(initializeModalElements, 50);
                        return;
                    }

                    // Modal body found, proceeding with initialization

                    // Initialize Craft UI elements inside modal (lightswitch, etc.)
                    try {
                        if (typeof Craft.initUiElements === 'function') {
                            Craft.initUiElements($body);
                        }
                    } catch (e) {
                        // ignore
                    }

                    // Inject AI Assistant icon into modal header
                    injectModalIcon(modalElement);

                    // Get modal elements (matching the actual template structure)
                    const $integrationSelect = $body.find('select[name="aiassistant-text-integration"]');
                    const $promptSelect = $body.find('select[name="aiassistant-text-prompt"]');
                    const $promptText = $body.find('textarea[name="aiassistant-text-prompt-text"]');
                    const $btnGenerate = modal.$container.find('button#aiassistant-text-generate');
                    const $btnInsert = modal.$container.find('button#aiassistant-text-insert');
                    const $loading = modal.$container.find('#aiassistant-text-loading');

                    // Always use comparison layout (input left, output right)
                    const inputObj = getFieldInput(field);
                    const fieldType = inputObj ? inputObj.type : 'input';

                    const $comparisonSection = $body.find('#aiassistant-text-comparison');
                    const $fallbackInput = $body.find('#aiassistant-text-input-fallback');
                    const $fallbackGenerated = $body.find('#aiassistant-text-generated-fallback');

                    $comparisonSection.show();
                    $fallbackInput.hide();
                    $fallbackGenerated.hide();

                    // Initialize rich text editors (or HTML displays) for both rich and plain text
                    initializeRichTextEditors(fieldType, field, $comparisonSection);

                    // Get the appropriate input elements based on field type
                    const $inputContext = $comparisonSection.find('#aiassistant-text-input-rich');
                    const $includeContext = $body.find('#aiassistant-include-context');
                    const $input = $comparisonSection.find('#aiassistant-text-generated-rich');

                    // elements available

                    // Load data and set up handlers
                    Promise.all([
                        loadIntegrations($integrationSelect),
                        loadPrompts($promptSelect, $promptText, $integrationSelect)
                    ]).then(([integrations, prompts]) => {
                        // Ensure lightswitch is initialized by Craft/Garnish
                        if ($includeContext && $includeContext.length) {
                            const $lsContainer = $includeContext.closest('.lightswitch');
                            if ($lsContainer && $lsContainer.length && !$lsContainer.data('lightswitch')) {
                                try { new Garnish.LightSwitch($lsContainer); } catch (e) { /* noop */ }
                            }
                        }
                        // Select first prompt by default
                        if (prompts && prompts.length > 0) {
                            const firstPrompt = prompts[0];
                            $promptSelect.val(firstPrompt.id).trigger('change');
                        }

                        // Populate input context with current field value
                        const inputObj = getFieldInput(field);
                        if (inputObj && inputObj.element) {
                            const currentValue = (typeof inputObj.value === 'function')
                                ? inputObj.value()
                                : (inputObj.element.value || '');
                            if (currentValue) {
                                if ($inputContext.hasClass('aiassistant-rich-editor')) {
                                    $inputContext.html(currentValue);
                                } else {
                                    $inputContext.val(currentValue);
                                }
                            }
                        }

                        // Only set up handlers if buttons exist
                        if ($btnGenerate.length > 0 && $btnInsert.length > 0) {
                            setupGenerateHandler(
                                $btnGenerate, $promptText, $inputContext, 
                                $integrationSelect, $integrationSelect, 
                                $input, $btnInsert, $loading, field, $includeContext
                            );

                            setupInsertHandler($btnInsert, $input, modal, field);
                            setupCancelHandler(modal);
                        } else {
                            // ignore
                        }
                    }).catch(error => {
                        Craft.cp.displayError('Failed to load modal data');
                    });

                } catch (error) {
                    Craft.cp.displayError('Failed to initialize modal');
                }
            };

            // Start initialization with a small delay
            setTimeout(initializeModalElements, 100);

        } catch (error) {
            Craft.cp.displayError('Failed to load modal');
        }
    }

    async function openImageGenerationModal(field) {
        // Placeholder for image generation functionality
        Craft.cp.displayNotice('Image generation feature coming soon!');
    }

    // Expose functions globally
    window.AiAssistantModal = {
        openGenerateModal,
        openImageGenerationModal,
        getFieldInput,
        getFieldHandle,
        getFieldType,
        fetchModalHtml,
        createModal
    };

})();
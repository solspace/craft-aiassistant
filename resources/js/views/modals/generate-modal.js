/**
 * Generate Modal View
 * Handles the main AI generation modal
 */

import { getFieldInput, getFieldHandle, getFieldType } from '../../utils/field.js';
import { createModal, injectModalIcon } from '../../components/modal.js';
import { renderImageSlider } from '../../components/image-slider.js';
import { fetchModalHtml, loadIntegrations, loadPrompts, generateText, generateImage, saveImageToAssets } from '../../services/api.js';

/**
 * Open generate modal for a field - full implementation
 */
export async function openGenerateModal(field) {
    // Get field type from the injected AI Assistant field tag
    const fieldTag = field.querySelector('.ai-assistant-field');
    const fieldType = fieldTag ? fieldTag.dataset.fieldType : 'craft\\fields\\PlainText';
    
    try {
        const modalHtml = await fetchModalHtml(Craft.getCpUrl('ai-assistant/ui/generate-text-modal'));
        const modal = createModal(modalHtml);

        // Wait for modal to be fully initialized before accessing elements
        const initializeModalElements = () => {
            try {
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

                // Initialize Craft UI elements inside modal
                try {
                    if (typeof Craft.initUiElements === 'function') {
                        Craft.initUiElements($body);
                    }
                } catch (e) {
                    // ignore
                }

                // Inject AI Assistant icon into modal header
                injectModalIcon(modalElement);

                // Get modal elements
                const $integrationSelect = $body.find('select[name="aiassistant-text-integration"]');
                const $promptSelect = $body.find('select[name="aiassistant-text-prompt"]');
                const $promptText = $body.find('textarea[name="aiassistant-text-prompt-text"]');
                const $btnGenerate = modal.$container.find('button#aiassistant-text-generate');
                const $btnInsert = modal.$container.find('button#aiassistant-text-insert');
                const $loading = modal.$container.find('#aiassistant-text-loading');
                const $imageOptions = $body.find('#aiassistant-image-options');
                const $imageCol = $body.find('#aiassistant-image-col');
                const $promptLeft = $body.find('#aiassistant-prompt-left');
                const $imageSize = $body.find('#aiassistant-image-size');
                const $imageCount = $body.find('#aiassistant-image-count');
                const $assetTarget = $body.find('#aiassistant-asset-target');
                const $imagePreviewRight = $body.find('#aiassistant-image-preview-right');

                // Always use comparison layout
                const inputObj = getFieldInput(field);
                const fieldType = inputObj ? inputObj.type : 'input';

                const $comparisonSection = $body.find('#aiassistant-text-comparison');
                const $fallbackInput = $body.find('#aiassistant-text-input-fallback');
                const $fallbackGenerated = $body.find('#aiassistant-text-generated-fallback');

                $comparisonSection.show();
                $fallbackInput.hide();
                $fallbackGenerated.hide();
                $imageOptions.hide();
                if ($imageCol.length) { $imageCol.hide(); }

                // Initialize rich text editors
                initializeRichTextEditors(fieldType, field, $comparisonSection);

                const $inputContext = $comparisonSection.find('#aiassistant-text-input-rich');
                const $includeContext = $body.find('#aiassistant-include-context');
                const $input = $comparisonSection.find('#aiassistant-text-generated-rich');

                // Get field handle and field-specific prompt ID
                const fieldHandle = getFieldHandle(field);
                let fieldSpecificPromptId = '';
                
                const fieldTag = field.querySelector('.ai-assistant-field');
                if (fieldTag && fieldTag.dataset.fieldPrompt) {
                    fieldSpecificPromptId = fieldTag.dataset.fieldPrompt;
                }
                
                if (!fieldSpecificPromptId && fieldHandle) {
                    const $hiddenInput = $(document).find(`input[name="settings[fieldPrompts][${fieldHandle}]"]`);
                    if ($hiddenInput.length && $hiddenInput.val()) {
                        fieldSpecificPromptId = $hiddenInput.val();
                    }
                }

                if (!fieldSpecificPromptId && fieldHandle && window.aiAssistantSettings && window.aiAssistantSettings.fieldPrompts) {
                    const fromSettings = window.aiAssistantSettings.fieldPrompts[fieldHandle];
                    if (fromSettings) {
                        fieldSpecificPromptId = fromSettings;
                    }
                }

                // Load data and set up handlers
                Promise.all([
                    loadIntegrations(),
                    loadPrompts()
                ]).then(([integrations, prompts]) => {
                    // Populate integrations
                    $integrationSelect.empty();
                    if (integrations && integrations.length) {
                        integrations.forEach(integration => {
                            $integrationSelect.append(
                                `<option value="${integration.handle}">${integration.name}</option>`
                            );
                        });
                    }

                    // Populate prompts
                    $promptSelect.empty();
                    if (prompts && prompts.length) {
                        prompts.forEach(prompt => {
                            const safeText = (prompt.promptText || '').replace(/"/g, '&quot;');
                            $promptSelect.append(
                                `<option value="${prompt.id}" data-integration="${prompt.integrationHandle || ''}" data-type="${prompt.type || ''}" data-prompt-text="${safeText}">${prompt.name}</option>`
                            );
                        });
                        $promptSelect.append('<option value="custom">Custom…</option>');
                    }

                    // Ensure lightswitch is initialized
                    if ($includeContext && $includeContext.length) {
                        const $lsContainer = $includeContext.closest('.lightswitch');
                        if ($lsContainer && $lsContainer.length && !$lsContainer.data('lightswitch')) {
                            try { new Garnish.LightSwitch($lsContainer); } catch (e) { /* noop */ }
                        }
                    }
                    
                    // Select field-specific prompt if available
                    if (fieldSpecificPromptId && $promptSelect.find(`option[value="${fieldSpecificPromptId}"]`).length > 0) {
                        $promptSelect.val(fieldSpecificPromptId).trigger('change');
                    } else if (prompts && prompts.length > 0) {
                        const firstPrompt = prompts[0];
                        $promptSelect.val(firstPrompt.id).trigger('change');
                    }

                    // Populate input context with current field value
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

                    // Toggle image vs text mode, and wire handlers accordingly
                    function toggleImageMode(type) {
                        if ((type || '').toLowerCase() === 'image') {
                            if ($imageCol.length) { 
                                $imageCol.show(); 
                                $imageCol.css({ flex: '0 0 49%', maxWidth: '49%' });
                            }
                            $imageOptions.show();
                            if ($promptLeft.length) {
                                $promptLeft.css({ flex: '0 0 49%', maxWidth: '49%' });
                            }
                            $comparisonSection.show();
                            // Switch right panel to image preview mode
                            const $genTitle = $body.find('#aiassistant-generated-title');
                            const $genInstr = $body.find('#aiassistant-generated-instructions');
                            const $genText = $body.find('#aiassistant-text-generated-rich');
                            const $imgPrevRight = $body.find('#aiassistant-image-preview-right');
                            if ($genTitle.length) $genTitle.text('Generated Image');
                            if ($genInstr.length) $genInstr.text('Preview the generated image(s). Click Save to persist to Assets.');
                            $genText.hide();
                            renderImageSlider($imgPrevRight, []);
                            $btnInsert.data('previewUrls', []);
                            // Change Insert button label to Save
                            $btnInsert.text('Save').prop('disabled', true);
                            // Rewire generate for image (dry-run)
                            $btnGenerate.off('click').on('click', async function() {
                                const payload = {
                                    prompt: $promptText.val(),
                                    integration: $integrationSelect.val(),
                                    count: parseInt(($imageCount.val() || '1'), 10),
                                    assetTarget: (function() {
                                        if ($assetTarget && $assetTarget.length && $assetTarget.val()) {
                                            return $assetTarget.val();
                                        }
                                        const selId = String($promptSelect.val());
                                        const p = (prompts || []).find(pp => String(pp.id) === selId);
                                        return p && p.assetTarget ? p.assetTarget : undefined;
                                    })(),
                                    options: {},
                                    dryRun: true
                                };
                                const sizeVal = ($imageSize.val() || '').trim();
                                if (sizeVal) {
                                    payload.size = sizeVal;
                                }
                                // Include input context if requested
                                const includeContext = (() => {
                                    if (!$includeContext || !$includeContext.length) {
                                        return true;
                                    }
                                    const $ls = $includeContext.closest('.lightswitch');
                                    if ($ls && $ls.length) {
                                        return $ls.hasClass('on');
                                    }
                                    if ($includeContext.is(':checkbox')) {
                                        return $includeContext.is(':checked');
                                    }
                                    const val = ($includeContext.val && $includeContext.val()) || '1';
                                    return val === '1' || val === 'true';
                                })();
                                const contextValue = (() => {
                                    if (!$inputContext || !$inputContext.length) {
                                        return '';
                                    }
                                    if ($inputContext.hasClass('aiassistant-rich-editor')) {
                                        return ($inputContext.text() || '').trim();
                                    }
                                    if ($inputContext.is('textarea, input')) {
                                        return ($inputContext.val() || '').trim();
                                    }
                                    return ($inputContext.text() || '').trim();
                                })();
                                if (includeContext && contextValue) {
                                    payload.prompt = `${payload.prompt}\n\n${contextValue}`;
                                }
                                if (!payload.prompt) {
                                    Craft.cp.displayError('Prompt is required');
                                    return;
                                }
                                $btnGenerate.prop('disabled', true);
                                $loading.show();
                                renderImageSlider($imgPrevRight, []);
                                try {
                                    const result = await generateImage(payload);
                                    if (!result.success) {
                                        Craft.cp.displayError(result.error || 'Failed to generate image');
                                        return;
                                    }
                                    const previews = result.previewUrls || [];
                                    renderImageSlider($imgPrevRight, previews);
                                    $btnInsert.data('previewUrls', previews);
                                    // Save handler persists images
                                    if (previews.length > 0) {
                                        $btnInsert.prop('disabled', false);
                                        $btnInsert.off('click').on('click', async function() {
                                            $btnInsert.prop('disabled', true);
                                            $loading.show();
                                            try {
                                                const saveResult = await saveImageToAssets(
                                                    previews,
                                                    (function() {
                                                        if ($assetTarget && $assetTarget.length && $assetTarget.val()) {
                                                            return $assetTarget.val();
                                                        }
                                                        const selId = String($promptSelect.val());
                                                        const p = (prompts || []).find(pp => String(pp.id) === selId);
                                                        return p && p.assetTarget ? p.assetTarget : undefined;
                                                    })(),
                                                    ($promptText.val() || '').slice(0, 60)
                                                );
                                                if (!saveResult.success) {
                                                    Craft.cp.displayError(saveResult.error || 'Failed to save image(s)');
                                                    return;
                                                }
                                                const createdAssets = saveResult.assets || [];
                                                const inputObj2 = getFieldInput(field);
                                                if (inputObj2 && inputObj2.type === 'assets') {
                                                    const hidden = field.querySelector('input[type="hidden"]');
                                                    if (hidden) {
                                                        hidden.value = createdAssets.map(a => a.id).join(',');
                                                        $(hidden).trigger('change');
                                                    }
                                                }
                                                modal.hide();
                                            } catch(e) {
                                                Craft.cp.displayError('Failed to save image(s)');
                                            } finally {
                                                $btnInsert.prop('disabled', false);
                                                $loading.hide();
                                            }
                                        });
                                    } else {
                                        renderImageSlider($imgPrevRight, []);
                                        $btnInsert.prop('disabled', true);
                                        $btnInsert.data('previewUrls', []);
                                    }
                                } catch (e) {
                                    Craft.cp.displayError('Failed to generate image');
                                } finally {
                                    $btnGenerate.prop('disabled', false);
                                    $loading.hide();
                                }
                            });
                        } else {
                            $imageOptions.hide();
                            if ($imageCol.length) { 
                                $imageCol.hide(); 
                                $imageCol.css({ flex: '', maxWidth: '' });
                            }
                            if ($promptLeft.length) {
                                $promptLeft.css({ flex: '0 0 100%', maxWidth: '100%' });
                            }
                            $comparisonSection.show();
                            // Rewire handlers back to text generation
                            $btnInsert.prop('disabled', true);
                            $btnInsert.text('Insert');
                            $btnGenerate.off('click');
                            $btnInsert.off('click');
                            setupGenerateHandler(
                                $btnGenerate, $promptText, $inputContext,
                                $integrationSelect, $input, $btnInsert, $loading, field, $includeContext
                            );
                            // Reset right panel
                            const $genText = $body.find('#aiassistant-text-generated-rich');
                            const $imgPrevRight = $body.find('#aiassistant-image-preview-right');
                            $genText.show();
                            renderImageSlider($imgPrevRight, []);
                            setupInsertHandler($btnInsert, $input, modal, field);
                        }
                    }

                    // Only set up handlers if buttons exist
                    if ($btnGenerate.length > 0 && $btnInsert.length > 0) {
                        setupGenerateHandler(
                            $btnGenerate, $promptText, $inputContext, 
                            $integrationSelect, $input, $btnInsert, $loading, field, $includeContext
                        );

                        setupInsertHandler($btnInsert, $input, modal, field);
                        setupCancelHandler(modal);
                    }

                    // Toggle image mode when prompt changes and prefill image defaults
                    $promptSelect.on('change', function() {
                        const opt = $(this).find('option:selected');
                        const type = opt.data('type') || '';
                        toggleImageMode(type);
                        if ((type || '').toLowerCase() === 'image') {
                            const selId = String($(this).val());
                            const p = (prompts || []).find(pp => String(pp.id) === selId);
                            if (p) {
                                if (p.imageSize && $imageSize.length) $imageSize.val(p.imageSize);
                                if (p.imageCount && $imageCount.length) $imageCount.val(p.imageCount);
                                if (p.assetTarget && $assetTarget.length) {
                                    if ($assetTarget.find(`option[value="${p.assetTarget}"]`).length) {
                                        $assetTarget.val(p.assetTarget);
                                    }
                                }
                            }
                        }
                    });
                    // Initial toggle
                    const initOpt = $promptSelect.find('option:selected');
                    if (initOpt && initOpt.length) {
                        toggleImageMode(initOpt.data('type') || '');
                    }
                }).catch(error => {
                    Craft.cp.displayError('Failed to load modal data');
                });

            } catch (error) {
                Craft.cp.displayError('Failed to initialize modal');
            }
        };

        setTimeout(initializeModalElements, 100);

    } catch (error) {
        Craft.cp.displayError('Failed to load modal');
    }
}

function initializeRichTextEditors(fieldType, field, $comparisonSection) {
    const $inputRich = $comparisonSection.find('#aiassistant-text-input-rich');
    const $generatedRich = $comparisonSection.find('#aiassistant-text-generated-rich');
    
    const inputObj = getFieldInput(field);
    const currentContent = inputObj ? inputObj.value() : '';
    
    $inputRich.html(currentContent);
    $inputRich.addClass('aiassistant-html-display');
    $generatedRich.addClass('aiassistant-html-display');
}

function setupGenerateHandler($btn, $promptText, $inputContext, $integrationSelect, $input, $btnInsert, $loading, field, $includeContext) {
    $btn.on('click', async function() {
        const promptText = $promptText.val();
        const integrationHandle = $integrationSelect.val();
        const inputContext = ($inputContext && $inputContext.length)
            ? ($inputContext.hasClass('aiassistant-rich-editor') ? $inputContext.html() : ($inputContext.is('textarea, input') ? $inputContext.val() : $inputContext.text()))
            : '';
        let includeContext = true;
        if ($includeContext && $includeContext.length) {
            const $ls = $includeContext.closest('.lightswitch');
            if ($ls && $ls.length) {
                includeContext = $ls.hasClass('on');
            } else if ($includeContext.is(':checkbox')) {
                includeContext = $includeContext.is(':checked');
            }
        }
        
        if (!promptText || !integrationHandle) {
            Craft.cp.displayError('Please select a prompt and integration.');
            return;
        }

        let fullPrompt = promptText;
        if (includeContext && inputContext && inputContext.trim()) {
            fullPrompt += '\n\n' + inputContext.trim();
        }

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
                const generatedText = result.data || result.content || result.text || '';
                
                const isRichTextEditor = $input.hasClass('aiassistant-rich-editor');
                
                if (isRichTextEditor) {
                    $input.html(generatedText);
                } else {
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

function setupInsertHandler($btn, $input, modal, field) {
    $btn.on('click', function() {
        const isRichTextEditor = $input.hasClass('aiassistant-rich-editor');
        const generatedText = isRichTextEditor ? $input.html() : $input.val();
        
        const inputObj = getFieldInput(field);
        
        if (inputObj && inputObj.element) {
            inputObj.setValue(generatedText);
            $(inputObj.element).trigger('change');
        }
        modal.hide();
    });
}

function setupCancelHandler(modal) {
    const $cancelBtn = modal.$container.find('button.cancel');
    $cancelBtn.on('click', function() {
        modal.hide();
    });
}


/**
 * Open from asset modal - full implementation
 */
export async function openFromAssetModal(assetId, assetUrl) {
    try {
        const modalHtml = await fetchModalHtml(Craft.getCpUrl('ai-assistant/ui/generate-from-asset-modal'));
        const modal = createModal(modalHtml);

        // Wait for modal to be fully initialized
        const initializeModalElements = () => {
            try {
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

                // Initialize Craft UI elements
                try {
                    if (typeof Craft.initUiElements === 'function') {
                        Craft.initUiElements($body);
                    }
                } catch (e) {
                    // ignore
                }

                // Inject AI Assistant icon into modal header
                injectModalIcon(modalElement);

                // Get modal elements
                const $integrationSelect = $body.find('select[name="aiassistant-text-integration"]');
                const $promptSelect = $body.find('select[name="aiassistant-text-prompt"]');
                const $promptText = $body.find('textarea[name="aiassistant-text-prompt-text"]');
                const $btnGenerate = modal.$container.find('button#aiassistant-text-generate');
                const $btnSave = modal.$container.find('button#aiassistant-text-insert');
                const $loading = modal.$container.find('#aiassistant-text-loading');
                const $imageOptions = $body.find('#aiassistant-image-options');
                const $imageCol = $body.find('#aiassistant-image-col');
                const $promptLeft = $body.find('#aiassistant-prompt-left');
                const $keepOriginalSize = $body.find('#aiassistant-keep-original-size');
                const $imageSize = $body.find('#aiassistant-image-size');
                const $sizeFieldWrap = $body.find('#aiassistant-size-field-wrap');
                const $imageCount = $body.find('#aiassistant-image-count');
                const $assetTarget = $body.find('#aiassistant-asset-target');
                const $assetPreview = $body.find('#aiassistant-asset-preview');
                const $imagePreviewRight = $body.find('#aiassistant-image-preview-right');
                const $generatedText = $body.find('#aiassistant-text-generated-rich');

                // Display the asset image
                if ($assetPreview.length) {
                    const containerHeight = $assetPreview.outerHeight();
                    const padding = 20;
                    const maxImageHeight = Math.max(containerHeight - padding, 240);
                    const imageStyle = 'max-height:' + maxImageHeight + 'px; width:auto; border-radius:4px; object-fit:contain; display:block;';
                    
                    if (assetUrl) {
                        $assetPreview.html('<img src="' + assetUrl + '" style="' + imageStyle + '" alt="Asset preview" />');
                    } else if (assetId) {
                        fetch(Craft.getCpUrl('ai-assistant/api/get-asset-url', { assetId: assetId }), {
                            headers: { 'Accept': 'application/json' }
                        })
                            .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to fetch')))
                            .then(data => {
                                if (data.success && data.url) {
                                    $assetPreview.html('<img src="' + data.url + '" style="' + imageStyle + '" alt="Asset preview" />');
                                } else {
                                    const streamUrl = Craft.getCpUrl('ai-assistant/api/stream-asset', { assetId: assetId });
                                    $assetPreview.html('<img src="' + streamUrl + '" style="' + imageStyle + '" alt="Asset preview" />');
                                }
                            })
                            .catch(() => {
                                const streamUrl = Craft.getCpUrl('ai-assistant/api/stream-asset', { assetId: assetId });
                                $assetPreview.html('<img src="' + streamUrl + '" style="' + imageStyle + '" alt="Asset preview" />');
                            });
                    } else {
                        $assetPreview.html('<div style="color:#9ca3af; padding:20px; text-align:center;">No asset selected</div>');
                    }
                }

                // Hide image options initially
                $imageOptions.hide();
                if ($imageCol.length) { $imageCol.hide(); }

                // Toggle size input state based on Keep original size (lightswitch)
                if ($keepOriginalSize.length) {
                    const $lightswitchContainer = $keepOriginalSize.closest('.lightswitch');
                    const $sizeInstructions = $sizeFieldWrap.find('.instructions');
                    
                    if ($lightswitchContainer.length && !$lightswitchContainer.data('lightswitch')) {
                        try {
                            new Garnish.LightSwitch($lightswitchContainer);
                        } catch (e) {
                            // ignore
                        }
                    }
                    
                    const syncKeepOriginal = () => {
                        const keep = $lightswitchContainer.length && $lightswitchContainer.hasClass('on');
                        
                        if ($sizeFieldWrap && $sizeFieldWrap.length) {
                            $sizeFieldWrap.show();
                            
                            if (keep) {
                                $imageSize.hide();
                                if ($sizeInstructions.length) {
                                    $sizeInstructions.text('Keep original size (recommended).');
                                }
                            } else {
                                $imageSize.show().prop('disabled', false);
                                if ($sizeInstructions.length) {
                                    $sizeInstructions.text('WidthxHeight, e.g., 1024x1024.');
                                }
                            }
                        }
                    };
                    
                    if ($lightswitchContainer.length) {
                        $lightswitchContainer.on('change', syncKeepOriginal);
                    } else {
                        $keepOriginalSize.on('change', syncKeepOriginal);
                    }
                    syncKeepOriginal();
                }

                // Load data and set up handlers
                Promise.all([
                    loadIntegrations(),
                    loadPrompts('image')
                ]).then(([integrations, prompts]) => {
                    // Populate integrations
                    $integrationSelect.empty();
                    if (integrations && integrations.length) {
                        integrations.forEach(integration => {
                            $integrationSelect.append(`<option value="${integration.handle}">${integration.name}</option>`);
                        });
                    }

                    // Populate prompts
                    $promptSelect.empty();
                    if (prompts && prompts.length) {
                        prompts.forEach(prompt => {
                            const safeText = (prompt.promptText || '').replace(/"/g, '&quot;');
                            $promptSelect.append(
                                `<option value="${prompt.id}" data-integration="${prompt.integrationHandle || ''}" data-type="${prompt.type || ''}" data-prompt-text="${safeText}">${prompt.name}</option>`
                            );
                        });
                        $promptSelect.append('<option value="custom">Custom…</option>');
                    }

                    // Helper: prefill UI from selected prompt
                    function prefillFromPrompt(p) {
                        if (!p) return;
                        if ($keepOriginalSize.length && $imageSize.length) {
                            const $lightswitchContainer = $keepOriginalSize.closest('.lightswitch');
                            if (p.imageSize && String(p.imageSize).trim()) {
                                if ($lightswitchContainer.length && $lightswitchContainer.hasClass('on')) {
                                    $lightswitchContainer.trigger('click');
                                }
                                $imageSize.val(p.imageSize);
                            } else {
                                if ($lightswitchContainer.length && !$lightswitchContainer.hasClass('on')) {
                                    $lightswitchContainer.trigger('click');
                                }
                            }
                            if ($lightswitchContainer.length) {
                                $lightswitchContainer.trigger('change');
                            }
                        }
                        if ($imageCount.length && p.imageCount !== undefined && p.imageCount !== null && String(p.imageCount).trim() !== '') {
                            $imageCount.val(p.imageCount);
                        }
                        if ($assetTarget.length && p.assetTarget) {
                            if ($assetTarget.find(`option[value="${p.assetTarget}"]`).length) {
                                $assetTarget.val(p.assetTarget);
                            }
                        }
                        if ($integrationSelect.length && p.integrationHandle) {
                            if ($integrationSelect.find(`option[value="${p.integrationHandle}"]`).length) {
                                $integrationSelect.val(p.integrationHandle);
                            }
                        }
                    }

                    // Default to "Generate Image" prompt if available
                    const generateImagePrompt = prompts.find(p => p.name === 'Generate Image' || p.type === 'image');
                    if (generateImagePrompt) {
                        $promptSelect.val(generateImagePrompt.id).trigger('change');
                        prefillFromPrompt(generateImagePrompt);
                    } else if (prompts && prompts.length > 0) {
                        const imagePrompt = prompts.find(p => p.type === 'image');
                        const selected = imagePrompt || prompts[0];
                        $promptSelect.val(selected.id).trigger('change');
                        prefillFromPrompt(selected);
                    }

                    // Toggle image vs text mode
                    function toggleImageMode(type) {
                        if ((type || '').toLowerCase() === 'image') {
                            if ($imageCol.length) {
                                $imageCol.show();
                                $imageCol.css({ flex: '0 0 49%', maxWidth: '49%' });
                            }
                            if ($promptLeft.length) {
                                $promptLeft.css({ flex: '0 0 49%', maxWidth: '49%' });
                            }
                            $imageOptions.show();
                            $btnSave.text('Save').prop('disabled', true);
                            $generatedText.hide();
                            renderImageSlider($imagePreviewRight, []);
                        } else {
                            $imageOptions.hide();
                            if ($imageCol.length) {
                                $imageCol.hide();
                                $imageCol.css({ flex: '', maxWidth: '' });
                            }
                            if ($promptLeft.length) {
                                $promptLeft.css({ flex: '0 0 100%', maxWidth: '100%' });
                            }
                            $btnSave.text('Insert').prop('disabled', true);
                            $generatedText.show();
                            renderImageSlider($imagePreviewRight, []);
                            $btnSave.data('previewUrls', []);
                        }
                    }

                    // Set up generate handler for asset context
                    function setupAssetGenerateHandler() {
                        $btnGenerate.off('click').on('click', async function() {
                            const prompt = $promptText.val() || '';
                            const integrationHandle = $integrationSelect.val() || 'openai';
                            const selectedPrompt = prompts.find(p => String(p.id) === $promptSelect.val());
                            const promptType = selectedPrompt?.type || '';
                            const selectedVal = String($promptSelect.val() || '');
                            const isImageMode = ((promptType || '').toLowerCase() === 'image') || (selectedVal === 'custom');

                            if (!prompt) {
                                Craft.cp.displayError('Please enter a prompt');
                                return;
                            }

                            $btnGenerate.prop('disabled', true);
                            $loading.show();

                            try {
                                if (isImageMode) {
                                    const assetTarget = $assetTarget.val() || '';
                                    const payload = {
                                        prompt: prompt,
                                        integration: integrationHandle,
                                        assetTarget: assetTarget,
                                        dryRun: true,
                                        assetId: assetId,
                                        assetUrl: assetUrl
                                    };
                                    
                                    if ($keepOriginalSize && $keepOriginalSize.length) {
                                        const $lightswitchContainer = $keepOriginalSize.closest('.lightswitch');
                                        const keepOriginal = $lightswitchContainer.length && $lightswitchContainer.hasClass('on');
                                        if (!keepOriginal) {
                                            const sz = ($imageSize.val() || '').trim();
                                            if (sz) payload.size = sz;
                                        }
                                    } else {
                                        const sz = ($imageSize.val() || '').trim();
                                        if (sz) payload.size = sz;
                                    }
                                    
                                    if ($imageCount.length) {
                                        const cnt = parseInt(($imageCount.val() || '1'), 10);
                                        if (!isNaN(cnt) && cnt > 0) payload.count = cnt;
                                    }

                                    renderImageSlider($imagePreviewRight, []);

                                    const result = await generateImage(payload);
                                    if (result.success && Array.isArray(result.previewUrls) && result.previewUrls.length) {
                                        const previews = result.previewUrls;
                                        renderImageSlider($imagePreviewRight, previews);
                                        $btnSave.prop('disabled', false).data('previewUrls', previews);
                                        $imagePreviewRight.off('click.sliderSave').on('click.sliderSave', '.aiassistant-image-slider-img', function() {
                                            const urls = $imagePreviewRight.data('sliderUrls') || [];
                                            const currentIndex = $imagePreviewRight.data('sliderIndex') || 0;
                                            const currentUrl = urls[currentIndex];
                                            if (currentUrl) {
                                                saveImageToAssets([currentUrl], assetTarget, prompt);
                                            }
                                        });
                                    } else {
                                        renderImageSlider($imagePreviewRight, []);
                                        $btnSave.data('previewUrls', []);
                                        Craft.cp.displayError(result.error || 'Failed to generate image');
                                    }
                                } else {
                                    const result = await generateText({
                                        promptText: prompt,
                                        integrationHandle,
                                        assetId,
                                        assetUrl
                                    });

                                    if (result.success && result.text) {
                                        $generatedText.html(result.text).show();
                                        renderImageSlider($imagePreviewRight, []);
                                        $btnSave.data('previewUrls', []);
                                        $btnSave.prop('disabled', false);
                                    } else {
                                        Craft.cp.displayError(result.error || 'Failed to generate text');
                                    }
                                }
                            } catch (error) {
                                Craft.cp.displayError('Generation failed: ' + error.message);
                            } finally {
                                $btnGenerate.prop('disabled', false);
                                $loading.hide();
                            }
                        });
                    }

                    // Set up save handler
                    function setupAssetSaveHandler() {
                        $btnSave.off('click').on('click', function() {
                            const selectedPrompt = prompts.find(p => String(p.id) === $promptSelect.val());
                            const promptType = selectedPrompt?.type || '';

                            if ((promptType || '').toLowerCase() === 'image') {
                                const previewUrls = $btnSave.data('previewUrls') || [];
                                const assetTarget = $assetTarget.val() || '';
                                const prompt = $promptText.val() || '';
                                if (previewUrls.length > 0) {
                                    saveImageToAssets(previewUrls, assetTarget, prompt).then(result => {
                                        if (result.success) {
                                            Craft.cp.displayNotice('Images saved successfully');
                                            modal.hide();
                                            if (typeof Craft.elementIndex !== 'undefined') {
                                                Craft.elementIndex.updateElements();
                                            }
                                        }
                                    });
                                }
                            } else {
                                modal.hide();
                            }
                        });
                    }

                    // Set up handlers
                    setupAssetGenerateHandler();
                    setupAssetSaveHandler();
                    setupCancelHandler(modal);

                    // Toggle image mode when prompt changes
                    $promptSelect.on('change', function() {
                        const opt = $(this).find('option:selected');
                        const selVal = String($(this).val() || '');
                        const type = opt.data('type') || '';
                        const isImage = ((type || '').toLowerCase() === 'image') || (selVal === 'custom');
                        toggleImageMode(isImage ? 'image' : type);
                        if (isImage) {
                            const p = prompts.find(pp => String(pp.id) === selVal);
                            if (p) {
                                prefillFromPrompt(p);
                            }
                        }
                    });

                    // Initial toggle
                    const initOpt = $promptSelect.find('option:selected');
                    if (initOpt && initOpt.length) {
                        const initVal = String($promptSelect.val() || '');
                        const initType = initOpt.data('type') || '';
                        const isImageInit = ((initType || '').toLowerCase() === 'image') || (initVal === 'custom');
                        toggleImageMode(isImageInit ? 'image' : initType);
                    }
                }).catch(error => {
                    Craft.cp.displayError('Failed to load modal data');
                });
            } catch (error) {
                Craft.cp.displayError('Failed to initialize modal');
            }
        };

        setTimeout(initializeModalElements, 100);
    } catch (error) {
        Craft.cp.displayError('Failed to load modal');
    }
}


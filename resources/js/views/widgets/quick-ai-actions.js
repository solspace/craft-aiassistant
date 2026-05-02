/**
 * Quick AI Actions Widget
 * Handles the dashboard widget for generating AI content
 */

(function() {
    'use strict';

    // ============================================================================
    // DOM Element Selectors
    // ============================================================================

    const SELECTORS = {
        generateBtn: 'aiassistant-widget-generate',
        copyBtn: 'aiassistant-widget-copy',
        saveBtn: 'aiassistant-widget-save',
        outputField: 'aiassistant-widget-output',
        outputFieldWrap: 'aiassistant-widget-output-field',
        loadingSpinner: 'aiassistant-widget-loading',
        promptSelect: 'aiassistant-widget-prompt',
        integrationSelect: 'aiassistant-widget-integration',
        promptTextField: 'aiassistant-widget-prompt-text',
        imageOptions: 'aiassistant-widget-image-options',
        imageSizeInput: 'aiassistant-widget-image-size',
        imageCountInput: 'aiassistant-widget-image-count',
        assetTargetSelect: 'aiassistant-widget-asset-target',
        imagePreview: 'aiassistant-widget-image-preview',
        sliderImg: '.aiassistant-image-slider-img',
        sliderPrev: '.aiassistant-image-slider-button.prev',
        sliderNext: '.aiassistant-image-slider-button.next',
        sliderCounter: '.aiassistant-image-slider-counter',
        sliderPlaceholder: '.aiassistant-image-slider-placeholder',
    };

    // ============================================================================
    // State Management
    // ============================================================================

    let currentPreviewUrls = [];
    let currentSliderIndex = 0;
    let integrationTypeMap = {}; // Map of integration handles to types

    // ============================================================================
    // DOM Element References
    // ============================================================================

    /**
     * Get all DOM elements for the widget
     * @returns {Object|null} Object with element references or null if widget not found
     */
    function getWidgetElements() {
        const widget = document.querySelector('.aiassistant-widget');
        if (!widget) {
            return null;
        }

        const imagePreview = document.getElementById(SELECTORS.imagePreview);

        return {
            generateBtn: document.getElementById(SELECTORS.generateBtn),
            copyBtn: document.getElementById(SELECTORS.copyBtn),
            saveBtn: document.getElementById(SELECTORS.saveBtn),
            outputField: document.getElementById(SELECTORS.outputField),
            outputFieldWrap: document.getElementById(SELECTORS.outputFieldWrap),
            loadingSpinner: document.getElementById(SELECTORS.loadingSpinner),
            promptSelect: document.getElementById(SELECTORS.promptSelect),
            integrationSelect: document.getElementById(SELECTORS.integrationSelect),
            promptTextField: document.getElementById(SELECTORS.promptTextField),
            imageOptions: document.getElementById(SELECTORS.imageOptions),
            imageSizeInput: document.getElementById(SELECTORS.imageSizeInput),
            imageCountInput: document.getElementById(SELECTORS.imageCountInput),
            assetTargetSelect: document.getElementById(SELECTORS.assetTargetSelect),
            imagePreview: imagePreview,
            sliderImg: imagePreview ? imagePreview.querySelector(SELECTORS.sliderImg) : null,
            sliderPrev: imagePreview ? imagePreview.querySelector(SELECTORS.sliderPrev) : null,
            sliderNext: imagePreview ? imagePreview.querySelector(SELECTORS.sliderNext) : null,
            sliderCounter: imagePreview ? imagePreview.querySelector(SELECTORS.sliderCounter) : null,
            sliderPlaceholder: imagePreview ? imagePreview.querySelector(SELECTORS.sliderPlaceholder) : null,
        };
    }

    // ============================================================================
    // Loading State Management
    // ============================================================================

    /**
     * Show loading state and disable buttons
     * @param {Object} elements - Widget DOM elements
     */
    function startLoading(elements) {
        if (elements.loadingSpinner) {
            elements.loadingSpinner.classList.remove('aiassistant-hidden');
            elements.loadingSpinner.classList.add('show');
        }
        if (elements.generateBtn) {
            elements.generateBtn.disabled = true;
        }
        if (elements.copyBtn) {
            elements.copyBtn.disabled = true;
        }
        if (elements.saveBtn) {
            elements.saveBtn.disabled = true;
        }
    }

    /**
     * Hide loading state and enable buttons based on mode
     * @param {Object} elements - Widget DOM elements
     * @param {boolean} isImageMode - Whether in image generation mode
     */
    function stopLoading(elements, isImageMode) {
        if (elements.loadingSpinner) {
            elements.loadingSpinner.classList.add('aiassistant-hidden');
            elements.loadingSpinner.classList.remove('show');
        }
        if (elements.generateBtn) {
            elements.generateBtn.disabled = false;
        }
        if (elements.copyBtn) {
            if (isImageMode) {
                elements.copyBtn.disabled = true;
            } else if (elements.outputField) {
                elements.copyBtn.disabled = !elements.outputField.value.trim();
            }
        }
        if (elements.saveBtn) {
            elements.saveBtn.disabled = !isImageMode || currentPreviewUrls.length === 0;
        }
    }

    // ============================================================================
    // Image Slider Management
    // ============================================================================

    /**
     * Reset slider to initial state
     * @param {Object} elements - Widget DOM elements
     */
    function resetSlider(elements) {
        currentPreviewUrls = [];
        currentSliderIndex = 0;

        if (elements.sliderImg) {
            elements.sliderImg.src = '';
            elements.sliderImg.style.display = 'none';
        }
        if (elements.sliderCounter) {
            elements.sliderCounter.textContent = '';
        }
        if (elements.sliderPrev) {
            elements.sliderPrev.disabled = true;
        }
        if (elements.sliderNext) {
            elements.sliderNext.disabled = true;
        }
        if (elements.sliderPlaceholder) {
            elements.sliderPlaceholder.style.display = 'block';
        }
        if (elements.imagePreview) {
            elements.imagePreview.classList.add('aiassistant-hidden');
            elements.imagePreview.style.display = 'none';
        }
        if (elements.saveBtn) {
            elements.saveBtn.disabled = true;
        }
    }

    /**
     * Update slider display with current image
     * @param {Object} elements - Widget DOM elements
     */
    function updateSlider(elements) {
        if (!elements.imagePreview) {
            return;
        }

        if (!currentPreviewUrls.length) {
            resetSlider(elements);
            return;
        }

        // Ensure index is valid
        if (currentSliderIndex < 0 || currentSliderIndex >= currentPreviewUrls.length) {
            currentSliderIndex = 0;
        }

        const url = currentPreviewUrls[currentSliderIndex];

        if (elements.sliderImg) {
            elements.sliderImg.src = url;
            elements.sliderImg.style.display = 'block';
        }
        if (elements.sliderCounter) {
            elements.sliderCounter.textContent = (currentSliderIndex + 1) + ' / ' + currentPreviewUrls.length;
        }
        if (elements.sliderPrev) {
            elements.sliderPrev.disabled = currentPreviewUrls.length <= 1;
        }
        if (elements.sliderNext) {
            elements.sliderNext.disabled = currentPreviewUrls.length <= 1;
        }
        if (elements.sliderPlaceholder) {
            elements.sliderPlaceholder.style.display = 'none';
        }

        // Show the image preview - remove hidden class and set display
        elements.imagePreview.classList.remove('aiassistant-hidden');
        elements.imagePreview.style.display = 'flex';

        // Show and enable save button
        if (elements.saveBtn) {
            elements.saveBtn.classList.remove('aiassistant-hidden');
            elements.saveBtn.style.display = 'inline-flex';
            elements.saveBtn.disabled = currentPreviewUrls.length === 0;
        }
    }

    /**
     * Initialize slider event listeners
     * @param {Object} elements - Widget DOM elements
     */
    function initSliderListeners(elements) {
        if (elements.sliderPrev) {
            elements.sliderPrev.addEventListener('click', function() {
                if (!currentPreviewUrls.length) {
                    return;
                }
                currentSliderIndex = (currentSliderIndex - 1 + currentPreviewUrls.length) % currentPreviewUrls.length;
                updateSlider(elements);
            });
        }

        if (elements.sliderNext) {
            elements.sliderNext.addEventListener('click', function() {
                if (!currentPreviewUrls.length) {
                    return;
                }
                currentSliderIndex = (currentSliderIndex + 1) % currentPreviewUrls.length;
                updateSlider(elements);
            });
        }

        if (elements.sliderImg) {
            elements.sliderImg.addEventListener('click', function() {
                const url = currentPreviewUrls[currentSliderIndex];
                if (url) {
                    window.open(url, '_blank', 'noopener');
                }
            });
        }
    }

    // ============================================================================
    // Form Field Management
    // ============================================================================

    /**
     * Set integration select value if option exists
     * @param {Object} elements - Widget DOM elements
     * @param {string} handle - Integration handle to select
     */
    function setIntegrationIfExists(elements, handle) {
        if (!elements.integrationSelect || !handle) {
            return;
        }

        const option = Array.from(elements.integrationSelect.options || []).find(opt => opt.value === handle);
        if (option) {
            elements.integrationSelect.value = handle;
        }
    }

    /**
     * Set asset target select value
     * @param {Object} elements - Widget DOM elements
     * @param {string} value - Asset target value to set
     */
    function setAssetTarget(elements, value) {
        if (!elements.assetTargetSelect) {
            return;
        }

        const defaultValue = elements.assetTargetSelect.getAttribute('data-default-value') || '';
        const target = value && value !== 'null' ? value : defaultValue;
        const options = Array.from(elements.assetTargetSelect.options || []);

        const match = options.find(opt => opt.value === target);
        if (match) {
            elements.assetTargetSelect.value = target;
        } else if (options.length) {
            elements.assetTargetSelect.selectedIndex = 0;
        }
    }

    /**
     * Get selected prompt data from select element
     * @param {Object} elements - Widget DOM elements
     * @returns {Object} Prompt data object
     */
    function getSelectedPromptData(elements) {
        if (!elements.promptSelect) {
            return { value: '', type: 'text' };
        }

        const option = elements.promptSelect.options[elements.promptSelect.selectedIndex];
        if (!option) {
            return { value: '', type: 'text' };
        }

        // Get data attributes - handle both camelCase (dataset) and kebab-case (getAttribute)
        const getDataAttr = (attr, decodeHtml = false) => {
            // Try dataset first (camelCase)
            const camelCase = attr.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            let value = '';
            if (option.dataset && option.dataset[camelCase] !== undefined) {
                value = option.dataset[camelCase] || '';
            } else {
                // Fallback to getAttribute (kebab-case)
                value = option.getAttribute(`data-${attr}`) || '';
            }
            
            // Decode HTML entities if needed
            if (decodeHtml && value) {
                const textarea = document.createElement('textarea');
                textarea.innerHTML = value;
                value = textarea.value;
            }
            
            return value;
        };

        return {
            value: option.value || '',
            type: getDataAttr('type') || 'text',
            promptText: getDataAttr('prompt-text', true) || getDataAttr('promptText', true) || '',
            imageSize: getDataAttr('image-size') || getDataAttr('imageSize') || '',
            imageCount: getDataAttr('image-count') || getDataAttr('imageCount') || '',
            assetTarget: getDataAttr('asset-target') || getDataAttr('assetTarget') || '',
            integration: getDataAttr('integration') || ''
        };
    }

    /**
     * Build a map of integration handles to types from select options
     * @param {Object} elements - Widget DOM elements
     */
    function buildIntegrationTypeMap(elements) {
        if (!elements.integrationSelect) {
            return;
        }

        integrationTypeMap = {};
        const options = Array.from(elements.integrationSelect.options || []);
        
        options.forEach(option => {
            if (option.value) {
                // Try to get type from data attribute
                let type = option.dataset?.type || option.getAttribute('data-type') || '';
                
                // Fallback: try to infer from handle or option text
                if (!type && option.value) {
                    const handle = option.value.toLowerCase();
                    if (handle.includes('openai') || handle.includes('dall-e')) {
                        type = 'openai';
                    } else if (handle.includes('replicate') || handle.includes('flux')) {
                        type = 'replicate';
                    }
                }
                
                integrationTypeMap[option.value] = type.toLowerCase();
            }
        });
    }

    /**
     * Check if an integration supports image generation
     * @param {Object} elements - Widget DOM elements
     * @returns {boolean} Whether the selected integration supports image generation
     */
    function integrationSupportsImage(elements) {
        if (!elements.integrationSelect || !elements.integrationSelect.value) {
            return false;
        }

        const integrationHandle = elements.integrationSelect.value;
        const integrationType = integrationTypeMap[integrationHandle] || '';
        
        // OpenAI and Replicate support image generation
        const imageCapableTypes = ['openai', 'replicate'];
        
        return imageCapableTypes.includes(integrationType);
    }

    /**
     * Toggle between text and image generation modes
     * @param {Object} elements - Widget DOM elements
     * @param {boolean} isImage - Whether in image mode
     */
    function toggleMode(elements, isImage) {
        if (elements.imageOptions) {
            if (isImage) {
                elements.imageOptions.classList.remove('aiassistant-hidden');
                elements.imageOptions.style.display = 'block';
                elements.imageOptions.style.visibility = 'visible';
            } else {
                elements.imageOptions.classList.add('aiassistant-hidden');
                elements.imageOptions.style.display = 'none';
            }
        }
        if (elements.outputFieldWrap) {
            elements.outputFieldWrap.style.display = isImage ? 'none' : 'block';
        }
        if (elements.copyBtn) {
            if (isImage) {
                elements.copyBtn.classList.add('aiassistant-hidden');
                elements.copyBtn.style.display = 'none';
            } else {
                elements.copyBtn.classList.remove('aiassistant-hidden');
                elements.copyBtn.style.display = 'inline-flex';
                if (elements.outputField) {
                    elements.copyBtn.disabled = !elements.outputField.value.trim();
                }
            }
        }
        if (elements.saveBtn) {
            if (isImage) {
                elements.saveBtn.classList.remove('aiassistant-hidden');
                elements.saveBtn.style.display = 'inline-flex';
                elements.saveBtn.disabled = currentPreviewUrls.length === 0;
            } else {
                elements.saveBtn.classList.add('aiassistant-hidden');
                elements.saveBtn.style.display = 'none';
            }
        }

        if (!isImage) {
            resetSlider(elements);
        } else if (currentPreviewUrls.length) {
            updateSlider(elements);
        }
    }

    /**
     * Check if we should show image options based on prompt type
     * Image options are shown based on prompt type, not integration
     * @param {Object} elements - Widget DOM elements
     * @param {string} promptType - The prompt type
     * @returns {boolean} Whether to show image options
     */
    function shouldShowImageOptions(elements, promptType) {
        const type = (promptType || '').toLowerCase();
        // Show image options if prompt type is 'image'
        return type === 'image';
    }

    /**
     * Apply prompt selection and update form fields
     * @param {Object} elements - Widget DOM elements
     */
    function applyPromptSelection(elements) {
        const data = getSelectedPromptData(elements);
        const type = (data.type || '').toLowerCase();
        const isImage = shouldShowImageOptions(elements, type);

        // Update prompt text field
        if (elements.promptTextField) {
            if (data.value === 'custom-text') {
                elements.promptTextField.value = '';
                elements.promptTextField.placeholder = Craft.t('ai-assistant', 'Write your custom prompt here...');
            } else if (data.value === 'custom-image') {
                elements.promptTextField.value = '';
                elements.promptTextField.placeholder = Craft.t('ai-assistant', 'Describe the image you want to generate...');
            } else {
                elements.promptTextField.value = data.promptText || '';
                elements.promptTextField.placeholder = Craft.t('ai-assistant', 'Edit the prompt text as needed...');
            }
        }

        // Update image-specific fields with defaults if not provided
        if (isImage) {
            // Always show image options when image prompt is selected
            if (elements.imageSizeInput) {
                // Use prompt's imageSize if provided, otherwise keep current value or use default
                const sizeValue = data.imageSize && data.imageSize.trim() ? data.imageSize.trim() : (elements.imageSizeInput.value || '1024x1024');
                elements.imageSizeInput.value = sizeValue;
            }
            if (elements.imageCountInput) {
                // Use prompt's imageCount if provided, otherwise keep current value or use default
                const countValue = data.imageCount && data.imageCount.trim() ? parseInt(data.imageCount, 10) : (parseInt(elements.imageCountInput.value, 10) || 1);
                const numericCount = Number.isFinite(countValue) && countValue > 0 ? countValue : 1;
                elements.imageCountInput.value = numericCount;
            }
            // Set asset target - use prompt value or default to first option
            if (data.assetTarget && data.assetTarget.trim()) {
                setAssetTarget(elements, data.assetTarget);
            } else {
                // No prompt value, use default (first option)
                if (elements.assetTargetSelect) {
                    const defaultValue = elements.assetTargetSelect.getAttribute('data-default-value') || '';
                    if (defaultValue) {
                        setAssetTarget(elements, defaultValue);
                    } else {
                        // Fallback to first option
                        const options = Array.from(elements.assetTargetSelect.options || []);
                        if (options.length > 0 && options[0].value) {
                            elements.assetTargetSelect.value = options[0].value;
                        }
                    }
                }
            }
            setIntegrationIfExists(elements, data.integration);
        } else {
            setAssetTarget(elements, '');
        }

        toggleMode(elements, isImage);
    }


    // ============================================================================
    // API Functions
    // ============================================================================

    /**
     * Handle text generation API call
     * @param {Object} elements - Widget DOM elements
     * @param {string} promptText - Prompt text to send
     * @param {string} integrationHandle - Integration handle to use
     */
    async function handleTextGenerate(elements, promptText, integrationHandle) {
        startLoading(elements);

        if (elements.outputField) {
            elements.outputField.value = '';
        }

        try {
            const response = await fetch(Craft.getCpUrl('ai-assistant/api/generate-text'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-Token': Craft.csrfTokenValue
                },
                body: JSON.stringify({
                    promptText: promptText,
                    integration: integrationHandle,
                    fieldType: 'input',
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Request failed');
            }

            const result = await response.json();

            if (result.success) {
                const generatedText = result.data || result.content || result.text || '';
                if (elements.outputField) {
                    elements.outputField.value = generatedText;
                }
                if (elements.copyBtn) {
                    // Show the copy button and enable it if there's content
                    elements.copyBtn.classList.remove('aiassistant-hidden');
                    elements.copyBtn.style.display = 'inline-flex';
                    elements.copyBtn.disabled = !generatedText.trim();
                }
                Craft.cp.displayNotice('Content generated successfully!');
            } else {
                Craft.cp.displayError(result.message || result.error || 'Generation failed');
            }
        } catch (error) {
            console.error('Generation error:', error);
            Craft.cp.displayError('Failed to generate content');
        } finally {
            stopLoading(elements, false);
        }
    }

    /**
     * Handle image generation API call
     * @param {Object} elements - Widget DOM elements
     * @param {string} promptText - Prompt text to send
     * @param {string} integrationHandle - Integration handle to use
     * @param {Object} promptData - Additional prompt data
     */
    async function handleImageGenerate(elements, promptText, integrationHandle, promptData) {
        const trimmedPrompt = promptText.trim();
        if (!trimmedPrompt) {
            Craft.cp.displayError('Please enter or select a prompt text.');
            return;
        }

        // Validate and set image count
        let count = parseInt(elements.imageCountInput ? elements.imageCountInput.value : '1', 10);
        if (!Number.isFinite(count) || count < 1) {
            count = 1;
            if (elements.imageCountInput) {
                elements.imageCountInput.value = 1;
            }
        }

        // Build payload
        const payload = {
            prompt: trimmedPrompt,
            integration: integrationHandle,
            count: count,
            dryRun: true,
            options: {}
        };

        const sizeValue = elements.imageSizeInput ? (elements.imageSizeInput.value || '').trim() : '';
        if (sizeValue) {
            payload.size = sizeValue;
        }

        const selectedTarget = elements.assetTargetSelect ? (elements.assetTargetSelect.value || '') : '';
        const fallbackTarget = promptData.assetTarget || '';
        if (selectedTarget || fallbackTarget) {
            payload.assetTarget = selectedTarget || fallbackTarget;
        }

        startLoading(elements);
        resetSlider(elements);

        try {
            const response = await fetch(Craft.getCpUrl('ai-assistant/api/generate-image'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-Token': Craft.csrfTokenValue
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Request failed');
            }

            const result = await response.json();

            if (result.success) {
                currentPreviewUrls = Array.isArray(result.previewUrls) ? result.previewUrls : [];
                currentSliderIndex = 0;

                if (!currentPreviewUrls.length) {
                    Craft.cp.displayError(result.error || 'No images were returned.');
                } else {
                    updateSlider(elements);
                }
            } else {
                Craft.cp.displayError(result.error || 'Generation failed');
            }
        } catch (error) {
            console.error('Image generation error:', error);
            Craft.cp.displayError('Failed to generate image');
        } finally {
            stopLoading(elements, true);
        }
    }

    /**
     * Handle saving images to assets
     * @param {Object} elements - Widget DOM elements
     */
    async function handleSaveImages(elements) {
        if (!currentPreviewUrls.length) {
            Craft.cp.displayError('No images to save.');
            return;
        }

        const assetTarget = elements.assetTargetSelect ? (elements.assetTargetSelect.value || '') : '';
        const title = elements.promptTextField ? elements.promptTextField.value.trim() : '';

        startLoading(elements);

        try {
            const response = await fetch(Craft.getCpUrl('ai-assistant/api/save-image-to-assets'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-Token': Craft.csrfTokenValue
                },
                body: JSON.stringify({
                    urls: currentPreviewUrls,
                    assetTarget: assetTarget,
                    title: title
                })
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || 'Request failed');
            }

            const result = await response.json();
            if (result.success) {
                Craft.cp.displayNotice('Images saved to Assets.');
            } else {
                Craft.cp.displayError(result.error || 'Failed to save images');
            }
        } catch (error) {
            console.error('Save image error:', error);
            Craft.cp.displayError('Failed to save images');
        } finally {
            stopLoading(elements, true);
        }
    }

    // ============================================================================
    // Event Handlers
    // ============================================================================

    /**
     * Initialize event listeners
     * @param {Object} elements - Widget DOM elements
     */
    function initEventListeners(elements) {
        // Prompt select change handler
        if (elements.promptSelect) {
            // Auto-select first non-custom prompt if custom is selected
            if (elements.promptSelect.value === 'custom-text' || elements.promptSelect.value === 'custom') {
                const firstPrompt = Array.from(elements.promptSelect.options || []).find(
                    opt => opt.value !== 'custom-text' && opt.value !== 'custom-image'
                );
                if (firstPrompt) {
                    firstPrompt.selected = true;
                }
            }

            elements.promptSelect.addEventListener('change', function() {
                applyPromptSelection(elements);
            });
        }

        // Output field input handler (for copy button state)
        if (elements.outputField) {
            elements.outputField.addEventListener('input', function() {
                if (elements.copyBtn && elements.copyBtn.style.display !== 'none') {
                    elements.copyBtn.disabled = !this.value.trim();
                }
            });
        }

        // Generate button click handler
        if (elements.generateBtn) {
            elements.generateBtn.addEventListener('click', function() {
                if (!elements.promptSelect) {
                    Craft.cp.displayError('Please select a prompt.');
                    return;
                }

                const selectedPrompt = getSelectedPromptData(elements);
                const integrationHandle = elements.integrationSelect ? elements.integrationSelect.value : '';

                if (!integrationHandle) {
                    Craft.cp.displayError('Please select an integration.');
                    return;
                }

                const promptValue = elements.promptTextField ? elements.promptTextField.value : '';
                const isImage = (selectedPrompt.type || '').toLowerCase() === 'image';

                if (!isImage && !promptValue.trim()) {
                    Craft.cp.displayError('Please enter or select a prompt text.');
                    return;
                }

                if (isImage) {
                    handleImageGenerate(elements, promptValue, integrationHandle, selectedPrompt);
                } else {
                    handleTextGenerate(elements, promptValue.trim(), integrationHandle);
                }
            });
        }

        // Copy button click handler
        if (elements.copyBtn) {
            elements.copyBtn.addEventListener('click', function() {
                if (!elements.outputField || !elements.outputField.value.trim()) {
                    return;
                }

                navigator.clipboard.writeText(elements.outputField.value).then(function() {
                    Craft.cp.displayNotice('Content copied to clipboard!');
                }).catch(function() {
                    elements.outputField.select();
                    document.execCommand('copy');
                    Craft.cp.displayNotice('Content copied to clipboard!');
                });
            });
        }

        // Save button click handler
        if (elements.saveBtn) {
            elements.saveBtn.addEventListener('click', function() {
                handleSaveImages(elements);
            });
        }

        // Initialize slider listeners
        initSliderListeners(elements);
    }

    // ============================================================================
    // Initialization
    // ============================================================================

    /**
     * Initialize the widget
     */
    function init() {
        const elements = getWidgetElements();
        if (!elements) {
            return;
        }

        // Build integration type map
        buildIntegrationTypeMap(elements);

        initEventListeners(elements);
        applyPromptSelection(elements);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
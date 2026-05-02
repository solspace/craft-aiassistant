/**
 * Integration Edit Form
 * Handles form behavior for creating/editing integrations
 */

(function() {
    'use strict';

    // ============================================================================
    // Constants
    // ============================================================================

    const PROVIDER_DEFAULT_MODELS = {
        openai: 'gpt-5.4-mini',
        gemini: 'gemini-3-flash',
        anthropic: 'claude-sonnet-4.6',
        xai: 'grok-4.1-fast',
        replicate: 'black-forest-labs/flux-2-pro',
    };

    const PROVIDER_MAX_TOKENS = {
        openai: 128000,
        gemini: 1048576,
        anthropic: 200000,
        xai: 256000,
        replicate: 256000,
    };

    const TEMPERATURE_SUPPORTED_PROVIDERS = ['gemini'];
    const DEFAULT_TEMPERATURE = '0.7';
    const DEFAULT_MAX_TOKENS = 1000000;
    const MAX_HANDLE_LENGTH = 64;

    // ============================================================================
    // DOM Element Selectors
    // ============================================================================

    const SELECTORS = {
        type: 'type',
        model: 'model',
        maxTokens: 'maxTokens',
        temperatureField: 'temperature-field',
        temperature: 'temperature',
        name: 'name',
        handle: 'handle',
    };

    // ============================================================================
    // Provider Field Management
    // ============================================================================

    /**
     * Get DOM elements for provider fields
     * @returns {Object|null} Object with field elements or null if missing
     */
    function getProviderFields() {
        const type = document.getElementById(SELECTORS.type);
        const modelInput = document.getElementById(SELECTORS.model);
        const maxTokensInput = document.getElementById(SELECTORS.maxTokens);
        const temperatureField = document.getElementById(SELECTORS.temperatureField);
        const temperatureInput = document.getElementById(SELECTORS.temperature);

        if (!type || !modelInput || !maxTokensInput || !temperatureField || !temperatureInput) {
            return null;
        }

        return {
            type,
            modelInput,
            maxTokensInput,
            temperatureField,
            temperatureInput,
        };
    }

    /**
     * Update model field based on provider type
     * @param {HTMLInputElement} modelInput - The model input element
     * @param {string} providerType - The selected provider type
     */
    function applyDefaultModel(modelInput, providerType) {
        const defaultModel = PROVIDER_DEFAULT_MODELS[providerType] || '';

        modelInput.dataset.aiassistantProgrammatic = '1';
        modelInput.value = defaultModel;
        // Keep Craft autosuggest stable (it may restore from initialvalue on focus)
        modelInput.setAttribute('initialvalue', modelInput.value);
        modelInput.dispatchEvent(new Event('input', { bubbles: true }));
        modelInput.dataset.aiassistantProgrammatic = '0';
    }

    function updateModelForProvider(modelInput, providerType, reason) {
        const current = (modelInput.value || '').trim();
        if ('type-change' === reason) {
            applyDefaultModel(modelInput, providerType);
            return;
        }

        // init / first paint: only fill if empty (don’t wipe saved models on edit)
        if (!current) {
            applyDefaultModel(modelInput, providerType);
        }
    }

    /**
     * Initialize tracking so provider changes update the model until user types.
     */
    function initModelTracking() {
        const modelInput = document.getElementById(SELECTORS.model);
        if (!modelInput) {
            return;
        }

        const initialValue = (modelInput.value || '').trim();
        if (initialValue) {
            modelInput.setAttribute('initialvalue', initialValue);
        }

        // Keep autosuggest initialvalue aligned as the user edits
        modelInput.addEventListener('input', function() {
            if (modelInput.dataset.aiassistantProgrammatic === '1') {
                return;
            }
            const v = (modelInput.value || '').trim();
            if (v) {
                modelInput.setAttribute('initialvalue', v);
            }
        });

        // Before autosuggest reacts to focus/click, sync initialvalue to current value.
        // (Autosuggest widgets sometimes reset to initialvalue when activated.)
        function syncInitialOnInteract(e) {
            const t = e && e.target;
            if (!t || t.id !== SELECTORS.model) {
                return;
            }
            const v = (t.value || '').trim();
            if (v) {
                t.setAttribute('initialvalue', v);
            }
        }

        document.addEventListener('mousedown', syncInitialOnInteract, true);
        document.addEventListener('focusin', syncInitialOnInteract, true);
    }

    /**
     * Update max tokens field based on provider type
     * @param {HTMLInputElement} maxTokensInput - The max tokens input element
     * @param {string} providerType - The selected provider type
     */
    function updateMaxTokensField(maxTokensInput, providerType) {
        const maxTokens = PROVIDER_MAX_TOKENS[providerType] || DEFAULT_MAX_TOKENS;
        maxTokensInput.max = maxTokens;
    }

    /**
     * Update temperature field visibility and value based on provider type
     * @param {HTMLElement} temperatureField - The temperature field container
     * @param {HTMLInputElement} temperatureInput - The temperature input element
     * @param {string} providerType - The selected provider type
     */
    function updateTemperatureField(temperatureField, temperatureInput, providerType) {
        const isSupported = TEMPERATURE_SUPPORTED_PROVIDERS.includes(providerType);

        if (isSupported) {
            temperatureField.classList.add('show');
            temperatureField.classList.remove('aiassistant-hidden');
            temperatureInput.required = true;

            if (!temperatureInput.value) {
                temperatureInput.value = DEFAULT_TEMPERATURE;
            }
        } else {
            temperatureField.classList.remove('show');
            temperatureField.classList.add('aiassistant-hidden');
            temperatureInput.required = false;
            temperatureInput.value = '';
        }
    }

    /**
     * Update form fields based on selected provider type
     */
    function updateFieldsForProvider(evt) {
        const fields = getProviderFields();
        if (!fields) {
            return;
        }

        const providerType = fields.type.value;
        const reason = evt && 'change' === evt.type ? 'type-change' : 'init';

        updateModelForProvider(fields.modelInput, providerType, reason);
        updateMaxTokensField(fields.maxTokensInput, providerType);
        updateTemperatureField(fields.temperatureField, fields.temperatureInput, providerType);
    }

    // ============================================================================
    // Handle Generation
    // ============================================================================

    /**
     * Generate a safe handle from a name (camelCase)
     * @param {string} name - The name to convert
     * @returns {string} - The generated handle
     */
    function generateHandleFromName(name) {
        if (!name) {
            return '';
        }

        // Normalize whitespace and separators
        const parts = name
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '') // Strip diacritics
            .replace(/[^A-Za-z0-9]+/g, ' ')  // Convert non-alphanumeric to spaces
            .trim()
            .split(/\s+/)
            .filter(part => part.length > 0);

        if (parts.length === 0) {
            return '';
        }

        // Convert to camelCase
        const first = parts[0].toLowerCase();
        const rest = parts
            .slice(1)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

        let handle = [first, ...rest].join('');

        // Ensure handle starts with a letter
        handle = handle.replace(/^[^a-zA-Z]+/, '');
        if (!handle) {
            return '';
        }

        // Remove any remaining invalid characters
        handle = handle.replace(/[^a-zA-Z0-9]/g, '');

        // Trim to maximum length
        if (handle.length > MAX_HANDLE_LENGTH) {
            handle = handle.slice(0, MAX_HANDLE_LENGTH);
        }

        return handle;
    }

    /**
     * Initialize auto-handle generation from name field
     */
    function initAutoHandle() {
        const nameInput = document.getElementById(SELECTORS.name);
        const handleInput = document.getElementById(SELECTORS.handle);

        if (!nameInput || !handleInput) {
            return;
        }

        // Mark handle as auto-generated if empty on load
        if (!handleInput.value) {
            handleInput.dataset.autogenerated = '1';
            handleInput.value = generateHandleFromName(nameInput.value || '');
        }

        // Update handle when name changes (if auto-generated)
        nameInput.addEventListener('input', function() {
            const isAutoGenerated = handleInput.dataset.autogenerated === '1';
            const isEmpty = !handleInput.value;

            if (isEmpty || isAutoGenerated) {
                handleInput.value = generateHandleFromName(nameInput.value || '');
                handleInput.dataset.autogenerated = '1';
            }
        });

        // Stop auto-updating when user manually edits handle
        handleInput.addEventListener('input', function() {
            handleInput.dataset.autogenerated = '0';
        });
    }

    // ============================================================================
    // Initialization
    // ============================================================================

    /**
     * Initialize event listeners
     */
    function initEventListeners() {
        const typeSelect = document.getElementById(SELECTORS.type);
        if (typeSelect) {
            typeSelect.addEventListener('change', updateFieldsForProvider);
        }
    }

    /**
     * Initialize form fields on page load
     */
    function initFields() {
        initModelTracking();
        updateFieldsForProvider();
        initAutoHandle();
    }

    /**
     * Initialize the integration edit form
     */
    function init() {
        initEventListeners();

        // Initialize fields when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initFields);
        } else {
            initFields();
        }
    }

    // Initialize when script loads
    init();
})();

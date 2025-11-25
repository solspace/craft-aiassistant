/**
 * AI Assistant Plugin - Main Entry Point
 * Handles inline AI button injection and modal functionality for Craft CMS.
 */

import { CONFIG } from './utils/config.js';
import { qsa } from './utils/dom.js';
import { getFieldHandle, isFieldEnabled, getFieldInput, getFieldType } from './utils/field.js';
import { attachButtonToField } from './components/button.js';
import { openGenerateModal, openFromAssetModal } from './views/modals/generate-modal.js';
import { openPromptPicker, applyPromptSelection } from './views/modals/prompt-picker.js';
import { fetchModalHtml } from './services/api.js';
import { createModal } from './components/modal.js';

// Import view-specific scripts (they will only run if their elements exist)
import './views/integrations/edit.js';
import './views/integrations/index.js';
import './views/prompts/edit.js';
import './views/settings/index.js';
import './views/modals/prompt-edit.js';

/**
 * Attach inline buttons to all eligible fields
 */
function attachInlineButtons() {
    const nodes = qsa(CONFIG.selectors.fields);
    nodes.forEach((inputEl) => {
        const field = inputEl.closest(CONFIG.selectors.field);
        if (!field) return;
        
        const handle = getFieldHandle(field);
        if (!isFieldEnabled(handle)) return;
        
        attachButtonToField(inputEl, (field) => {
            openGenerateModal(field);
        });
    });
}

/**
 * Initialize main functionality
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
 * Public API (exposed on window.AiAssistant)
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

/**
 * Modal API (exposed on window.AiAssistantModal for backward compatibility)
 */
window.AiAssistantModal = {
    openGenerateModal,
    openFromAssetModal,
    getFieldInput,
    getFieldHandle,
    getFieldType,
    fetchModalHtml,
    createModal
};


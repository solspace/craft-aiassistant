/**
 * Modal Component
 * Handles modal creation and management
 */

import { MODAL_CONFIG } from '../utils/config.js';

/**
 * Create modal from HTML
 */
export function createModal(modalHtml) {
    // Ensure we pass a concrete element, not a raw string or collection with text nodes
    const $el = $(typeof modalHtml === 'string' ? modalHtml.trim() : modalHtml);
    const $modalEl = $el.filter('.modal').add($el.find('.modal')).first();
    const modal = new Garnish.Modal($modalEl.length ? $modalEl : $el, MODAL_CONFIG.options);

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

/**
 * Inject modal icon
 */
export function injectModalIcon(modalElement) {
    // Handle both generate-text modal and prompt-edit modal icons
    const $iconContainer = $(modalElement).find('#aiassistant-modal-icon, #aiassistant-prompt-modal-icon');
    if ($iconContainer.length && window.aiAssistantIconSvg) {
        // Replace the text content with the SVG icon
        $iconContainer.html(window.aiAssistantIconSvg);
    }
}


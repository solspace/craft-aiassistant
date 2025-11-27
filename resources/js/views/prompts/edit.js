/**
 * Prompt Edit Form
 * Handles form behavior for creating/editing prompts
 */

(function() {
    'use strict';

    /**
     * Toggle image options visibility based on prompt type
     */
    function toggleImageOptions() {
        const typeSelect = document.getElementById('type');
        const imageOptions = document.getElementById('image-options');
        
        if (!typeSelect || !imageOptions) return;
        
        if (typeSelect.value === 'image') {
            imageOptions.classList.remove('aiassistant-hidden');
            imageOptions.classList.add('show');
        } else {
            imageOptions.classList.add('aiassistant-hidden');
            imageOptions.classList.remove('show');
        }
    }

    /**
     * Initialize the prompt edit form
     */
    function init() {
        const typeSelect = document.getElementById('type');
        if (typeSelect) {
            typeSelect.addEventListener('change', toggleImageOptions);
            // Initial toggle on page load
            toggleImageOptions();
        }
    }

    // Initialize when script loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();


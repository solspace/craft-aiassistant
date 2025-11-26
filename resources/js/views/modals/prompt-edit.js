/**
 * Prompt Edit Modal
 * Handles form behavior for the prompt edit modal
 */

(function() {
    'use strict';

    /**
     * Toggle image extra options visibility based on prompt type
     */
    function toggleImageOptions() {
        const typeSelect = document.getElementById('modal-type');
        const imageExtra = document.getElementById('image-extra-options');
        
        if (!typeSelect || !imageExtra) return;
        
        if (typeSelect.value === 'image') {
            imageExtra.classList.remove('aiassistant-hidden');
            imageExtra.classList.add('show');
        } else {
            imageExtra.classList.add('aiassistant-hidden');
            imageExtra.classList.remove('show');
        }
    }

    /**
     * Initialize the prompt edit modal
     */
    function init() {
        const typeSelect = document.getElementById('modal-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', toggleImageOptions);
            // Initial toggle on modal open
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


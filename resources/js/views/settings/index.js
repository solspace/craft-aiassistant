/**
 * Settings Page
 * Handles settings page functionality
 */

(function() {
    'use strict';

    /**
     * Toggle all field lightswitches on/off
     * @param {boolean} on - Whether to turn switches on or off
     */
    function setAll(on) {
        const form = document.getElementById('ai-assistant-settings-form');
        if (!form) return;

        const hiddenInputs = form.querySelectorAll('input[type="hidden"][name^="settings[enabledFieldHandles]"]');
        hiddenInputs.forEach(function(hidden) {
            // Try to find the adjacent lightswitch container
            let ls = hidden.nextElementSibling && hidden.nextElementSibling.classList.contains('lightswitch') 
                ? hidden.nextElementSibling 
                : null;
            
            if (!ls) {
                const td = hidden.closest('td');
                if (td) ls = td.querySelector('.lightswitch');
            }
            
            if (ls && window.jQuery && jQuery(ls).data('lightswitch')) {
                const api = jQuery(ls).data('lightswitch');
                if (on) {
                    api.turnOn();
                } else {
                    api.turnOff();
                }
            } else if (ls) {
                // Fallback: update UI state and hidden input value
                ls.classList.toggle('on', !!on);
                ls.classList.toggle('off', !on);
                ls.setAttribute('aria-checked', on ? 'true' : 'false');
                hidden.value = on ? '1' : '';
            }
        });
    }

    /**
     * Initialize selectize for prompt select fields
     */
    function initSelectize() {
        document.querySelectorAll('[data-prompt-select]').forEach(function(select) {
            try {
                if (window.$ && $.fn.selectize) {
                    const placeholder = (window.Craft && Craft.t) 
                        ? Craft.t('aiassistant', 'Select prompts')
                        : 'Select prompts';
                    
                    $(select).selectize({
                        plugins: ['remove_button'],
                        placeholder: placeholder,
                        dropdownParent: 'body',
                        allowEmptyOption: true,
                        closeAfterSelect: false,
                    });
                }
            } catch (e) {
                // Silently fail if selectize is not available
            }
        });
    }

    /**
     * Initialize the settings page
     */
    function init() {
        const form = document.getElementById('ai-assistant-settings-form');
        const enableAll = document.getElementById('enable-all');
        const disableAll = document.getElementById('disable-all');

        if (enableAll) {
            enableAll.addEventListener('click', function() {
                setAll(true);
            });
        }

        if (disableAll) {
            disableAll.addEventListener('click', function() {
                setAll(false);
            });
        }

        // Initialize selectize
        initSelectize();
    }

    // Initialize when script loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();


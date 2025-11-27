/**
 * Integrations Index Page
 * Handles test integration functionality
 */

(function() {
    'use strict';

    /**
     * Test an integration connection
     * @param {number} integrationId - The integration ID to test
     * @param {Event} event - The click event
     */
    function testIntegration(integrationId, event) {
        const button = (event && event.target) ? event.target.closest('button') : null;
        if (!button) return;

        const originalContent = button.innerHTML;
        
        // Show loading state
        button.innerHTML = '<span class="custom-spinner"></span>Test';
        button.disabled = true;
        
        // Make AJAX request to test integration
        Craft.postActionRequest('ai-assistant/integrations/test', {
            id: integrationId
        }, function(response) {
            if (response.success) {
                // Show success popup
                Craft.cp.displayNotice('Integration test successful! ' + (response.message || 'Connection established successfully.'));
            } else {
                // Show error popup
                Craft.cp.displayError('Integration test failed: ' + (response.message || 'Connection failed. Please check your API key and settings.'));
            }
            button.innerHTML = originalContent;
            button.disabled = false;
        }, function(xhr) {
            // Show error popup
            let errorMessage = 'Connection failed. Please check your API key and settings.';
            try {
                const response = JSON.parse(xhr.responseText);
                errorMessage = response.message || errorMessage;
            } catch (e) {
                // Use default error message
            }
            Craft.cp.displayError('Integration test failed: ' + errorMessage);
            button.innerHTML = originalContent;
            button.disabled = false;
        });
    }

    // Expose testIntegration globally for onclick handlers
    window.testIntegration = testIntegration;
})();


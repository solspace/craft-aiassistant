/**
 * Prompt Picker View
 * Handles prompt selection modal for settings page
 */

import { CONFIG } from '../../utils/config.js';
import { qsa } from '../../utils/dom.js';
import { fetchModalHtml, loadIntegrations, loadPrompts, savePrompt } from '../../services/api.js';

/**
 * Open prompt picker modal
 */
export function openPromptPicker(fieldHandle) {
    if (typeof fieldHandle !== 'string' || !fieldHandle) {
        Craft.cp.displayError('Field handle is required to open prompt picker.');
        return;
    }

    try {
        const active = document.activeElement;
        if (active && typeof active.blur === 'function') active.blur();
    } catch (e) { /* noop */ }

    const url = Craft.getCpUrl('ai-assistant/ui/prompt-edit-modal');
    fetchModalHtml(url)
        .then((html) => {
            renderPromptModal(html, fieldHandle);
        })
        .catch(() => {
            Craft.cp.displayError('Could not open prompt picker');
        });
}

/**
 * Render prompt modal
 */
function renderPromptModal(html, fieldHandle) {
    // Remove existing modal safely
    const $existing = $('.ai-assistant-prompt-modal');
    if ($existing.length) {
        const existingModal = $existing.data('modal');
        if (existingModal && typeof existingModal.hide === 'function') {
            if (existingModal.$shade?.length) existingModal.$shade.stop(true, false);
            $existing.stop(true, false);
            $existing.remove();
        } else {
            $existing.remove();
        }
    }

    try {
        const active = document.activeElement;
        if (active && typeof active.blur === 'function') active.blur();
    } catch (e) {}

    const $raw = $(typeof html === 'string' ? html.trim() : html);
    const $modal = $raw.filter('.ai-assistant-prompt-modal').add($raw.find('.ai-assistant-prompt-modal')).first();
    if (!$modal || !$modal.length) {
        Craft.cp.displayError('Failed to render prompt modal.');
        return;
    }
    $modal.appendTo(document.body);
    const modalInstance = new Garnish.Modal($modal, { onHide: () => $modal.remove() });
    $modal.data('modal', modalInstance);
    $modal.data('fieldHandle', fieldHandle);

    initPromptModalUI($modal, modalInstance, fieldHandle);

    try {
        if (typeof modalInstance.on === 'function') {
            modalInstance.on('show', function() {
                setTimeout(() => {
                    try {
                        const $first = $modal.find('input, textarea, select, button').filter(':visible:enabled').first();
                        if ($first && $first.length) $first.trigger('focus');
                    } catch (e) {}
                }, 50);
            });
        }
    } catch (e) {}
}

/**
 * Initialize prompt modal UI
 */
function initPromptModalUI($modal, modalInstance, fieldHandle) {
    let currentPromptId = '';
    const $hiddenInput = $(`input[name="settings[fieldPrompts][${fieldHandle}]"]`);
    if ($hiddenInput.length) currentPromptId = $hiddenInput.val() || '';

    const $selectExisting = $modal.find('#prompt-existing-select');
    const $detailsSection = $modal.find('#prompt-details-section');
    const $saveNewBtn = $modal.find('#save-prompt-btn');
    const $saveSelectedBtn = $modal.find('#save-selected-prompt-btn');
    const $integrationSelect = $modal.find('#modal-integration');

    // Insert icon if available
    const iconContainer = $modal.find('#aiassistant-prompt-modal-icon');
    if (iconContainer.length && window.aiAssistantIconSvg) {
        iconContainer.html(window.aiAssistantIconSvg);
    }

    // Initialize Craft UI elements
    try { 
        if (typeof Craft.initUiElements === 'function') Craft.initUiElements($modal.find('.body')); 
    } catch (e) {}

    // Load integrations
    if ($integrationSelect.length) {
        loadModalIntegrations($integrationSelect);
    }

    // If there is already a selected prompt, show save button and details
    if (currentPromptId && $selectExisting.length && $selectExisting.find(`option[value="${currentPromptId}"]`).length) {
        $saveSelectedBtn.show();
        setTimeout(() => {
            $selectExisting.val(currentPromptId).trigger('change');
        }, 100);
    }

    // Toggle create/select modes
    $modal.on('click', '#show-create-prompt-form', () => {
        $modal.find('#prompt-select-mode').hide();
        $modal.find('#prompt-create-mode').show();
        $saveNewBtn.show();
        $saveSelectedBtn.hide();
        if ($integrationSelect.length) loadModalIntegrations($integrationSelect);
    });

    $modal.on('click', '#show-select-prompt', () => {
        $modal.find('#prompt-create-mode').hide();
        $modal.find('#prompt-select-mode').show();
        $saveNewBtn.hide();

        const val = $modal.find('#prompt-existing-select').val();
        if (val) $saveSelectedBtn.show();
        else $saveSelectedBtn.hide();
    });

    // Save selected prompt
    $modal.on('click', '#save-selected-prompt-btn', () => {
        const $sel = $modal.find('#prompt-existing-select');
        const id = $sel.val() || '';
        const $selectedOption = $sel.find('option:selected');
        let name = $selectedOption.text().trim();
        let type = '';

        if (id) {
            name = name.replace(/\s*\([^)]*\)$/, '');
            type = ($selectedOption.data('type') || '').toString().toLowerCase();
        } else {
            name = 'Any';
        }

        applyPromptSelection(fieldHandle, id, name, type);

        modalInstance.hide();

        const $settingsForm = $('#ai-assistant-settings-form');
        if ($settingsForm.length) {
            Craft.cp.displayNotice('Saving settings...');
            $settingsForm.submit();
        } else {
            Craft.cp.displayNotice('Prompt selection updated. Please save the settings form to persist this change.');
        }
    });

    // Save new prompt form handler
    $modal.on('submit', '#prompt-edit-form', (e) => {
        e.preventDefault();
        savePromptFromModal(e, $modal, modalInstance);
        return false;
    });

    $modal.on('click', '#save-prompt-btn', (e) => {
        e.preventDefault();
        savePromptFromModal(e, $modal, modalInstance);
        return false;
    });

    // Close modal
    $modal.on('click', '[data-close-modal]', () => modalInstance.hide());

    // Show prompt details when selection changes
    $modal.on('change', '[data-existing-select], #prompt-existing-select', (ev) => {
        const $target = $(ev.currentTarget);
        const id = $target.val() || '';

        if ($saveSelectedBtn.length) $saveSelectedBtn.show();

        if (id && $detailsSection.length) {
            loadPromptDetails($modal, id);
        } else if ($detailsSection.length) {
            $detailsSection.hide();
        }
    });
}

/**
 * Load modal integrations
 */
async function loadModalIntegrations($integrationSelect) {
    if (!$integrationSelect.length) return;

    try {
        const integrations = await loadIntegrations();
        $integrationSelect.empty();
        if (integrations && integrations.length) {
            $integrationSelect.append('<option value="">Use default (Any)</option>');
            integrations.forEach((integration) => {
                $integrationSelect.append(`<option value="${integration.handle}">${integration.name}</option>`);
            });
        } else {
            $integrationSelect.append('<option value="">No integrations available</option>');
        }

        try { 
            if (typeof Craft.initUiElements === 'function') Craft.initUiElements($integrationSelect.closest('.field')); 
        } catch (e) {}
    } catch (error) {
        $integrationSelect.empty().append('<option value="">Failed to load integrations</option>');
    }
}

/**
 * Load prompt details
 */
async function loadPromptDetails($modal, promptId) {
    if (!promptId) return;
    const $detailsSection = $modal.find('#prompt-details-section');
    if (!$detailsSection.length) return;

    try {
        const prompts = await loadPrompts();
        const prompt = Array.isArray(prompts)
            ? prompts.find(p => String(p.id) === String(promptId))
            : null;

        if (!prompt) {
            $detailsSection.hide();
            return;
        }

        $modal.find('#prompt-details-name').text(prompt.name || '');
        const $typeBadge = $modal.find('#prompt-details-type');
        const prettyType = prompt.type ? prompt.type.charAt(0).toUpperCase() + prompt.type.slice(1) : '';
        $typeBadge.text(prettyType);
        $typeBadge.attr('class', `ai-assistant-type-badge ai-assistant-type-${prompt.type || 'any'}`);

        const integrationText = prompt.integrationHandle ? prompt.integrationHandle : 'Default';
        $modal.find('#prompt-details-integration').text(`Integration: ${integrationText}`);

        $modal.find('#prompt-details-text').text(prompt.promptText || '');
        $detailsSection.show();
    } catch (error) {
        $detailsSection.hide();
    }
}

/**
 * Save prompt from modal
 */
async function savePromptFromModal(e, $modal, modalInstance) {
    e.preventDefault();

    const name = $modal.find('#modal-name').val();
    const type = ($modal.find('#modal-type').val() || '').toString();
    const promptText = $modal.find('#modal-promptText').val();
    const integrationHandle = $modal.find('#modal-integration').val() || '';
    const fieldHandle = $modal.data('fieldHandle');

    if (!fieldHandle) {
        Craft.cp.displayError('Field handle not found. Cannot save prompt selection.');
        return false;
    }

    try {
        const response = await savePrompt({ name, type, promptText, integrationHandle });
        
        if (response && response.success && response.prompt) {
            const p = response.prompt;
            const promptId = String(p.id);

            applyPromptSelection(fieldHandle, promptId, p.name, p.type);

            if (modalInstance) modalInstance.hide();

            const $settingsForm = $('#ai-assistant-settings-form');
            if ($settingsForm.length) {
                Craft.cp.displayNotice('Prompt saved and settings updated. Saving...');
                $settingsForm.submit();
            } else {
                Craft.cp.displayNotice('Prompt saved. Please save the settings form to persist this change.');
            }
        } else {
            Craft.cp.displayError(response?.error || 'Save failed');
        }
    } catch (error) {
        Craft.cp.displayError('Save failed');
    }

    return false;
}

/**
 * Apply prompt selection to field
 */
export function applyPromptSelection(fieldHandle, id, name, type) {
    if (!fieldHandle) return false;

    const inputName = `settings[fieldPrompts][${fieldHandle}]`;
    let hidden = document.querySelector(`input[name="${inputName}"]`);

    if (!hidden) {
        hidden = document.querySelector(`input[data-prompt-value="${fieldHandle}"]`);
    }

    if (!hidden) {
        console.error('Could not find hidden input for field:', fieldHandle);
        return false;
    }

    const promptId = id ? String(id) : '';
    hidden.value = promptId;
    $(hidden).trigger('change');

    // Find chip container
    let chipContainer = null;

    if (hidden.previousElementSibling && hidden.previousElementSibling.classList?.contains(CONFIG.cssClass.chipContainer)) {
        chipContainer = hidden.previousElementSibling;
    } else {
        let sib = hidden.previousElementSibling;
        while (sib) {
            if (sib.classList && sib.classList.contains(CONFIG.cssClass.chipContainer)) {
                chipContainer = sib;
                break;
            }
            sib = sib.previousElementSibling;
        }
    }

    if (!chipContainer) {
        const $row = $(hidden).closest('tr');
        if ($row.length) {
            chipContainer = $row.find(`.${CONFIG.cssClass.chipContainer}`).get(0);
        }
    }

    if (!chipContainer) {
        const all = qsa(`.${CONFIG.cssClass.chipContainer}`);
        for (let i = 0; i < all.length; i++) {
            const chip = all[i];
            const foundHidden = chip.parentElement?.querySelector(`input[name="${inputName}"]`);
            if (foundHidden === hidden) {
                chipContainer = chip;
                break;
            }
        }
    }

    if (!chipContainer) {
        console.error('Could not find chip container for field:', fieldHandle, 'Hidden input:', hidden);
        return false;
    }

    // Update badge inside chip
    const badge = chipContainer.querySelector(`.${CONFIG.cssClass.typeBadge}`);
    if (badge) {
        badge.textContent = promptId ? name : 'Any';
        const typeClass = promptId ? `ai-assistant-type-${(type || 'any')}` : 'ai-assistant-type-any';
        badge.className = `${CONFIG.cssClass.typeBadge} ${typeClass}`;
        return true;
    }

    return false;
}


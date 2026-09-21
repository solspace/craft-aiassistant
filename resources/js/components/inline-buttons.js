/**
 * Initialize AI buttons for existing and dynamically rendered Craft fields.
 */
import { CONFIG } from '../utils/config.js';
import { qsa } from '../utils/dom.js';
import { getFieldHandle, isFieldEnabled } from '../utils/field.js';
import { attachButtonToField } from './button.js';

export function attachInlineButtons(onOpen) {
    qsa(CONFIG.selectors.fields).forEach((inputEl) => {
        const field = inputEl.closest(CONFIG.selectors.field);
        if (!field || !isFieldEnabled(getFieldHandle(field))) return;
        attachButtonToField(inputEl, onOpen);
    });
}

export function initializeInlineButtons(onOpen) {
    let observer;
    let pending;
    const attach = () => attachInlineButtons(onOpen);
    const start = () => {
        attach();
        observer = new MutationObserver((mutations) => {
            const hasNewFields = mutations.some(({ addedNodes }) =>
                Array.from(addedNodes).some((node) =>
                    node.nodeType === 1 && (
                        node.matches(CONFIG.selectors.fields) ||
                        node.matches('.ai-assistant-field') ||
                        node.querySelector(CONFIG.selectors.fields)
                    )
                )
            );
            if (!hasNewFields || pending !== undefined) return;
            // Batch Craft's input/editor initialization mutations into one scan.
            pending = setTimeout(() => {
                pending = undefined;
                attach();
            }, 0);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
    document.addEventListener('click', attach);

    return () => {
        document.removeEventListener('DOMContentLoaded', start);
        document.removeEventListener('click', attach);
        observer?.disconnect();
        clearTimeout(pending);
    };
}

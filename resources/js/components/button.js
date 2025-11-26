/**
 * Inline Button Component
 * Creates and manages inline AI assistant buttons
 */

import { CONFIG } from '../utils/config.js';
import { qs } from '../utils/dom.js';

/**
 * Create AI button element
 */
export function createAiButtonElement() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = 'AI Assistant';
    btn.setAttribute('aria-label', 'AI Assistant');
    btn.className = CONFIG.cssClass.inlineButton;

    Object.assign(btn.style, {
        position: 'absolute',
        right: CONFIG.button.position.right,
        top: CONFIG.button.position.top,
        width: CONFIG.button.size,
        height: CONFIG.button.size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid var(--hairline-color, #e5e7eb)',
        borderRadius: '6px',
        background: 'var(--ui-control-bg, #fff)',
        cursor: 'pointer',
        zIndex: '2',
        padding: '3px',
        lineHeight: '1'
    });

    // SVG icon (kept inline for portability)
    btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" viewBox="0 0 30 30">
            <path fill="#111" d="m14.2 19.7-1 2.6c-.5 1-1.9 1-2.3 0l-1.1-2.6q-1.6-3.5-5-5l-3-1.4c-1-.4-1-1.9 0-2.3l2.9-1.3q3.5-1.6 5-5.2L11 1.8c.4-1 1.8-1 2.2 0l1.1 2.7q1.6 3.6 5.1 5.2l3 1.3c1 .4 1 1.9 0 2.3l-3 1.4q-3.5 1.5-5 5m10.1 8.1-.4.8c-.2.5-1 .5-1.2 0l-.4-.8a6 6 0 0 0-3-3.1l-1-.5a.7.7 0 0 1 0-1.3l1-.4a6 6 0 0 0 3-3.2l.4-.9c.2-.5 1-.5 1.2 0l.4.9a6 6 0 0 0 3 3.2l1 .4q.9.7 0 1.3l-1 .5a6 6 0 0 0-3 3.1"/>
        </svg>
    `;

    return btn;
}

/**
 * Ensure input has padding for button
 */
export function ensureInputPaddingForButton(inputEl) {
    try {
        if (inputEl.tagName === 'INPUT' && inputEl.type === 'text') {
            const computed = window.getComputedStyle(inputEl);
            const right = parseInt(computed.paddingRight || '0', 10) || 0;
            if (right < CONFIG.button.paddingRight) {
                inputEl.style.paddingRight = `${CONFIG.button.paddingRight}px`;
            }
        }
    } catch (err) {
        // Fail silently — styling enhancement only
    }
}

/**
 * Attach button to field
 */
export function attachButtonToField(inputEl, onClick) {
    if (!inputEl || inputEl.dataset.aiassistantBtn) return;

    const field = inputEl.closest(CONFIG.selectors.field);
    if (!field) return;

    // Prevent duplicate button in the same input wrapper
    const inputWrapper = inputEl.closest(CONFIG.selectors.inputWrapper);
    if (!inputWrapper) return;
    if (qs(`.${CONFIG.cssClass.inlineButton}`, inputWrapper)) return;

    // mark as processed
    inputEl.dataset.aiassistantBtn = '1';

    // ensure wrapper is positioned so absolute child positions correctly
    if (!inputWrapper.style.position) {
        inputWrapper.style.position = 'relative';
    }

    ensureInputPaddingForButton(inputEl);

    const btn = createAiButtonElement();
    btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        try { btn.blur(); } catch (e) { /* ignore */ }
        if (onClick) onClick(field);
    });

    inputWrapper.appendChild(btn);
}


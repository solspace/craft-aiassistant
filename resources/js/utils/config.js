/**
 * Configuration Constants
 */

export const CONFIG = {
    selectors: {
        fields: [
            '.field .input input[type="text"]:not(.hidden)',
            '.field .input textarea:not(.hidden)',
            '.field .ck-editor',
            '.field .tinymce'
        ].join(', '),
        inputWrapper: '.input',
        field: '.field'
    },
    button: {
        size: '22px',
        paddingRight: 26,
        position: { right: '6px', top: '6px' }
    },
    cssClass: {
        inlineButton: 'aiassistant-inline-btn',
        typeBadge: 'ai-assistant-type-badge',
        chipContainer: 'ai-prompts-chip'
    }
};

export const MODAL_CONFIG = {
    options: {
        resizable: false,
        closeOnEsc: true, 
        shade: true,
        shadeCloseOnClick: true,
        autoShow: true,
        hideOnEsc: true,
        hideOnShadeClick: true
    },
    focusDelay: 100
};


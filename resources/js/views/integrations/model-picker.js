const OTHER = '__custom__';
const PROVIDERS = ['openai', 'gemini', 'anthropic', 'xai'];

export function recommendModel(provider, models) {
    if (provider === 'gemini' && models.some((model) => model.id === 'gemini-flash-lite-latest')) {
        return 'gemini-flash-lite-latest';
    }
    const patterns = {
        openai: /^gpt-\d+(?:\.\d+)?-(?:luna|nano|mini)$/,
        gemini: /^gemini-\d+(?:\.\d+)?-flash-lite$/,
        anthropic: /^claude-haiku-\d+(?:-\d+)?(?:-\d{8})?$/,
    };
    const candidates = models.filter((model) => patterns[provider]?.test(model.id))
        .sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
    return candidates.find((model) => model.label.includes('(alias)'))?.id ?? candidates[0]?.id;
}

export function initializeModelPicker() {
    const picker = document.getElementById('aiassistant-model-picker');
    const modelInput = document.getElementById('model');
    const apiKey = document.getElementById('apiKey');
    const provider = document.getElementById('type');
    const refresh = document.getElementById('aiassistant-refresh-models');
    const status = document.getElementById('aiassistant-model-status');
    const customField = document.getElementById('aiassistant-custom-model-field');
    if (!picker || !modelInput || !apiKey || !provider || !refresh || !status || !customField || apiKey.disabled) return;
    if (picker.dataset.initialized) return;
    picker.dataset.initialized = '1';

    const translate = (text) => Craft.t('ai-assistant', text);
    const isNew = !document.querySelector('#integration-form input[name="id"]')?.value;
    let models = [];
    let userSelected = false;
    let showOther = false;
    let timer;
    let controller;
    let version = 0;

    function setModel(value) {
        modelInput.dataset.aiassistantProgrammatic = '1';
        modelInput.value = value;
        modelInput.setAttribute('initialvalue', value);
        modelInput.dispatchEvent(new Event('input', { bubbles: true }));
        modelInput.dataset.aiassistantProgrammatic = '0';
    }

    function render() {
        const value = modelInput.value.trim();
        const listed = models.some((model) => model.id === value);
        const custom = showOther || !listed;
        const options = models.map((model) => ({ value: model.id, text: model.label }));
        options.push({ value: OTHER, text: translate('Other / Custom model ID') });
        const selectize = picker.selectize;
        if (selectize) {
            selectize.clear(true);
            selectize.clearOptions();
            selectize.addOption(options);
            selectize.setValue(custom ? OTHER : value, true);
            selectize.refreshOptions(false);
        } else {
            picker.replaceChildren(...options.map((option) => {
                const element = document.createElement('option');
                element.value = option.value;
                element.textContent = option.text;
                return element;
            }));
            picker.value = custom ? OTHER : value;
        }
        customField.hidden = !custom;
        modelInput.required = custom;
    }

    function cancel() {
        clearTimeout(timer);
        controller?.abort();
        version++;
    }

    function schedule(immediate = false) {
        cancel();
        models = [];
        render();
        const supported = PROVIDERS.includes(provider.value);
        refresh.disabled = !supported || !apiKey.value.trim();
        status.textContent = !supported
            ? translate('Enter a custom model ID for this provider.')
            : !apiKey.value.trim()
                ? translate('Enter an API key to load available models.')
                : translate('Loading models…');
        if (refresh.disabled) return;
        const requestVersion = version;
        timer = setTimeout(async () => {
            controller = new AbortController();
            refresh.disabled = true;
            try {
                const response = await fetch(Craft.getCpUrl('ai-assistant/integrations/models'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-CSRF-Token': Craft.csrfTokenValue,
                    },
                    body: JSON.stringify({ provider: provider.value, apiKey: apiKey.value }),
                    signal: controller.signal,
                });
                if (!response.ok) throw new Error('Could not load models');
                const result = await response.json();
                if (version !== requestVersion) return;
                models = Array.isArray(result.models)
                    ? result.models.filter((model) => typeof model.id === 'string' && typeof model.label === 'string')
                    : [];
                if (result.available && isNew && !userSelected && !showOther) {
                    const recommended = recommendModel(provider.value, models);
                    if (recommended) setModel(recommended);
                }
                status.textContent = !result.available
                    ? translate('Could not load models. You can still enter a custom model ID.')
                    : !models.length
                        ? translate('No compatible models were returned. You can enter a custom model ID.')
                        : '';
                render();
            } catch {
                if (version !== requestVersion) return;
                status.textContent = translate('Could not load models. You can still enter a custom model ID.');
            } finally {
                if (version === requestVersion) refresh.disabled = false;
            }
        }, immediate ? 0 : 500);
    }

    const selectModel = () => {
        userSelected = true;
        showOther = picker.value === OTHER;
        if (!showOther) setModel(picker.value);
        render();
    };
    // Craft's Selectize control emits jQuery change events.
    if (window.jQuery) {
        window.jQuery(picker).on('change', selectModel);
    } else {
        picker.addEventListener('change', selectModel);
    }
    modelInput.addEventListener('input', () => {
        if (modelInput.dataset.aiassistantProgrammatic !== '1') {
            userSelected = true;
            showOther = true;
        }
    });
    apiKey.addEventListener('input', () => schedule());
    apiKey.addEventListener('change', () => schedule());
    provider.addEventListener('change', () => {
        userSelected = false;
        showOther = false;
        schedule();
    });
    refresh.addEventListener('click', () => schedule(true));
    window.addEventListener('pagehide', cancel, { once: true });
    schedule();
}

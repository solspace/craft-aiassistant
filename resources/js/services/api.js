/**
 * API Service
 * Handles all API calls to the backend
 */

/**
 * Load integrations from API
 */
export async function loadIntegrations() {
    try {
        const response = await fetch(Craft.getCpUrl('ai-assistant/api/integrations'), {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });
        const result = await response.json();
        
        if (result.success && result.integrations) {
            return result.integrations;
        }
        return [];
    } catch (error) {
        console.error('Failed to load integrations:', error);
        return [];
    }
}

/**
 * Load prompts from API
 */
export async function loadPrompts(filterType = null) {
    try {
        const url = filterType 
            ? Craft.getCpUrl('ai-assistant/api/prompts', { type: filterType })
            : Craft.getCpUrl('ai-assistant/api/prompts');
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });
        const result = await response.json();

        if (result.success && result.prompts) {
            let prompts = result.prompts;
            // Filter by type if specified (client-side fallback)
            if (filterType) {
                prompts = prompts.filter(p => (p.type || '').toLowerCase() === filterType.toLowerCase());
            }
            return prompts;
        }
        return [];
    } catch (error) {
        console.error('Failed to load prompts:', error);
        return [];
    }
}

/**
 * Generate text via API
 */
export async function generateText(params) {
    const { promptText, integrationHandle, fieldType, assetId, assetUrl, naturalTone } = params;
    
    try {
        const body = {
            promptText,
            integration: integrationHandle,
            fieldType
        };
        
        if (assetId) body.assetId = assetId;
        if (assetUrl) body.assetUrl = assetUrl;
        if (naturalTone !== undefined) {
            body.options = body.options || {};
            body.options.naturalTone = naturalTone;
        }
        
        const response = await fetch(Craft.getCpUrl('ai-assistant/api/generate-text'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-Token': Craft.csrfTokenValue
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`API Error: ${response.status} - ${text}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        throw error;
    }
}

/**
 * Generate image via API
 */
export async function generateImage(params) {
    const { prompt, integration, size, count, assetTarget, assetId, assetUrl, dryRun, promptName } = params;
    
    try {
        const body = {
            prompt,
            integration,
            count: count || 1,
            assetTarget,
            options: {},
            dryRun: dryRun !== false
        };
        
        if (size) body.size = size;
        if (assetId) body.assetId = assetId;
        if (assetUrl) body.assetUrl = assetUrl;
        if (promptName) body.promptName = promptName;
        
        const response = await fetch(Craft.getCpUrl('ai-assistant/api/generate-image'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-Token': Craft.csrfTokenValue
            },
            body: JSON.stringify(body)
        });

        const result = await response.json();
        return result;
    } catch (error) {
        throw error;
    }
}

/**
 * Save image to assets via API
 */
export async function saveImageToAssets(urls, assetTarget, title) {
    try {
        const response = await fetch(Craft.getCpUrl('ai-assistant/api/save-image-to-assets'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-Token': Craft.csrfTokenValue
            },
            body: JSON.stringify({
                urls,
                assetTarget,
                title: title || ''
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        throw error;
    }
}

/**
 * Save prompt via API
 */
export async function savePrompt(promptData) {
    try {
        const response = await fetch(Craft.getCpUrl('ai-assistant/settings/save-prompt'), {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-Token': Craft.csrfTokenValue
            },
            body: JSON.stringify(promptData)
        });
        
        const result = await response.json();
        return result;
    } catch (error) {
        throw error;
    }
}

/**
 * Fetch modal HTML
 */
export async function fetchModalHtml(url) {
    const response = await fetch(url, { 
        headers: { 'Accept': 'text/html' } 
    });
    
    if (!response.ok) {
        throw new Error('Failed to load modal');
    }
    
    return await response.text();
}


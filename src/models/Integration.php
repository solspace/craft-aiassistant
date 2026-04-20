<?php

namespace Solspace\AIAssistant\models;

use Craft;
use craft\base\Model;

class Integration extends Model
{
    public ?int $id = null;
    public ?string $uid = null;
    public bool $enabled = true;
    public string $handle = '';
    public string $name = '';
    public string $type = '';
    public string $class = '';
    public string $metadata = '';
    public ?string $dateCreated = null;
    public ?string $dateUpdated = null;

    // Integration-specific properties
    public string $apiKey = '';
    public string $model = '';
    public int $maxTokens = 0; // 0 = use provider default
    public string $temperature = '0.7';

    /** SolspaceAI: LiteLLM base URL (e.g. https://ai.solspace.net/v1). */
    public string $apiBaseUrl = '';

    /** SolspaceAI: contact email sent to enable-ai. */
    public string $contactEmail = '';

    /** SolspaceAI: public site URL sent to enable-ai. */
    public string $siteUrl = '';

    public function rules(): array
    {
        return [
            [['handle', 'name', 'type', 'class'], 'required'],
            [['enabled'], 'boolean'],
            // Allow 0 to mean "unspecified/optional" so we can omit for models that don't support it
            [['maxTokens'], 'integer', 'min' => 0, 'max' => 4000000],
            [['temperature'], 'number', 'min' => 0.0, 'max' => 2.0],
            [['id'], 'integer'],
            [['apiKey', 'model', 'metadata', 'apiBaseUrl', 'contactEmail', 'siteUrl'], 'string'],
        ];
    }

    public function attributeLabels(): array
    {
        return [
            'id' => 'ID',
            'uid' => 'UID',
            'enabled' => 'Enabled',
            'handle' => 'Handle',
            'name' => 'Name',
            'type' => 'Type',
            'class' => 'Class',
            'metadata' => 'Metadata',
            'dateCreated' => 'Date Created',
            'dateUpdated' => 'Date Updated',
            'apiKey' => 'API Key',
            'model' => 'Model',
            'maxTokens' => 'Max Tokens',
            'temperature' => 'Temperature',
            'apiBaseUrl' => 'API Base URL',
            'contactEmail' => 'Contact Email',
            'siteUrl' => 'Site URL',
        ];
    }

    public function getTypeOptions(): array
    {
        return [
            'openai' => 'OpenAI',
            'gemini' => 'Google Gemini',
            'anthropic' => 'Anthropic',
            'xai' => 'xAI',
            'replicate' => 'Replicate',
            'solspaceai' => 'SolspaceAI',
        ];
    }

    public function getModelOptions(): array
    {
        $models = [
            'openai' => [
                'gpt-3.5-turbo' => 'GPT-3.5 Turbo',
                'gpt-4' => 'GPT-4',
                'gpt-4-turbo' => 'GPT-4 Turbo',
                'gpt-4o' => 'GPT-4o',
                'gpt-4o-mini' => 'GPT-4o Mini',
            ],
            'gemini' => [
                'gemini-pro' => 'Gemini Pro',
                'gemini-pro-vision' => 'Gemini Pro Vision',
                'gemini-1.5-pro' => 'Gemini 1.5 Pro',
                'gemini-1.5-flash' => 'Gemini 1.5 Flash',
            ],
            'anthropic' => [
                'claude-3-5-haiku-latest' => 'Claude 3.5 Haiku',
                'claude-3-5-sonnet-latest' => 'Claude 3.5 Sonnet',
                'claude-3-7-sonnet-latest' => 'Claude 3.7 Sonnet',
                'claude-3-7-haiku-latest' => 'Claude 3.7 Haiku',
            ],
            'xai' => [
                'grok-3-mini' => 'Grok 3 Mini',
                'grok-3-full' => 'Grok 3 Full',
            ],
            'solspaceai' => [
                '' => Craft::t('ai-assistant', 'Server default (LiteLLM)'),
            ],
            'replicate' => [
                'black-forest-labs/flux-kontext-pro' => 'FLUX Kontext Pro',
                'black-forest-labs/flux-1.1-pro' => 'FLUX.1.1 Pro',
                'black-forest-labs/flux-1.1-pro-ultra' => 'FLUX.1.1 Pro Ultra',
                'black-forest-labs/flux-dev' => 'FLUX Dev',
                'black-forest-labs/flux-schnell' => 'FLUX Schnell',
                'stability-ai/sdxl' => 'Stable Diffusion XL',
                'stability-ai/stable-diffusion' => 'Stable Diffusion 1.5',
                'ideogram-ai/ideogram-v3-turbo' => 'Ideogram V3 Turbo',
                'ideogram-ai/ideogram-v3' => 'Ideogram V3',
                'google/imagen-4-fast' => 'Google Imagen 4 Fast',
                'google/imagen-4' => 'Google Imagen 4',
                'bytedance/seedream-4' => 'Seedream 4',
                'recraft-ai/recraft-v3-svg' => 'Recraft V3 SVG',
                'recraft-ai/recraft-v3' => 'Recraft V3',
            ],
        ];

        return $models[$this->type] ?? [];
    }

    public function getImageModelOptions(): array
    {
        $models = [
            'openai' => [
                'dall-e-2' => 'DALL-E 2',
                'dall-e-3' => 'DALL-E 3',
            ],
            'gemini' => [
                'gemini-pro-vision' => 'Gemini Pro Vision',
                'gemini-1.5-pro' => 'Gemini 1.5 Pro',
            ],
            'anthropic' => [
                'claude-3-5-haiku-latest' => 'Claude 3.5 Haiku',
                'claude-3-5-sonnet-latest' => 'Claude 3.5 Sonnet',
                'claude-3-7-sonnet-latest' => 'Claude 3.7 Sonnet',
                'claude-3-7-haiku-latest' => 'Claude 3.7 Haiku',
            ],
            'xai' => [
                'grok-3-mini' => 'Grok 3 Mini',
                'grok-3-full' => 'Grok 3 Full',
            ],
            'replicate' => [
                'black-forest-labs/flux-kontext-pro' => 'FLUX Kontext Pro',
                'black-forest-labs/flux-1.1-pro' => 'FLUX.1.1 Pro',
                'black-forest-labs/flux-1.1-pro-ultra' => 'FLUX.1.1 Pro Ultra',
                'black-forest-labs/flux-dev' => 'FLUX Dev',
                'black-forest-labs/flux-schnell' => 'FLUX Schnell',
                'stability-ai/sdxl' => 'Stable Diffusion XL',
                'stability-ai/stable-diffusion' => 'Stable Diffusion 1.5',
                'ideogram-ai/ideogram-v3-turbo' => 'Ideogram V3 Turbo',
                'ideogram-ai/ideogram-v3' => 'Ideogram V3',
                'google/imagen-4-fast' => 'Google Imagen 4 Fast',
                'google/imagen-4' => 'Google Imagen 4',
                'bytedance/seedream-4' => 'Seedream 4',
                'recraft-ai/recraft-v3-svg' => 'Recraft V3 SVG',
                'recraft-ai/recraft-v3' => 'Recraft V3',
            ],
        ];

        return $models[$this->type] ?? [];
    }
}

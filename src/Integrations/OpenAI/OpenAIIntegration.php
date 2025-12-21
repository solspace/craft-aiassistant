<?php

namespace Solspace\AIAssistant\Integrations\OpenAI;

use craft\helpers\UrlHelper;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Solspace\AIAssistant\Integrations\BaseAiIntegration;

class OpenAIIntegration extends BaseAiIntegration
{
    protected const LOG_CATEGORY = 'OpenAI';
    protected string $siteUrl = '';

    public function getApiRootUrl(): string
    {
        return 'https://api.openai.com/v1';
    }

    public function checkConnection(Client $client): bool
    {
        try {
            $response = $client->get($this->getEndpoint('/models'), [
                'headers' => [
                    'Authorization' => 'Bearer '.$this->getApiKey(),
                ],
            ]);
            $data = json_decode((string) $response->getBody(), true);

            return isset($data['data']) && \is_array($data['data']);
        } catch (\Exception $e) {
            $this->log('Connection check failed: '.$e->getMessage());

            return false;
        }
    }

    public function processTextRequest(string $prompt, array $options = []): array
    {
        try {
            $client = new Client([
                'headers' => [
                    'Authorization' => 'Bearer '.$this->getApiKey(),
                    'Content-Type' => 'application/json',
                ],
            ]);

            // Determine system instructions based on field type
            $fieldType = $options['fieldType'] ?? 'input';
            $systemInstructions = $this->getSystemInstructions($fieldType, $options);

            $messages = [];
            if ($systemInstructions) {
                $messages[] = [
                    'role' => 'system',
                    'content' => $systemInstructions,
                ];
            }
            $messages[] = [
                'role' => 'user',
                'content' => $prompt,
            ];

            $model = $options['model'] ?? $this->getModel();
            $payload = [
                'model' => $model,
                'messages' => $messages,
            ];

            // Only include max_tokens if explicitly set (>0); some models reject it
            $configuredMax = $options['max_tokens'] ?? $this->getMaxTokens();
            if (is_numeric($configuredMax) && (int) $configuredMax > 0) {
                $payload['max_tokens'] = (int) $configuredMax;
            }

            // Temperature: include if present (non-null)
            $temperature = $options['temperature'] ?? $this->getTemperature();
            if (null !== $temperature) {
                $payload['temperature'] = $temperature;
            }

            $response = $client->post($this->getEndpoint('/chat/completions'), [
                'json' => $payload,
            ]);

            $data = json_decode((string) $response->getBody(), true);

            return [
                'success' => true,
                'content' => $data['choices'][0]['message']['content'] ?? '',
                'usage' => $data['usage'] ?? null,
                'model' => $data['model'] ?? $this->getModel(),
            ];
        } catch (RequestException $e) {
            $this->log('OpenAI API Error: '.$e->getMessage());

            return [
                'success' => false,
                'error' => 'OpenAI API Error: '.$e->getMessage(),
            ];
        }
    }

    public function processImageRequest(string $prompt, array $options = []): array
    {
        // If an input image is present, use the Edits endpoint (Image API)
        if (!empty($options['assetId']) || !empty($options['assetUrl'])) {
            return $this->processImageEdit($prompt, $options);
        }

        // Otherwise, generate from scratch
        try {
            $client = new Client([
                'headers' => [
                    'Authorization' => 'Bearer '.$this->getApiKey(),
                    'Content-Type' => 'application/json',
                ],
            ]);

            $payload = [
                'model' => $options['model'] ?? $this->getModel(),
                'prompt' => $prompt,
                'n' => 1,
                'size' => $options['size'] ?? '1024x1024',
                // quality/style are supported by some models; include if provided
            ];
            if (!empty($options['quality'])) {
                $payload['quality'] = $options['quality'];
            }
            if (!empty($options['background'])) {
                $payload['background'] = $options['background'];
            }
            if (!empty($options['style'])) {
                $payload['style'] = $options['style'];
            }

            $response = $client->post($this->getEndpoint('/images/generations'), [
                'json' => $payload,
            ]);

            $data = json_decode((string) $response->getBody(), true);

            return [
                'success' => true,
                'imageUrl' => $data['data'][0]['url'] ?? '',
                'revisedPrompt' => $data['data'][0]['revised_prompt'] ?? $prompt,
                'model' => $data['data'][0]['model'] ?? ($options['model'] ?? $this->getModel()),
            ];
        } catch (RequestException $e) {
            $this->log('OpenAI Image API Error: '.$e->getMessage());

            return [
                'success' => false,
                'error' => 'OpenAI Image API Error: '.$e->getMessage(),
            ];
        }
    }

    public function processTranslateRequest(string $text, string $targetLanguage, array $options = []): array
    {
        $prompt = "Translate the following text to {$targetLanguage}:\n\n{$text}";

        return $this->processTextRequest($prompt, $options);
    }

    public function getTemperature(): ?float
    {
        return null;
    }

    private function processImageEdit(string $prompt, array $options = []): array
    {
        $model = $options['model'] ?? $this->getModel() ?? 'gpt-image-1';

        if (false !== stripos($model, 'dall-e-3')) {
            return [
                'success' => false,
                'error' => 'DALL·E 3 does not support image edits. Use gpt-image-1 or dall-e-2.',
            ];
        }

        $assetDetails = $this->getAssetStreamUrlDetails((int) $options['assetId']);
        if (!$assetDetails['success']) {
            return ['success' => false, 'error' => $assetDetails['error']];
        }
        $imageUrl = $assetDetails['url'];
        $mimeType = $assetDetails['mimeType'];
        $filename = $assetDetails['filename'];
        $contents = fopen($imageUrl, 'r');
        if (!$contents) {
            return ['success' => false, 'error' => 'Could not open image file.'];
        }

        try {
            $client = new Client([
                'headers' => ['Authorization' => 'Bearer '.$this->getApiKey()],
                'timeout' => 120,
            ]);

            $multipart = [
                ['name' => 'model', 'contents' => $model],
                ['name' => 'prompt', 'contents' => $prompt],
                ['name' => 'n', 'contents' => '1'],
                [
                    'name' => 'image',
                    'contents' => $contents,
                    'filename' => $filename,
                    'headers' => ['Content-Type' => $mimeType],
                ],
            ];

            if (!empty($options['size'])) {
                $multipart[] = ['name' => 'size', 'contents' => $options['size']];
            }

            $resp = $client->post($this->getEndpoint('/images/edits'), ['multipart' => $multipart]);
            $data = json_decode((string) $resp->getBody(), true);
            $out = $data['data'][0] ?? [];

            $finalUrl = $out['url'] ?? ($out['b64_json'] ? 'data:image/png;base64,'.$out['b64_json'] : null);
            if (!$finalUrl) {
                return ['success' => false, 'error' => 'OpenAI did not return an image URL.'];
            }

            return [
                'success' => true,
                'imageUrl' => $finalUrl,
                'revisedPrompt' => $out['revised_prompt'] ?? $prompt,
                'model' => $model,
            ];
        } catch (RequestException $e) {
            $this->log('OpenAI Image Edit API Error: '.$e->getMessage());

            return ['success' => false, 'error' => 'OpenAI Image Edit API Error: '.$e->getMessage()];
        }
    }

    private function getAssetStreamUrlDetails(int $assetId): ?array
    {
        $asset = \Craft::$app->getAssets()->getAssetById($assetId);
        if (!$asset) {
            return ['success' => false, 'error' => 'Asset not found.'];
        }

        $expiry = time() + 600;
        $securityKey = (string) (\Craft::$app->getConfig()->getGeneral()->securityKey ?? '');
        if (!$securityKey) {
            return ['success' => false, 'error' => 'Security key not configured.'];
        }

        $sig = hash_hmac('sha256', "{$asset->id}:{$expiry}", $securityKey);

        $baseUrl = $this->siteUrl ?: UrlHelper::siteUrl();
        $baseUrl = rtrim($baseUrl, '/');

        return [
            'success' => true,
            'url' => "{$baseUrl}/ai-assistant/api/public-stream-asset?id={$asset->id}&expiry={$expiry}&sig={$sig}",
            'mimeType' => $asset->mimeType,
            'filename' => $asset->filename,
        ];
    }
}

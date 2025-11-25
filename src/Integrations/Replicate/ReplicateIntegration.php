<?php

namespace Solspace\AIAssistant\Integrations\Replicate;

use craft\helpers\UrlHelper;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Solspace\AIAssistant\Integrations\BaseAiIntegration;

class ReplicateIntegration extends BaseAiIntegration
{
    protected const LOG_CATEGORY = 'Replicate';
    protected const DEFAULT_MODEL = 'black-forest-labs/flux-1.1-pro';

    protected string $siteUrl = '';

    public function getApiRootUrl(): string
    {
        return 'https://api.replicate.com/v1';
    }

    public function checkConnection(Client $client): bool
    {
        try {
            $url = $this->getEndpoint('/models/'.self::DEFAULT_MODEL);
            $response = $client->get($url, [
                'headers' => ['Authorization' => 'Token '.$this->getApiKey()],
                'timeout' => 10,
            ]);

            return $response->getStatusCode() >= 200 && $response->getStatusCode() < 300;
        } catch (\Throwable $e) {
            $this->log('Replicate connection failed: '.$e->getMessage());

            return false;
        }
    }

    public function processTextRequest(string $prompt, array $options = []): array
    {
        return [
            'success' => false,
            'error' => 'Text generation is not supported by Replicate integration.',
        ];
    }

    public function processImageRequest(string $prompt, array $options = []): array
    {
        $apiKey = $this->getApiKey();
        $model = $this->getModel() ?? self::DEFAULT_MODEL;
        $size = !empty($options['size']) ? (string) $options['size'] : '1024x1024';
        $assetUrl = $options['assetUrl'] ?? null;
        $assetId = $options['assetId'] ?? null;

        $inputs = ['prompt' => $prompt];
        $modelConfig = $this->getModelConfig($model);
        $hasInputImage = ($assetUrl || $assetId);

        // Handle input image
        if ($hasInputImage) {
            $url = $assetUrl ?: $this->getAssetStreamUrl((int) $assetId);
            if (!$url) {
                return ['success' => false, 'error' => 'Unable to resolve asset URL'];
            }
            $inputs[$modelConfig['imageParam']] = $url;
        }

        // Handle size parameters
        if (preg_match('/^(\d+)x(\d+)$/', $size, $m)) {
            $this->applySizeParameters($inputs, (int) $m[1], (int) $m[2], $modelConfig, $hasInputImage);
        }

        // Prepare a debug copy of inputs to return for diagnostics (no API keys)
        $debugInputs = $inputs;

        // Set strength parameter (if supported)
        if ($modelConfig['supportsStrength']) {
            $inputs['strength'] = $options['strength'] ?? 0.3;
        }

        try {
            $client = new Client([
                'headers' => [
                    'Authorization' => 'Bearer '.$apiKey,
                    'Content-Type' => 'application/json',
                    'Prefer' => 'wait=60', // Try synchronous mode for quick models
                ],
                'timeout' => 90,
            ]);

            $endpoint = $this->getEndpoint('/models/'.$model.'/predictions');

            $response = $client->post($endpoint, [
                'json' => ['input' => $inputs],
            ]);

            $data = json_decode((string) $response->getBody(), true);
            $output = $data['output'] ?? null;

            // If async, poll until done
            if (!$output && !empty($data['id'])) {
                $output = $this->pollPrediction($client, $apiKey, $data['id']);
            }

            if (empty($output)) {
                return ['success' => false, 'error' => 'No image returned from Replicate'];
            }

            $imageUrl = \is_array($output) ? ($output[0] ?? null) : $output;

            return [
                'success' => true,
                'imageUrl' => $imageUrl,
                'model' => $model,
                'revisedPrompt' => $prompt,
                'sentInputs' => $debugInputs,
            ];
        } catch (RequestException $e) {
            return ['success' => false, 'error' => 'Replicate API Error: '.$e->getMessage(), 'sentInputs' => $debugInputs ?? null];
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => 'Unexpected error: '.$e->getMessage(), 'sentInputs' => $debugInputs ?? null];
        }
    }

    public function processTranslateRequest(string $text, string $targetLanguage, array $options = []): array
    {
        return [
            'success' => false,
            'error' => 'Translate is not supported by Replicate integration.',
        ];
    }

    private function pollPrediction(Client $client, string $apiKey, string $predictionId): ?string
    {
        $url = $this->getEndpoint('/predictions/'.$predictionId);
        $deadline = time() + 180; // 3 min max

        while (time() < $deadline) {
            $resp = $client->get($url, [
                'headers' => ['Authorization' => 'Bearer '.$apiKey],
                'timeout' => 15,
            ]);

            $data = json_decode((string) $resp->getBody(), true);
            $status = $data['status'] ?? '';

            if ('succeeded' === $status) {
                $output = $data['output'] ?? null;

                return \is_array($output) ? ($output[0] ?? null) : $output;
            }

            if (\in_array($status, ['failed', 'canceled'], true)) {
                return null;
            }

            usleep(500_000); // wait 0.5s between checks
        }

        return null;
    }

    private function getModelConfig(string $model): array
    {
        // Flux models
        if (str_contains($model, 'flux-1.1-pro') && !str_contains($model, 'ultra')) {
            return [
                'imageParam' => 'input_image',
                'sizeMode' => 'custom_with_aspect',
                'multiple' => 32,
                'minSize' => 256,
                'maxSize' => 1440,
                'supportsStrength' => true,
            ];
        }

        if (str_contains($model, 'flux-1.1-pro-ultra')) {
            return [
                'imageParam' => 'input_image',
                'sizeMode' => 'aspect_ratio_only',
                'supportsStrength' => true,
            ];
        }

        if (str_contains($model, 'flux')) {
            // Other Flux variants (flux-dev, flux-schnell, etc.)
            return [
                'imageParam' => 'input_image',
                'sizeMode' => 'aspect_ratio_only',
                'supportsStrength' => true,
            ];
        }

        // Stable Diffusion models
        if (str_contains($model, 'sdxl')) {
            return [
                'imageParam' => 'image',
                'sizeMode' => 'direct',
                'multiple' => 8,
                'minSize' => 256,
                'maxSize' => 2048,
                'supportsStrength' => false,
            ];
        }

        if (str_contains($model, 'stable-diffusion')) {
            return [
                'imageParam' => 'image',
                'sizeMode' => 'direct',
                'multiple' => 8,
                'minSize' => 256,
                'maxSize' => 1024,
                'supportsStrength' => false,
            ];
        }

        // Ideogram models
        if (str_contains($model, 'ideogram')) {
            return [
                'imageParam' => 'image',
                'sizeMode' => 'aspect_ratio_only',
                'supportsStrength' => false,
            ];
        }

        // Google Imagen models
        if (str_contains($model, 'imagen')) {
            return [
                'imageParam' => 'image',
                'sizeMode' => 'aspect_ratio_only',
                'supportsStrength' => false,
            ];
        }

        // ByteDance Seedream models
        if (str_contains($model, 'seedream')) {
            return [
                'imageParam' => 'input_image',
                'sizeMode' => 'aspect_ratio_only',
                'supportsStrength' => true,
            ];
        }

        // Recraft models
        if (str_contains($model, 'recraft')) {
            return [
                'imageParam' => 'image',
                'sizeMode' => 'aspect_ratio_only',
                'supportsStrength' => false,
            ];
        }

        // Playground AI models
        if (str_contains($model, 'playground')) {
            return [
                'imageParam' => 'image',
                'sizeMode' => 'direct',
                'multiple' => 8,
                'minSize' => 256,
                'maxSize' => 2048,
                'supportsStrength' => false,
            ];
        }

        // Midjourney alternatives
        if (str_contains($model, 'midjourney') || str_contains($model, 'mj')) {
            return [
                'imageParam' => 'image',
                'sizeMode' => 'aspect_ratio_only',
                'supportsStrength' => false,
            ];
        }

        // Default fallback for unknown models
        return [
            'imageParam' => 'input_image',
            'sizeMode' => 'direct',
            'multiple' => 8,
            'minSize' => 256,
            'maxSize' => 2048,
            'supportsStrength' => true,
        ];
    }

    private function applySizeParameters(array &$inputs, int $width, int $height, array $config, bool $hasInputImage): void
    {
        // Skip size for img2img mode when model doesn't support it
        if ($hasInputImage && 'custom_with_aspect' === $config['sizeMode']) {
            return;
        }

        if ('aspect_ratio_only' === $config['sizeMode']) {
            $inputs['aspect_ratio'] = $this->calculateAspectRatio($width, $height);

            return;
        }

        // Apply width/height with rounding and bounds
        $inputs['width'] = $this->normalizeDimension($width, $config);
        $inputs['height'] = $this->normalizeDimension($height, $config);

        // Set aspect_ratio for Flux Pro custom mode
        if ('custom_with_aspect' === $config['sizeMode']) {
            $inputs['aspect_ratio'] = 'custom';
        }
    }

    private function normalizeDimension(int $dimension, array $config): int
    {
        $multiple = $config['multiple'] ?? 8;
        $normalized = (int) (round($dimension / $multiple) * $multiple);

        return max($config['minSize'] ?? 256, min($config['maxSize'] ?? 2048, $normalized));
    }

    private function calculateAspectRatio(int $width, int $height): string
    {
        // Calculate GCD to simplify ratio
        $gcd = function ($a, $b) use (&$gcd) {
            return 0 === $b ? $a : $gcd($b, $a % $b);
        };

        $divisor = $gcd($width, $height);
        $w = $width / $divisor;
        $h = $height / $divisor;

        // Common aspect ratios
        $commonRatios = [
            [1, 1, '1:1'],
            [4, 3, '4:3'],
            [3, 4, '3:4'],
            [16, 9, '16:9'],
            [9, 16, '9:16'],
            [21, 9, '21:9'],
            [9, 21, '9:21'],
        ];

        // Check if it matches a common ratio (within tolerance)
        foreach ($commonRatios as [$cw, $ch, $ratio]) {
            if (abs($w / $h - $cw / $ch) < 0.01) {
                return $ratio;
            }
        }

        // Return simplified ratio
        return "{$w}:{$h}";
    }

    private function getAssetStreamUrl(int $assetId): ?string
    {
        $asset = \Craft::$app->getAssets()->getAssetById($assetId);
        if (!$asset) {
            return null;
        }

        $expiry = time() + 600;
        $securityKey = (string) (\Craft::$app->getConfig()->getGeneral()->securityKey ?? '');
        if (!$securityKey) {
            return null;
        }

        $sig = hash_hmac('sha256', "{$asset->id}:{$expiry}", $securityKey);

        $baseUrl = $this->siteUrl ?: UrlHelper::siteUrl();
        $baseUrl = rtrim($baseUrl, '/');

        return "{$baseUrl}/ai-assistant/api/public-stream-asset?id={$asset->id}&expiry={$expiry}&sig={$sig}";
    }
}

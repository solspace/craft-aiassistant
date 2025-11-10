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
        $size = $options['size'] ?? '1024x1024';
        $assetUrl = $options['assetUrl'] ?? null;
        $assetId = $options['assetId'] ?? null;

        $inputs = ['prompt' => $prompt];

        // Parse image size (e.g., "1024x1024")
        if (preg_match('/^(\d+)x(\d+)$/', $size, $m)) {
            $inputs['width'] = (int) $m[1];
            $inputs['height'] = (int) $m[2];
        }

        // Handle input image (Flux uses 'input_image')
        if ($assetUrl || $assetId) {
            $url = $assetUrl ?: $this->getAssetStreamUrl((int) $assetId);
            if (!$url) {
                return ['success' => false, 'error' => 'Unable to resolve asset URL'];
            }
            $inputs['input_image'] = $url;
        }

        // Default strength (Flux models support this)
        $inputs['strength'] = $options['strength'] ?? 0.3;

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
            ];
        } catch (RequestException $e) {
            return ['success' => false, 'error' => 'Replicate API Error: '.$e->getMessage()];
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => 'Unexpected error: '.$e->getMessage()];
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

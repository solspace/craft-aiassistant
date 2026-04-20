<?php

namespace Solspace\AIAssistant\services;

use Craft;
use craft\base\Component;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Solspace\AIAssistant\Integrations\Anthropic\AnthropicIntegration;
use Solspace\AIAssistant\Integrations\Gemini\GeminiIntegration;
use Solspace\AIAssistant\Integrations\OpenAI\OpenAIIntegration;
use Solspace\AIAssistant\Integrations\Replicate\ReplicateIntegration;
use Solspace\AIAssistant\Integrations\SolspaceAI\SolspaceAIIntegration;
use Solspace\AIAssistant\Integrations\xAI\xAIIntegration;
use Solspace\AIAssistant\models\Integration;
use Solspace\AIAssistant\records\IntegrationRecord;

class IntegrationService extends Component
{
    private array $integrationClasses = [
        'openai' => OpenAIIntegration::class,
        'gemini' => GeminiIntegration::class,
        'anthropic' => AnthropicIntegration::class,
        'xai' => xAIIntegration::class,
        'replicate' => ReplicateIntegration::class,
        'solspaceai' => SolspaceAIIntegration::class,
    ];

    public function getAllIntegrations(): array
    {
        $records = IntegrationRecord::find()
            ->orderBy(['name' => \SORT_ASC])
            ->all()
        ;

        $integrations = [];
        foreach ($records as $record) {
            $integrations[] = $this->recordToModel($record);
        }

        return $integrations;
    }

    public function getEnabledIntegrations(): array
    {
        $records = IntegrationRecord::find()
            ->where(['enabled' => true])
            ->orderBy(['name' => \SORT_ASC])
            ->all()
        ;

        $integrations = [];
        foreach ($records as $record) {
            $integrations[] = $this->recordToModel($record);
        }

        return $integrations;
    }

    public function getIntegrationById(int $id): ?Integration
    {
        $record = IntegrationRecord::findOne($id);

        return $record ? $this->recordToModel($record) : null;
    }

    public function getIntegrationByHandle(string $handle): ?Integration
    {
        $record = IntegrationRecord::findOne(['handle' => $handle]);

        return $record ? $this->recordToModel($record) : null;
    }

    public function saveIntegration(Integration $integration): bool
    {
        if ($integration->id) {
            $record = IntegrationRecord::findOne($integration->id);
            if (!$record) {
                return false;
            }
        } else {
            $record = new IntegrationRecord();
        }

        $record->enabled = $integration->enabled;
        $record->handle = $integration->handle;
        $record->name = $integration->name;
        $record->type = $integration->type;
        $record->class = $integration->class;
        $record->metadata = json_encode([
            'apiKey' => $integration->apiKey,
            'model' => $integration->model,
            'maxTokens' => $integration->maxTokens,
            'temperature' => $integration->temperature,
            'apiBaseUrl' => $integration->apiBaseUrl,
            'contactEmail' => $integration->contactEmail,
            'siteUrl' => $integration->siteUrl,
        ]);

        $ok = $record->save();
        if ($ok) {
            $integration->id = (int) $record->id;
            $integration->uid = (string) $record->uid;
        }

        return $ok;
    }

    public function deleteIntegration(int $id): bool
    {
        $record = IntegrationRecord::findOne($id);

        return $record ? $record->delete() : false;
    }

    public function testIntegration(Integration $integration): array
    {
        return $this->testConnection($integration);
    }

    public function testConnection(Integration $integration): array
    {
        $integrationClass = $this->integrationClasses[$integration->type] ?? null;
        if (!$integrationClass) {
            return [
                'success' => false,
                'message' => 'Unknown integration type: '.$integration->type,
            ];
        }

        try {
            $aiIntegration = $this->instantiateIntegration($integrationClass, $integration);

            $client = new Client();
            $isConnected = $aiIntegration->checkConnection($client);

            if ($isConnected) {
                return [
                    'success' => true,
                    'message' => Craft::t('ai-assistant', 'Connection successful!'),
                ];
            }

            if ('solspaceai' === $integration->type && $aiIntegration instanceof SolspaceAIIntegration) {
                return [
                    'success' => false,
                    'message' => $this->diagnoseSolspaceAiConnection($aiIntegration),
                ];
            }

            return [
                'success' => false,
                'message' => Craft::t('ai-assistant', 'Connection failed. Please check your API key and settings.'),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => Craft::t('ai-assistant', 'Test failed: {msg}', ['msg' => $e->getMessage()]),
            ];
        }
    }

    private function diagnoseSolspaceAiConnection(SolspaceAIIntegration $sol): string
    {
        $key = trim($sol->getApiKey());
        if ('' === $key) {
            return Craft::t(
                'ai-assistant',
                'SolspaceAI has no API key yet. Save contact email and site URL, then click “Connect to SolspaceAI”.'
            );
        }

        $url = rtrim($sol->getApiRootUrl(), '/').'/models';

        try {
            $client = new Client(['timeout' => 20, 'http_errors' => false]);
            $response = $client->get($url, [
                'headers' => [
                    'Authorization' => 'Bearer '.$key,
                ],
            ]);
            $status = $response->getStatusCode();
            if (200 !== $status) {
                return Craft::t(
                    'ai-assistant',
                    'SolspaceAI returned HTTP {code} from {url}. If this site runs in DDEV or Docker, set the API base URL to an address PHP can reach (host “localhost” often does not reach LiteLLM on your machine).',
                    ['code' => (string) $status, 'url' => $url]
                );
            }

            $data = json_decode((string) $response->getBody(), true);
            if (!\is_array($data) || !isset($data['data']) || !\is_array($data['data'])) {
                return Craft::t(
                    'ai-assistant',
                    'SolspaceAI responded from {url} but the models list was not in the expected format. Check LiteLLM and your reverse proxy.',
                    ['url' => $url]
                );
            }

            return Craft::t(
                'ai-assistant',
                'SolspaceAI returned a models list but the integration check still failed. Try reconnecting from the edit screen.'
            );
        } catch (\Throwable $e) {
            return Craft::t(
                'ai-assistant',
                'Could not reach SolspaceAI at {url}: {msg}',
                ['url' => $url, 'msg' => $e->getMessage()]
            );
        }
    }

    public function processRequest(string $integrationHandle, string $type, string $prompt, array $options = []): array
    {
        $integration = $this->getIntegrationByHandle($integrationHandle);
        if (!$integration) {
            return [
                'success' => false,
                'error' => 'Integration not found: '.$integrationHandle.'. Please create an integration first.',
            ];
        }

        if (!$integration->enabled) {
            return [
                'success' => false,
                'error' => 'Integration is disabled: '.$integrationHandle,
            ];
        }

        $integrationClass = $this->integrationClasses[$integration->type] ?? null;
        if (!$integrationClass) {
            return [
                'success' => false,
                'error' => 'Unknown integration type: '.$integration->type,
            ];
        }

        try {
            $aiIntegration = $this->instantiateIntegration($integrationClass, $integration);

            switch ($type) {
                case 'text':
                    return $aiIntegration->processTextRequest($prompt, $options);

                case 'image':
                    return $aiIntegration->processImageRequest($prompt, $options);

                case 'translate':
                    $targetLanguage = $options['targetLanguage'] ?? 'English';

                    return $aiIntegration->processTranslateRequest($prompt, $targetLanguage, $options);

                default:
                    return [
                        'success' => false,
                        'error' => 'Unknown request type: '.$type,
                    ];
            }
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => 'Request failed: '.$e->getMessage(),
            ];
        }
    }

    /**
     * Exchange AI Assistant Craft license for a SolspaceAI virtual API key (enable-ai).
     *
     * @return array{success: bool, message: string}
     */
    public function connectSolspaceAi(Integration $integration, bool $force = false): array
    {
        if ('solspaceai' !== $integration->type) {
            return ['success' => false, 'message' => 'Not a SolspaceAI integration.'];
        }

        if (!$force && '' !== trim((string) $integration->apiKey)) {
            return ['success' => true, 'message' => Craft::t('ai-assistant', 'Already connected to SolspaceAI.')];
        }

        $contact = trim((string) $integration->contactEmail);
        $site = $this->normalizeSolspaceAiSiteUrl((string) $integration->siteUrl);
        if ('' === $contact || '' === $site) {
            return [
                'success' => false,
                'message' => 'Contact email and site URL are required before connecting to SolspaceAI.',
            ];
        }
        if (!filter_var($site, FILTER_VALIDATE_URL)) {
            return [
                'success' => false,
                'message' => Craft::t(
                    'ai-assistant',
                    'Enter a valid public site URL with a scheme, e.g. `https://yoursite.com` (not just `yoursite.com`).'
                ),
            ];
        }

        $plugin = Craft::$app->plugins->getPlugin('ai-assistant');
        if (!$plugin) {
            return ['success' => false, 'message' => 'AI Assistant plugin is not available.'];
        }

        $licenseKey = Craft::$app->plugins->getPluginLicenseKey($plugin->id);
        if (empty($licenseKey)) {
            return ['success' => false, 'message' => 'Add your AI Assistant license key in Craft → Settings → Plugins first.'];
        }

        $base = rtrim($integration->apiBaseUrl ?: 'https://ai.solspace.net/v1', '/');
        $url = $base.'/ai-assistant/enable-ai';

        try {
            $client = new Client(['timeout' => 20]);
            $response = $client->post($url, [
                'json' => [
                    'license_key' => $licenseKey,
                    'contact_email' => $contact,
                    'site_url' => $site,
                    'plugin_handle' => 'ai-assistant',
                ],
                'http_errors' => false,
            ]);
        } catch (GuzzleException $e) {
            return ['success' => false, 'message' => 'Could not reach SolspaceAI: '.$e->getMessage()];
        }

        $status = $response->getStatusCode();
        $body = (string) $response->getBody();
        $data = json_decode($body, true);

        if (201 !== $status) {
            $detail = $body;
            if (\is_array($data) && \array_key_exists('detail', $data)) {
                $d = $data['detail'];
                if (\is_string($d)) {
                    $detail = $d;
                } elseif (\is_array($d)) {
                    $detail = json_encode($d, JSON_UNESCAPED_UNICODE) ?: $body;
                } else {
                    $detail = (string) $d;
                }
            }

            return ['success' => false, 'message' => 'SolspaceAI: '.$detail];
        }

        $apiKey = \is_array($data) ? ($data['api_key'] ?? '') : '';
        if ('' === $apiKey) {
            return ['success' => false, 'message' => 'SolspaceAI did not return an API key.'];
        }

        $integration->apiKey = $apiKey;
        $integration->siteUrl = $site;

        if (!$this->saveIntegration($integration)) {
            return ['success' => false, 'message' => 'Received API key but could not save the integration.'];
        }

        return ['success' => true, 'message' => 'Connected to SolspaceAI.'];
    }

    public function getAvailableModels(string $type): array
    {
        $models = [];
        foreach ($this->getEnabledIntegrations() as $integration) {
            if ('image' === $type) {
                $modelOptions = $integration->getImageModelOptions();
            } else {
                $modelOptions = $integration->getModelOptions();
            }

            foreach ($modelOptions as $value => $label) {
                $models[] = [
                    'value' => $value,
                    'label' => $label,
                    'integration' => $integration->handle,
                    'integrationName' => $integration->name,
                ];
            }
        }

        return $models;
    }

    private function recordToModel(IntegrationRecord $record): Integration
    {
        $integration = new Integration();
        $integration->id = $record->id;
        $integration->uid = $record->uid;
        $integration->enabled = $record->enabled;
        $integration->handle = $record->handle;
        $integration->name = $record->name;
        $integration->type = $record->type;
        $integration->class = $record->class;
        $integration->dateCreated = $record->dateCreated;
        $integration->dateUpdated = $record->dateUpdated;

        if ($record->metadata) {
            $metadata = json_decode($record->metadata, true);
            if (\is_array($metadata)) {
                $integration->apiKey = $metadata['apiKey'] ?? '';
                $integration->model = $metadata['model'] ?? '';
                $integration->maxTokens = $metadata['maxTokens'] ?? 0; // 0 = use provider default
                $integration->temperature = $metadata['temperature'] ?? '0.7';
                $integration->apiBaseUrl = $metadata['apiBaseUrl'] ?? '';
                $integration->contactEmail = $metadata['contactEmail'] ?? '';
                $integration->siteUrl = $metadata['siteUrl'] ?? '';
            }
        }

        return $integration;
    }

    /**
     * SolspaceAI enable-ai expects an absolute http(s) URL (Pydantic HttpUrl).
     */
    private function normalizeSolspaceAiSiteUrl(string $raw): string
    {
        $raw = trim($raw);
        if ('' === $raw) {
            return '';
        }
        if (!preg_match('#^https?://#i', $raw)) {
            $raw = 'https://'.ltrim($raw, '/');
        }

        return $raw;
    }

    /**
     * @param class-string $integrationClass
     */
    private function instantiateIntegration(string $integrationClass, Integration $integration): object
    {
        if (SolspaceAIIntegration::class === $integrationClass) {
            $base = $integration->apiBaseUrl ?: 'https://ai.solspace.net/v1';

            return new SolspaceAIIntegration(
                $integration->id,
                $integration->uid,
                $integration->enabled,
                $integration->handle,
                $integration->name,
                $integration->apiKey,
                $integration->model,
                $integration->maxTokens,
                $integration->temperature,
                null,
                $base,
            );
        }

        return new $integrationClass(
            $integration->id,
            $integration->uid,
            $integration->enabled,
            $integration->handle,
            $integration->name,
            $integration->apiKey,
            $integration->model,
            $integration->maxTokens,
            $integration->temperature
        );
    }
}

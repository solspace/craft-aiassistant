<?php

namespace Solspace\AIAssistant\services;

use craft\base\Component;
use GuzzleHttp\Client;
use Solspace\AIAssistant\Integrations\Anthropic\AnthropicIntegration;
use Solspace\AIAssistant\Integrations\Gemini\GeminiIntegration;
use Solspace\AIAssistant\Integrations\OpenAI\OpenAIIntegration;
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
        ]);

        return $record->save();
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
                'error' => 'Unknown integration type: '.$integration->type,
            ];
        }

        try {
            $aiIntegration = new $integrationClass(
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

            $client = new Client();
            $isConnected = $aiIntegration->checkConnection($client);

            return [
                'success' => $isConnected,
                'message' => $isConnected ? 'Connection successful!' : 'Connection failed. Please check your API key and settings.',
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => 'Test failed: '.$e->getMessage(),
            ];
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
            $aiIntegration = new $integrationClass(
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
                $integration->maxTokens = $metadata['maxTokens'] ?? 1000;
                $integration->temperature = $metadata['temperature'] ?? '0.7';
            }
        }

        return $integration;
    }
}

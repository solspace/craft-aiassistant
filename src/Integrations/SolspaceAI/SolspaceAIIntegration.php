<?php

namespace Solspace\AIAssistant\Integrations\SolspaceAI;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Psr\Log\LoggerInterface;
use Solspace\AIAssistant\Integrations\BaseAiIntegration;

/**
 * OpenAI-compatible SolspaceAI (LiteLLM) backend; keys come from SolspaceAI enable-ai.
 */
class SolspaceAIIntegration extends BaseAiIntegration
{
    protected const LOG_CATEGORY = 'SolspaceAI';

    public function __construct(
        ?int $id,
        ?string $uid,
        bool $enabled,
        string $handle,
        string $name,
        string $apiKey = '',
        string $model = '',
        int $maxTokens = 0,
        string $temperature = '0.7',
        ?LoggerInterface $logger = null,
        protected string $apiBaseUrl = 'https://ai.solspace.net/v1',
    ) {
        parent::__construct($id, $uid, $enabled, $handle, $name, $apiKey, $model, $maxTokens, $temperature, $logger);
    }

    public function getApiRootUrl(): string
    {
        $base = rtrim($this->getProcessedValue($this->apiBaseUrl), '/');

        return $base;
    }

    public function checkConnection(Client $client): bool
    {
        if ('' === trim($this->getApiKey())) {
            return false;
        }

        try {
            $response = $client->get($this->getEndpoint('/models'), [
                'headers' => [
                    'Authorization' => 'Bearer '.$this->getApiKey(),
                ],
                'http_errors' => false,
            ]);
            $data = json_decode((string) $response->getBody(), true);

            return isset($data['data']) && \is_array($data['data']);
        } catch (\Exception $e) {
            $this->log('SolspaceAI connection check failed: '.$e->getMessage());

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

            $model = trim((string) ($options['model'] ?? $this->getModel()));
            if ('' === $model) {
                $model = 'gpt-4o-mini';
            }
            $payload = [
                'model' => $model,
                'messages' => $messages,
            ];

            $configuredMax = $options['max_tokens'] ?? $this->getMaxTokens();
            if (is_numeric($configuredMax) && (int) $configuredMax > 0) {
                $payload['max_tokens'] = (int) $configuredMax;
            }

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
                'model' => $data['model'] ?? $model,
            ];
        } catch (RequestException $e) {
            $this->log('SolspaceAI API Error: '.$e->getMessage());

            return [
                'success' => false,
                'error' => 'SolspaceAI API Error: '.$e->getMessage(),
            ];
        }
    }

    public function processImageRequest(string $prompt, array $options = []): array
    {
        return [
            'success' => false,
            'error' => 'Image generation is currently not available for SolspaceAI in the AI Assistant. Please use OpenAI or another image provider instead.',
        ];
    }

    public function processTranslateRequest(string $text, string $targetLanguage, array $options = []): array
    {
        $prompt = "Translate the following text to {$targetLanguage}:\n\n{$text}";

        return $this->processTextRequest($prompt, $options);
    }
}

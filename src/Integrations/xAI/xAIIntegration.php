<?php

namespace Solspace\AIAssistant\Integrations\xAI;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Solspace\AIAssistant\Integrations\BaseAiIntegration;

class xAIIntegration extends BaseAiIntegration
{
    protected const LOG_CATEGORY = 'xAI';

    public function getApiRootUrl(): string
    {
        return 'https://api.x.ai/v1';
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

            $payload = [
                'model' => $options['model'] ?? $this->getModel(),
                'messages' => $messages,
                'max_tokens' => $options['max_tokens'] ?? $this->getMaxTokens(),
                'temperature' => $options['temperature'] ?? $this->getTemperature(),
            ];

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
            $this->log('xAI API Error: '.$e->getMessage());

            return [
                'success' => false,
                'error' => 'xAI API Error: '.$e->getMessage(),
            ];
        }
    }

    public function processImageRequest(string $prompt, array $options = []): array
    {
        // xAI doesn't support image generation yet
        return [
            'success' => false,
            'error' => 'Image generation is not supported by xAI Grok.',
        ];
    }

    public function getTemperature(): ?float
    {
        // xAI integration does not use temperature by default
        return null;
    }

    public function processTranslateRequest(string $text, string $targetLanguage, array $options = []): array
    {
        $prompt = "Translate the following text to {$targetLanguage}:\n\n{$text}";

        return $this->processTextRequest($prompt, $options);
    }
}

<?php

namespace Solspace\AIAssistant\Integrations\Anthropic;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Solspace\AIAssistant\Integrations\BaseAiIntegration;

class AnthropicIntegration extends BaseAiIntegration
{
    protected const LOG_CATEGORY = 'Anthropic';

    public function getApiRootUrl(): string
    {
        return 'https://api.anthropic.com/v1';
    }

    public function checkConnection(Client $client): bool
    {
        try {
            $response = $client->post($this->getEndpoint('/messages'), [
                'headers' => [
                    'x-api-key' => $this->getApiKey(),
                    'Content-Type' => 'application/json',
                    'anthropic-version' => '2023-06-01',
                ],
                'json' => [
                    'model' => 'claude-3-haiku-20240307',
                    'max_tokens' => 10,
                    'messages' => [
                        [
                            'role' => 'user',
                            'content' => 'Hello'
                        ]
                    ]
                ],
            ]);
            
            return $response->getStatusCode() === 200;
        } catch (\Exception $e) {
            $this->log('Connection check failed: ' . $e->getMessage());
            return false;
        }
    }

    public function processTextRequest(string $prompt, array $options = []): array
    {
        try {
            $client = new Client([
                'headers' => [
                    'x-api-key' => $this->getApiKey(),
                    'Content-Type' => 'application/json',
                    'anthropic-version' => '2023-06-01',
                ],
            ]);

            // Determine system instructions based on field type
            $fieldType = $options['fieldType'] ?? 'input';
            $systemInstructions = $this->getSystemInstructions($fieldType);
            
            $messages = [];
            if ($systemInstructions) {
                $messages[] = [
                    'role' => 'user',
                    'content' => $systemInstructions . "\n\n" . $prompt,
                ];
            } else {
                $messages[] = [
                    'role' => 'user',
                    'content' => $prompt,
                ];
            }

            $payload = [
                'model' => $options['model'] ?? $this->getModel(),
                'max_tokens' => $options['max_tokens'] ?? $this->getMaxTokens(),
                'temperature' => $options['temperature'] ?? $this->getTemperature(),
                'messages' => $messages,
            ];

            $response = $client->post($this->getEndpoint('/messages'), [
                'json' => $payload,
            ]);

            $data = json_decode((string) $response->getBody(), true);

            return [
                'success' => true,
                'content' => $data['content'][0]['text'] ?? '',
                'usage' => $data['usage'] ?? null,
                'model' => $data['model'] ?? $this->getModel(),
            ];
        } catch (RequestException $e) {
            $this->log('Anthropic API Error: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => 'Anthropic API Error: ' . $e->getMessage(),
            ];
        }
    }

    public function processImageRequest(string $prompt, array $options = []): array
    {
        // Anthropic doesn't support image generation yet
        return [
            'success' => false,
            'error' => 'Image generation is not supported by Anthropic Claude.',
        ];
    }

    public function getTemperature(): ?float
    {
        // Anthropic integration does not use temperature by default
        return null;
    }

    public function processTranslateRequest(string $text, string $targetLanguage, array $options = []): array
    {
        $prompt = "Translate the following text to {$targetLanguage}:\n\n{$text}";
        return $this->processTextRequest($prompt, $options);
    }
}

<?php

namespace Solspace\AIAssistant\Integrations\OpenAI;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Solspace\AIAssistant\Integrations\BaseAiIntegration;

class OpenAIIntegration extends BaseAiIntegration
{
    protected const LOG_CATEGORY = 'OpenAI';

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
            $systemInstructions = $this->getSystemInstructions($fieldType);

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
        try {
            $client = new Client([
                'headers' => [
                    'Authorization' => 'Bearer '.$this->getApiKey(),
                    'Content-Type' => 'application/json',
                ],
            ]);

            $payload = [
                'model' => $options['model'] ?? 'dall-e-3',
                'prompt' => $prompt,
                'n' => 1,
                'size' => $options['size'] ?? '1024x1024',
                'quality' => $options['quality'] ?? 'standard',
                'style' => $options['style'] ?? 'natural',
            ];

            $response = $client->post($this->getEndpoint('/images/generations'), [
                'json' => $payload,
            ]);

            $data = json_decode((string) $response->getBody(), true);

            return [
                'success' => true,
                'imageUrl' => $data['data'][0]['url'] ?? '',
                'revisedPrompt' => $data['data'][0]['revised_prompt'] ?? $prompt,
                'model' => $data['data'][0]['model'] ?? 'dall-e-3',
            ];
        } catch (RequestException $e) {
            $this->log('OpenAI Image API Error: '.$e->getMessage());

            return [
                'success' => false,
                'error' => 'OpenAI Image API Error: '.$e->getMessage(),
            ];
        }
    }

    public function getTemperature(): ?float
    {
        // OpenAI usage in this integration does not require temperature
        return null;
    }

    public function processTranslateRequest(string $text, string $targetLanguage, array $options = []): array
    {
        $prompt = "Translate the following text to {$targetLanguage}:\n\n{$text}";

        return $this->processTextRequest($prompt, $options);
    }
}

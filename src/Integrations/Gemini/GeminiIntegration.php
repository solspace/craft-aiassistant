<?php

namespace Solspace\AIAssistant\Integrations\Gemini;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use Solspace\AIAssistant\Integrations\BaseAiIntegration;

class GeminiIntegration extends BaseAiIntegration
{
    protected const LOG_CATEGORY = 'Gemini';

    public function getApiRootUrl(): string
    {
        return 'https://generativelanguage.googleapis.com/v1beta';
    }

    public function checkConnection(Client $client): bool
    {
        try {
            $response = $client->get($this->getEndpoint('/models'), [
                'query' => [
                    'key' => $this->getApiKey(),
                ],
            ]);
            $data = json_decode((string) $response->getBody(), true);

            return isset($data['models']) && \is_array($data['models']);
        } catch (\Exception $e) {
            $this->log('Connection check failed: '.$e->getMessage());

            return false;
        }
    }

    public function processTextRequest(string $prompt, array $options = []): array
    {
        try {
            $client = new Client();

            // Determine system instructions based on field type
            $fieldType = $options['fieldType'] ?? 'input';
            $systemInstructions = $this->getSystemInstructions($fieldType);

            $contents = [];
            if ($systemInstructions) {
                $contents[] = [
                    'role' => 'user',
                    'parts' => [
                        [
                            'text' => $systemInstructions,
                        ],
                    ],
                ];
                $contents[] = [
                    'role' => 'model',
                    'parts' => [
                        [
                            'text' => 'I understand. I will generate content according to your instructions.',
                        ],
                    ],
                ];
            }
            $contents[] = [
                'role' => 'user',
                'parts' => [
                    [
                        'text' => $prompt,
                    ],
                ],
            ];

            $payload = [
                'contents' => $contents,
                'generationConfig' => [
                    'maxOutputTokens' => $options['max_tokens'] ?? $this->getMaxTokens(),
                    'temperature' => $options['temperature'] ?? $this->getTemperature(),
                ],
            ];

            $response = $client->post($this->getEndpoint('/models/'.($options['model'] ?? $this->getModel()).':generateContent'), [
                'query' => [
                    'key' => $this->getApiKey(),
                ],
                'json' => $payload,
            ]);

            $data = json_decode((string) $response->getBody(), true);

            return [
                'success' => true,
                'content' => $data['candidates'][0]['content']['parts'][0]['text'] ?? '',
                'usage' => $data['usageMetadata'] ?? null,
                'model' => $data['model'] ?? $this->getModel(),
            ];
        } catch (RequestException $e) {
            $this->log('Gemini API Error: '.$e->getMessage());

            return [
                'success' => false,
                'error' => 'Gemini API Error: '.$e->getMessage(),
            ];
        }
    }

    public function processImageRequest(string $prompt, array $options = []): array
    {
        try {
            $client = new Client();

            $payload = [
                'contents' => [
                    [
                        'parts' => [
                            [
                                'text' => $prompt,
                            ],
                        ],
                    ],
                ],
                'generationConfig' => [
                    'maxOutputTokens' => $options['max_tokens'] ?? $this->getMaxTokens(),
                    'temperature' => $options['temperature'] ?? $this->getTemperature(),
                ],
            ];

            $response = $client->post($this->getEndpoint('/models/'.($options['model'] ?? 'gemini-pro-vision').':generateContent'), [
                'query' => [
                    'key' => $this->getApiKey(),
                ],
                'json' => $payload,
            ]);

            $data = json_decode((string) $response->getBody(), true);

            return [
                'success' => true,
                'content' => $data['candidates'][0]['content']['parts'][0]['text'] ?? '',
                'usage' => $data['usageMetadata'] ?? null,
                'model' => $data['model'] ?? 'gemini-pro-vision',
            ];
        } catch (RequestException $e) {
            $this->log('Gemini API Error: '.$e->getMessage());

            return [
                'success' => false,
                'error' => 'Gemini API Error: '.$e->getMessage(),
            ];
        }
    }

    public function getTemperature(): float
    {
        $temp = (float) $this->temperature;

        // Validate and clamp to valid range
        if ($temp < 0.0) {
            return 0.0;
        }
        if ($temp > 2.0) {
            return 2.0;
        }

        return $temp;
    }

    public function processTranslateRequest(string $text, string $targetLanguage, array $options = []): array
    {
        $prompt = "Translate the following text to {$targetLanguage}:\n\n{$text}";

        return $this->processTextRequest($prompt, $options);
    }
}

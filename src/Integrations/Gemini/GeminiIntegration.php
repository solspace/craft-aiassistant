<?php

namespace Solspace\AIAssistant\Integrations\Gemini;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use Psr\Http\Message\ResponseInterface;
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
                'headers' => ['x-goog-api-key' => $this->getApiKey()],
            ]);
            $data = json_decode((string) $response->getBody(), true);

            return isset($data['models']) && \is_array($data['models']);
        } catch (\Exception $e) {
            $this->log('Connection check failed: '.$this->getErrorMessage($e));

            return false;
        }
    }

    public function processTextRequest(string $prompt, array $options = []): array
    {
        try {
            $client = $this->createClient();

            // Determine system instructions based on field type
            $fieldType = $options['fieldType'] ?? 'input';
            $systemInstructions = $this->getSystemInstructions($fieldType, $options);

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
                'generationConfig' => $this->getGenerationConfig($options),
            ];

            $response = $this->generateContent($client, $options['model'] ?? $this->getModel(), $payload);

            $data = json_decode((string) $response->getBody(), true);

            return [
                'success' => true,
                'content' => $data['candidates'][0]['content']['parts'][0]['text'] ?? '',
                'usage' => $data['usageMetadata'] ?? null,
                'model' => $data['model'] ?? $this->getModel(),
            ];
        } catch (GuzzleException $e) {
            $message = 'Gemini API Error: '.$this->getErrorMessage($e);
            $this->log($message);

            return [
                'success' => false,
                'error' => $message,
            ];
        }
    }

    public function processImageRequest(string $prompt, array $options = []): array
    {
        try {
            $client = $this->createClient();

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
                'generationConfig' => $this->getGenerationConfig($options),
            ];

            $response = $this->generateContent($client, $options['model'] ?? 'gemini-pro-vision', $payload);

            $data = json_decode((string) $response->getBody(), true);

            return [
                'success' => true,
                'content' => $data['candidates'][0]['content']['parts'][0]['text'] ?? '',
                'usage' => $data['usageMetadata'] ?? null,
                'model' => $data['model'] ?? 'gemini-pro-vision',
            ];
        } catch (GuzzleException $e) {
            $message = 'Gemini API Error: '.$this->getErrorMessage($e);
            $this->log($message);

            return [
                'success' => false,
                'error' => $message,
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

    protected function createClient(): Client
    {
        return \Craft::createGuzzleClient(['connect_timeout' => 5, 'timeout' => 30]);
    }

    protected function waitBeforeRetry(int $attempt): void
    {
        usleep((2 ** $attempt) * 1000000 + random_int(0, 250000));
    }

    private function getGenerationConfig(array $options): array
    {
        $config = ['temperature' => $options['temperature'] ?? $this->getTemperature()];
        $maxTokens = (int) ($options['max_tokens'] ?? $this->getMaxTokens());
        if ($maxTokens > 0) {
            $config['maxOutputTokens'] = $maxTokens;
        }

        return $config;
    }

    private function generateContent(Client $client, string $model, array $payload): ResponseInterface
    {
        // Older versions offered this ID without the required preview suffix.
        if ('gemini-3-flash' === $model) {
            $model = 'gemini-3-flash-preview';
        }

        for ($attempt = 0;; ++$attempt) {
            try {
                return $client->post($this->getEndpoint('/models/'.rawurlencode($model).':generateContent'), [
                    'headers' => ['x-goog-api-key' => $this->getApiKey()],
                    'json' => $payload,
                ]);
            } catch (RequestException $e) {
                $status = $e->getResponse()?->getStatusCode();
                if ($attempt >= 2 || !\in_array($status, [429, 500, 502, 503, 504], true)) {
                    throw $e;
                }

                $this->waitBeforeRetry($attempt);
            }
        }
    }

    private function getErrorMessage(\Throwable $exception): string
    {
        $response = $exception instanceof RequestException ? $exception->getResponse() : null;
        if ($response) {
            $data = json_decode((string) $response->getBody(), true);
            $message = $data['error']['message'] ?? null;
            if (!\is_string($message) || '' === trim($message)) {
                $message = $response->getReasonPhrase() ?: 'The provider could not process the request.';
            }
            $message = 'HTTP '.$response->getStatusCode().': '.$message;
        } else {
            // Exception strings may include request URLs, headers, or credentials.
            $message = 'Could not connect to Gemini. Please try again.';
        }

        $apiKey = $this->getApiKey();
        if ('' !== $apiKey) {
            $message = str_replace([$apiKey, rawurlencode($apiKey)], '[redacted]', $message);
        }

        return preg_replace('/([?&]key=)[^\s&"\x27<>]+/i', '$1[redacted]', $message) ?? $message;
    }
}

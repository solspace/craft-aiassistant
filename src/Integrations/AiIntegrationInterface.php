<?php

namespace Solspace\AIAssistant\Integrations;

use GuzzleHttp\Client;

interface AiIntegrationInterface
{
    public const CATEGORY_TEXT = 'text';
    public const CATEGORY_IMAGE = 'image';
    public const CATEGORY_TRANSLATE = 'translate';

    public function getApiKey(): string;

    public function getModel(): string;

    public function getMaxTokens(): int;

    public function getTemperature(): ?float;

    public function checkConnection(Client $client): bool;

    public function getApiRootUrl(): string;

    public function processTextRequest(string $prompt, array $options = []): array;

    public function processImageRequest(string $prompt, array $options = []): array;

    public function processTranslateRequest(string $text, string $targetLanguage, array $options = []): array;
}

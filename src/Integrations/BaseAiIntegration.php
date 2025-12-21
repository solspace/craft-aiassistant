<?php

namespace Solspace\AIAssistant\Integrations;

use craft\helpers\App;
use Psr\Log\LoggerInterface;

abstract class BaseAiIntegration implements AiIntegrationInterface
{
    protected const LOG_CATEGORY = 'AI';

    public function __construct(
        protected ?int $id,
        protected ?string $uid,
        protected bool $enabled,
        protected string $handle,
        protected string $name,
        protected string $apiKey = '',
        protected string $model = '',
        protected int $maxTokens = 0, // 0 = use provider default
        protected string $temperature = '0.7',
        protected ?LoggerInterface $logger = null,
    ) {}

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getUid(): ?string
    {
        return $this->uid;
    }

    public function setId(int $id): self
    {
        $this->id = $id;

        return $this;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function getHandle(): string
    {
        return $this->handle;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getApiKey(): string
    {
        return $this->getProcessedValue($this->apiKey);
    }

    public function getModel(): string
    {
        return (string) $this->getProcessedValue($this->model);
    }

    public function getMaxTokens(): int
    {
        return $this->maxTokens;
    }

    public function getTemperature(): ?float
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

    protected function getEndpoint(string $endpoint): string
    {
        $root = rtrim($this->getApiRootUrl(), '/');
        $endpoint = ltrim($endpoint, '/');

        return "{$root}/{$endpoint}";
    }

    protected function getProcessedValue(mixed $value): bool|string|null
    {
        return App::parseEnv($value);
    }

    protected function log(string $message, array $context = []): void
    {
        if ($this->logger) {
            $this->logger->log(static::LOG_CATEGORY, $message, $context);
        }
    }

    protected function getSystemInstructions(string $fieldType, array $options = []): ?string
    {
        $naturalTone = $options['naturalTone'] ?? true;

        $baseInstructions = '';

        switch ($fieldType) {
            case 'ckeditor':
            case 'tinymce':
                $baseInstructions = 'You generate content for rich text editors. Respond only with the content value, without quotes, code blocks, explanations, or additional formatting. Use proper HTML tags for formatting (e.g., <h1>, <h2>, <h3> for headers, <p> for paragraphs, <strong> for bold, <em> for italic, <ul><li> for lists, <a href=""> for links). If the text contains HTML tags, preserve them exactly as provided.';

                break;

            case 'input':
            case 'textarea':
            default:
                $baseInstructions = 'You generate text values for content management fields. Respond only with the content value, without quotes, code blocks, explanations, or formatting. Return plain text only, no HTML tags.';

                break;
        }

        if ($naturalTone) {
            $baseInstructions .= ' Write in a natural, conversational, and human-sounding tone. Avoid overly formal or robotic language. Use varied sentence structures and natural phrasing.';
        }

        return $baseInstructions;
    }
}

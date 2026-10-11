<?php

// Run with: php tests/gemini-integration.test.php
// Uses the real Guzzle MockHandler, without bootstrapping a Craft installation.
namespace craft\helpers {
    class App
    {
        public static function parseEnv(mixed $value): mixed
        {
            return \is_string($value) && str_starts_with($value, '$') ? getenv(substr($value, 1)) : $value;
        }
    }
}

namespace {
    require getenv('AI_ASSISTANT_TEST_AUTOLOAD') ?: __DIR__.'/../vendor/autoload.php';
    require __DIR__.'/../src/Integrations/AiIntegrationInterface.php';
    require __DIR__.'/../src/Integrations/BaseAiIntegration.php';
    require __DIR__.'/../src/Integrations/Gemini/GeminiIntegration.php';
    require __DIR__.'/../src/services/AiModelCatalog.php';

    use GuzzleHttp\Client;
    use GuzzleHttp\Exception\ConnectException;
    use GuzzleHttp\Handler\MockHandler;
    use GuzzleHttp\HandlerStack;
    use GuzzleHttp\Middleware;
    use GuzzleHttp\Psr7\Request;
    use GuzzleHttp\Psr7\Response;
    use Solspace\AIAssistant\Integrations\Gemini\GeminiIntegration;
    use Solspace\AIAssistant\services\AiModelCatalog;

    class Craft
    {
        public static HandlerStack $handler;

        public static function createGuzzleClient(array $options = []): Client
        {
            return new Client($options + ['handler' => self::$handler]);
        }
    }

    class TestGemini extends GeminiIntegration
    {
        public Client $client;
        public array $waits = [];
        public array $logs = [];

        protected function createClient(): Client
        {
            return $this->client;
        }

        protected function waitBeforeRetry(int $attempt): void
        {
            $this->waits[] = $attempt;
        }

        protected function log(string $message, array $context = []): void
        {
            $this->logs[] = $message;
        }
    }

    function check(bool $condition, string $message): void
    {
        if (!$condition) {
            throw new \RuntimeException($message);
        }
    }

    function client(array $responses, array &$history): Client
    {
        $history = [];
        $stack = HandlerStack::create(new MockHandler($responses));
        $stack->push(Middleware::history($history));
        Craft::$handler = $stack;

        return new Client(['handler' => $stack]);
    }

    function integration(Client $client, int $tokens = 0, string $model = 'gemini-3.5-flash-lite'): TestGemini
    {
        $integration = new TestGemini(null, null, true, 'gemini', 'Gemini', 'test-secret+key', $model, $tokens);
        $integration->client = $client;

        return $integration;
    }

    function success(): Response
    {
        return new Response(200, [], '{"candidates":[{"content":{"parts":[{"text":"Generated text"}]}}]}');
    }

    $tests = [];
    $tests['omits zero, blank, and null limits while preserving positive limits'] = function (): void {
        foreach ([[0, [], null], [0, ['max_tokens' => ''], null], [0, ['max_tokens' => null], null], [1024, [], 1024], [2048, ['max_tokens' => 0], null], [1024, ['max_tokens' => 512], 512]] as [$tokens, $options, $expected]) {
            $history = [];
            $integration = integration(client([success()], $history), $tokens);
            check($integration->processTextRequest('Test', $options)['success'], 'Generation failed');
            $config = json_decode((string) $history[0]['request']->getBody(), true)['generationConfig'];
            check(($config['maxOutputTokens'] ?? null) === $expected, 'Wrong token limit');
            check(isset($config['temperature']), 'Temperature was lost');
            check('' === $history[0]['request']->getUri()->getQuery(), 'Key leaked into URL');
            check('test-secret+key' === $history[0]['request']->getHeaderLine('x-goog-api-key'), 'Missing key header');
        }
    };
    $tests['applies token handling to image and translation paths'] = function (): void {
        foreach (['processImageRequest', 'processTranslateRequest'] as $method) {
            $history = [];
            $integration = integration(client([success()], $history));
            $result = 'processTranslateRequest' === $method ? $integration->$method('Text', 'French') : $integration->$method('Image');
            check($result['success'], 'Generation failed');
            $payload = json_decode((string) $history[0]['request']->getBody(), true);
            check(!isset($payload['generationConfig']['maxOutputTokens']), 'Zero limit was sent');
        }
    };
    $tests['returns full provider errors and redacts credentials in responses and logs'] = function (): void {
        $message = str_repeat('Detailed error. ', 50).' key=test-secret+key https://example.test/?key=another-secret&x=1';
        $history = [];
        $integration = integration(client([new Response(400, [], json_encode(['error' => ['message' => $message]]))], $history));
        $result = $integration->processTextRequest('Test');
        check(!$result['success'], 'Error reported as success');
        check(str_contains($result['error'], str_repeat('Detailed error. ', 50)), 'Provider error was truncated');
        check(!str_contains($result['error'], 'test-secret') && !str_contains($result['error'], 'another-secret'), 'Credential leaked');
        check([$result['error']] === $integration->logs, 'Unsafe or inconsistent logging');
        check(1 === \count($history), '400 was retried');
    };
    $tests['uses safe fallbacks for malformed JSON and connection failures'] = function (): void {
        foreach ([new Response(400, [], '<html>test-secret+key</html>'), new ConnectException('Network error ?key=test-secret+key', new Request('POST', 'https://example.test'))] as $response) {
            $history = [];
            $integration = integration(client([$response], $history));
            $result = $integration->processTextRequest('Test');
            check(!$result['success'] && !str_contains($result['error'], 'test-secret'), 'Unsafe fallback');
            check(!str_contains($result['error'], '<html>'), 'HTML error was exposed');
        }
    };
    $tests['retries temporary failures and returns recovered output'] = function (): void {
        $history = [];
        $integration = integration(client([new Response(503), new Response(503), success()], $history));
        check($integration->processTextRequest('Test')['content'] === 'Generated text', 'Retry failed to recover');
        check(3 === \count($history) && [0, 1] === $integration->waits, 'Wrong retry bounds');
    };
    $tests['stops after two retries and preserves the last full error'] = function (): void {
        $history = [];
        $response = new Response(503, [], json_encode(['error' => ['message' => 'This model is experiencing high demand.']]));
        $integration = integration(client([$response, $response, $response], $history));
        $result = $integration->processTextRequest('Test');
        check(!$result['success'] && str_contains($result['error'], 'high demand'), 'Final error was lost');
        check(3 === \count($history) && [0, 1] === $integration->waits, 'Unbounded retry');
    };
    $tests['fixes the previously suggested model ID without rewriting saved settings'] = function (): void {
        $history = [];
        $integration = integration(client([success()], $history), 0, 'gemini-3-flash');
        check($integration->processTextRequest('Test')['success'], 'Generation failed');
        check(str_contains($history[0]['request']->getUri()->getPath(), 'gemini-3-flash-preview:generateContent'), 'Preview suffix missing');
        check('gemini-3-flash' === $integration->getModel(), 'Saved setting was modified');
    };
    $tests['Gemini model discovery paginates and only adds verified aliases'] = function (): void {
        $history = [];
        client([
            new Response(200, [], json_encode(['models' => [['name' => 'models/gemini-3.5-flash-lite', 'displayName' => 'Flash Lite', 'supportedGenerationMethods' => ['generateContent']]], 'nextPageToken' => 'next'])),
            new Response(200, [], json_encode(['models' => [['name' => 'models/embedding', 'supportedGenerationMethods' => ['embedContent']]]])),
            new Response(200, [], json_encode(['supportedGenerationMethods' => ['generateContent']])),
            new Response(404),
            new Response(404),
        ], $history);
        $models = (new AiModelCatalog())->fetch('gemini', 'catalog-secret');
        check(['gemini-3.5-flash-lite', 'gemini-flash-lite-latest'] === array_column($models, 'id'), 'Unexpected model catalog');
        check(str_contains($history[1]['request']->getUri()->getQuery(), 'pageToken=next'), 'Pagination missing');
        check('catalog-secret' === $history[0]['request']->getHeaderLine('x-goog-api-key'), 'Missing catalog authorization');
    };
    $tests['OpenAI discovery resolves env keys and filters unsupported model families'] = function (): void {
        putenv('MODEL_TEST_KEY=catalog-secret');
        $history = [];
        client([new Response(200, [], json_encode(['data' => array_map(static fn ($id) => ['id' => $id], ['gpt-5.4-mini', 'gpt-image-1', 'text-embedding-3-small', 'gpt-4o-realtime-preview', 'gpt-5.4-pro'])]))], $history);
        $models = (new AiModelCatalog())->fetch('openai', '$MODEL_TEST_KEY');
        check(['gpt-5.4-mini'] === array_column($models, 'id'), 'Unsupported model offered');
        check('Bearer catalog-secret' === $history[0]['request']->getHeaderLine('Authorization'), 'Env key was not resolved');
    };
    $tests['Anthropic discovery paginates and confirms dateless aliases'] = function (): void {
        $history = [];
        client([
            new Response(200, [], json_encode(['data' => [['id' => 'claude-haiku-4-5-20251001']], 'has_more' => true, 'last_id' => 'claude-haiku-4-5-20251001'])),
            new Response(200, [], json_encode(['data' => [['id' => 'claude-sonnet-4-6']], 'has_more' => false])),
            new Response(200, [], json_encode(['id' => 'claude-haiku-4-5-20251001'])),
        ], $history);
        $models = (new AiModelCatalog())->fetch('anthropic', 'catalog-secret');
        check(\in_array('claude-haiku-4-5', array_column($models, 'id'), true), 'Verified alias missing');
        check(str_contains($history[1]['request']->getUri()->getQuery(), 'after_id='), 'Pagination missing');
        check('2023-06-01' === $history[0]['request']->getHeaderLine('anthropic-version'), 'Version header missing');
    };
    $tests['xAI discovery includes provider aliases and filters non-text output'] = function (): void {
        $history = [];
        client([new Response(200, [], json_encode(['models' => [
            ['id' => 'grok-4.1-fast', 'output_modalities' => ['text'], 'aliases' => ['grok-latest']],
            ['id' => 'grok-image', 'output_modalities' => ['image']],
        ]]))], $history);
        $models = (new AiModelCatalog())->fetch('xai', 'catalog-secret');
        check(['grok-4.1-fast', 'grok-latest'] === array_column($models, 'id'), 'Unexpected xAI models');
    };

    foreach ($tests as $name => $test) {
        $test();
        echo 'PASS '.$name."\n";
    }
    echo \count($tests)." PHP regression checks passed.\n";
}

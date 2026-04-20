<?php

namespace Solspace\AIAssistant\controllers;

use Craft;
use craft\web\Controller;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Solspace\AIAssistant\AiAssistant;
use Solspace\AIAssistant\assets\SolspaceAiAssetBundle;
use yii\web\Response;

class SolspaceAiController extends Controller
{
    protected array|bool|int $allowAnonymous = false;

    public function actionIndex(): Response
    {
        $this->registerTranslations();

        $integrationService = AiAssistant::getIntegrationService();
        $integrations = $integrationService->getAllIntegrations();

        $sol = null;
        foreach ($integrations as $i) {
            if ('solspaceai' === ($i->type ?? null)) {
                $sol = $i;
                break;
            }
        }

        $connected = $sol && $sol->enabled && '' !== trim((string) $sol->apiKey);

        if ($connected) {
            Craft::$app->getView()->registerAssetBundle(SolspaceAiAssetBundle::class);
        }

        return $this->renderTemplate('ai-assistant/solspaceai/index', [
            'integration' => $sol,
            'connected' => $connected,
        ]);
    }

    public function actionUsage(): Response
    {
        $this->requireAcceptsJson();

        $sol = $this->getConnectedSolspaceAiIntegration();
        if (!$sol) {
            return $this->asJson([
                'success' => false,
                'error' => Craft::t('ai-assistant', 'SolspaceAI is not connected.'),
            ]);
        }

        $licenseKey = $this->getAiAssistantLicenseKey();
        if ('' === $licenseKey) {
            return $this->asJson([
                'success' => false,
                'error' => Craft::t('ai-assistant', 'AI Assistant license key is missing in Craft.'),
            ]);
        }

        $base = rtrim((string) ($sol->apiBaseUrl ?: 'https://ai.solspace.net/v1'), '/');
        $url = $base.'/ai-assistant/usage?user_id='.rawurlencode($licenseKey);

        return $this->proxyJsonGet($url, Craft::t('ai-assistant', 'Failed to reach SolspaceAI usage service.'));
    }

    public function actionPlans(): Response
    {
        $this->requireAcceptsJson();

        $sol = $this->getConnectedSolspaceAiIntegration();
        if (!$sol) {
            return $this->asJson([
                'success' => false,
                'error' => Craft::t('ai-assistant', 'SolspaceAI is not connected.'),
            ]);
        }

        $request = Craft::$app->getRequest();
        $currency = $request->getQueryParam('currency');
        $locale = Craft::$app->locale->id;

        $params = ['locale' => $locale];
        if (\is_string($currency) && \in_array(strtolower($currency), ['eur', 'usd'], true)) {
            $params['currency'] = strtolower($currency);
        }

        $base = rtrim((string) ($sol->apiBaseUrl ?: 'https://ai.solspace.net/v1'), '/');
        $url = $base.'/ai-assistant/plans?'.http_build_query($params);

        return $this->proxyJsonGet($url, Craft::t('ai-assistant', 'Failed to reach SolspaceAI plans service.'));
    }

    public function actionCreateCheckoutSession(): Response
    {
        $this->requireAcceptsJson();
        $this->requirePostRequest();

        $sol = $this->getConnectedSolspaceAiIntegration();
        if (!$sol) {
            return $this->asJson([
                'success' => false,
                'error' => Craft::t('ai-assistant', 'SolspaceAI is not connected.'),
            ]);
        }

        $licenseKey = $this->getAiAssistantLicenseKey();
        if ('' === $licenseKey) {
            return $this->asJson([
                'success' => false,
                'error' => Craft::t('ai-assistant', 'AI Assistant license key is missing in Craft.'),
            ]);
        }

        $request = Craft::$app->getRequest();
        $rawBody = $request->getIsPost() ? json_decode($request->getRawBody(), true) : null;
        $body = \is_array($rawBody) ? $rawBody : [];

        $successUrl = $request->getBodyParam('success_url') ?: $request->getQueryParam('success_url') ?: ($body['success_url'] ?? null);
        $cancelUrl = $request->getBodyParam('cancel_url') ?: $request->getQueryParam('cancel_url') ?: ($body['cancel_url'] ?? null);
        if (empty($successUrl) || empty($cancelUrl)) {
            $this->response->statusCode = 400;

            return $this->asJson([
                'success' => false,
                'error' => Craft::t('ai-assistant', 'success_url and cancel_url are required.'),
            ]);
        }

        $base = rtrim((string) ($sol->apiBaseUrl ?: 'https://ai.solspace.net/v1'), '/');
        $url = $base.'/ai-assistant/create-checkout-session';

        $payload = array_filter([
            'license_key' => $licenseKey,
            'success_url' => $successUrl,
            'cancel_url' => $cancelUrl,
            'bundle_key' => $body['bundle_key'] ?? null,
            'currency' => $body['currency'] ?? null,
            'plugin_handle' => 'ai-assistant',
        ], static fn ($v) => $v !== null && $v !== '');

        try {
            $client = new Client(['timeout' => 20]);
            $resp = $client->post($url, [
                'json' => $payload,
                'headers' => ['Accept' => 'application/json', 'Content-Type' => 'application/json'],
                'http_errors' => false,
            ]);
        } catch (GuzzleException $e) {
            return $this->asJson([
                'success' => false,
                'error' => Craft::t('ai-assistant', 'Failed to reach SolspaceAI.'),
                'message' => $e->getMessage(),
            ]);
        }

        $this->response->statusCode = $resp->getStatusCode();
        $this->response->format = Response::FORMAT_RAW;
        $this->response->content = (string) $resp->getBody();
        $this->response->headers->set('Content-Type', 'application/json');

        return $this->response;
    }

    private function getConnectedSolspaceAiIntegration(): ?\Solspace\AIAssistant\models\Integration
    {
        $integrationService = AiAssistant::getIntegrationService();
        $integrations = $integrationService->getAllIntegrations();

        $sol = null;
        foreach ($integrations as $i) {
            if ('solspaceai' === ($i->type ?? null)) {
                $sol = $i;
                break;
            }
        }

        if (!$sol || !$sol->enabled || '' === trim((string) $sol->apiKey)) {
            return null;
        }

        return $sol;
    }

    private function getAiAssistantLicenseKey(): string
    {
        $plugin = Craft::$app->plugins->getPlugin('ai-assistant');
        $licenseKey = $plugin ? (string) Craft::$app->plugins->getPluginLicenseKey($plugin->id) : '';

        return trim($licenseKey);
    }

    private function proxyJsonGet(string $url, string $errorMessage): Response
    {
        try {
            $client = new Client(['timeout' => 20]);
            $resp = $client->get($url, [
                'headers' => ['Accept' => 'application/json'],
                'http_errors' => false,
            ]);
        } catch (GuzzleException $e) {
            return $this->asJson([
                'success' => false,
                'error' => $errorMessage,
                'message' => $e->getMessage(),
            ]);
        }

        $this->response->statusCode = $resp->getStatusCode();
        $this->response->format = Response::FORMAT_RAW;
        $this->response->content = (string) $resp->getBody();
        $this->response->headers->set('Content-Type', 'application/json');

        return $this->response;
    }

    private function registerTranslations(): void
    {
        $translations = include __DIR__.'/../translations/en/ai-assistant.php';
        $translations = array_keys($translations);
        Craft::$app->getView()->registerTranslations(AiAssistant::TRANSLATION_CATEGORY, $translations);
    }
}


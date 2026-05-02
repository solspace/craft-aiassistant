<?php

namespace Solspace\AIAssistant\controllers;

use craft\helpers\StringHelper;
use craft\web\Controller;
use Solspace\AIAssistant\AiAssistant;
use Solspace\AIAssistant\models\Integration;
use yii\web\Response;

class IntegrationsController extends Controller
{
    protected array|bool|int $allowAnonymous = false;

    public function actionIndex(): Response
    {
        $this->registerTranslations();

        $integrationService = AiAssistant::getIntegrationService();
        $integrations = $integrationService->getAllIntegrations();

        $hasSolspaceAi = false;
        foreach ($integrations as $i) {
            if ('solspaceai' === ($i->type ?? null)) {
                $hasSolspaceAi = true;
                break;
            }
        }

        return $this->renderTemplate('ai-assistant/integrations/index', [
            'integrations' => $integrations,
            'hasSolspaceAi' => $hasSolspaceAi,
        ]);
    }

    public function actionEdit(?int $id = null): Response
    {
        $this->registerTranslations();

        $integration = null;
        if ($id) {
            $integrationService = AiAssistant::getIntegrationService();
            $integration = $integrationService->getIntegrationById($id);
        }

        if (!$integration) {
            $integration = new Integration();
            $requestedType = (string) \Craft::$app->getRequest()->getQueryParam('type');
            if ('solspaceai' === $requestedType) {
                $integration->type = 'solspaceai';
                $integration->name = 'SolspaceAI';
                $integration->handle = 'solspaceai';
            }
        }

        return $this->renderTemplate('ai-assistant/integrations/edit', [
            'integration' => $integration,
        ]);
    }

    public function actionSave(): Response
    {
        $this->requirePostRequest();

        $request = \Craft::$app->getRequest();
        $integrationService = AiAssistant::getIntegrationService();

        $rawId = $request->getBodyParam('id');
        $id = null !== $rawId && '' !== $rawId ? (int) $rawId : null;

        $existing = ($id ? $integrationService->getIntegrationById($id) : null) ?? new Integration();
        $integration = $existing;
        $integration->id = $id;
        $integration->enabled = (bool) $request->getBodyParam('enabled');

        $name = (string) $request->getBodyParam('name');
        $handle = (string) $request->getBodyParam('handle');
        if ('' === $handle && '' !== $name) {
            $handle = StringHelper::toKebabCase($name);
        }

        $integration->handle = $handle;
        $integration->name = $name;
        $integration->type = (string) $request->getBodyParam('type');
        $integration->class = $this->getClassForType($integration->type);
        $postedKey = (string) $request->getBodyParam('apiKey');
        if ('solspaceai' === $integration->type && '' === trim($postedKey) && $id && '' !== trim($existing->apiKey)) {
            $integration->apiKey = $existing->apiKey;
        } else {
            $integration->apiKey = $postedKey;
        }
        $integration->model = (string) $request->getBodyParam('model');
        $integration->maxTokens = (int) $request->getBodyParam('maxTokens');
        $integration->temperature = (string) $request->getBodyParam('temperature');
        $integration->apiBaseUrl = (string) $request->getBodyParam('apiBaseUrl', $integration->apiBaseUrl);
        $integration->contactEmail = (string) $request->getBodyParam('contactEmail', $integration->contactEmail);
        $integration->siteUrl = (string) $request->getBodyParam('siteUrl', $integration->siteUrl);

        if ('solspaceai' === $integration->type) {
            $integration->apiBaseUrl = 'https://ai.solspace.net/v1';
        }

        if ('solspaceai' === $integration->type && '' === trim($integration->apiBaseUrl)) {
            $integration->apiBaseUrl = 'https://ai.solspace.net/v1';
        }

        // If model is empty, apply sensible defaults per provider (SolspaceAI uses LiteLLM default — no stored model)
        if ('' === $integration->model && 'solspaceai' !== $integration->type) {
            $defaults = [
                'openai' => 'gpt-5.4-mini',
                'anthropic' => 'claude-sonnet-4.6',
                'gemini' => 'gemini-3-flash',
                'xai' => 'grok-4.1-fast',
                'replicate' => 'black-forest-labs/flux-2-pro',
            ];
            $integration->model = $defaults[$integration->type] ?? '';
        }
        if ('solspaceai' === $integration->type) {
            $integration->model = '';
            if ($integration->maxTokens < 0) {
                $integration->maxTokens = 0;
            }
            if ('' === trim($integration->temperature)) {
                $integration->temperature = '0.7';
            }
        }

        if (!$integration->validate()) {
            $errors = $integration->getFirstErrors();
            $msg = 'Couldn\'t save integration.';
            if (!empty($errors)) {
                $msg .= ' '.implode(' ', array_values($errors));
            }
            \Craft::$app->getSession()->setError($msg);

            return $this->redirectToPostedUrl();
        }

        if ($integrationService->saveIntegration($integration)) {
            if ('solspaceai' === $integration->type) {
                $result = $integrationService->connectSolspaceAi($integration);
                if (!($result['success'] ?? false)) {
                    \Craft::$app->getSession()->setError((string) ($result['message'] ?? 'Could not connect to SolspaceAI.'));

                    return $this->redirectToPostedUrl();
                }

                \Craft::$app->getSession()->setNotice((string) ($result['message'] ?? 'Connected to SolspaceAI.'));

                return $this->redirect('ai-assistant/integrations');
            }

            \Craft::$app->getSession()->setNotice('Integration saved.');

            return $this->redirect('ai-assistant/integrations');
        }

        \Craft::$app->getSession()->setError('Couldn\'t save integration. Please ensure the handle is unique and all required fields are filled out.');

        return $this->redirectToPostedUrl();
    }

    public function actionTest(): Response
    {
        $id = $this->request->getBodyParam('id');

        if (!$id) {
            return $this->asJson([
                'success' => false,
                'message' => 'Integration ID is required.',
            ]);
        }

        $integrationService = AiAssistant::getIntegrationService();
        $integration = $integrationService->getIntegrationById($id);

        if (!$integration) {
            return $this->asJson([
                'success' => false,
                'message' => 'Integration not found.',
            ]);
        }

        try {
            $testResult = $integrationService->testIntegration($integration);

            return $this->asJson([
                'success' => $testResult['success'],
                'message' => $testResult['message'] ?? ($testResult['success'] ? 'Connection successful!' : 'Connection failed.'),
            ]);
        } catch (\Exception $e) {
            return $this->asJson([
                'success' => false,
                'message' => 'Integration test failed: '.$e->getMessage(),
            ]);
        }
    }

    public function actionDelete(): Response
    {
        $this->requirePostRequest();

        $request = \Craft::$app->getRequest();
        $id = $request->getBodyParam('id');

        if ($id) {
            $integrationService = AiAssistant::getIntegrationService();
            if ($integrationService->deleteIntegration((int) $id)) {
                \Craft::$app->getSession()->setNotice('Integration deleted.');
            } else {
                \Craft::$app->getSession()->setError('Couldn\'t delete integration.');
            }
        }

        return $this->redirect('ai-assistant/integrations');
    }

    public function actionTestConnection(): Response
    {
        $this->requireAcceptsJson();

        return $this->asJson(['success' => true, 'message' => 'OK']);
    }

    public function actionConnectSolspaceai(): Response
    {
        $this->requirePostRequest();

        $id = (int) $this->request->getBodyParam('id');
        if (!$id) {
            return $this->asJson(['success' => false, 'message' => 'Integration ID is required.']);
        }

        $integrationService = AiAssistant::getIntegrationService();
        $integration = $integrationService->getIntegrationById($id);
        if (!$integration) {
            return $this->asJson(['success' => false, 'message' => 'Integration not found.']);
        }

        $result = $integrationService->connectSolspaceAi($integration, true);

        return $this->asJson($result);
    }

    public function actionGetModels(): Response
    {
        $this->requireAcceptsJson();

        $request = \Craft::$app->getRequest();
        $type = $request->getQueryParam('type', 'text');
        $integrationType = $request->getQueryParam('integrationType');

        $integration = new Integration();
        $integration->type = $integrationType;

        $models = [];
        if ('image' === $type) {
            $models = $integration->getImageModelOptions();
        } else {
            $models = $integration->getModelOptions();
        }

        return $this->asJson([
            'success' => true,
            'models' => $models,
        ]);
    }

    /**
     * Register translations for CP pages.
     */
    private function registerTranslations(): void
    {
        $translations = include __DIR__.'/../translations/en/ai-assistant.php';
        $translations = array_keys($translations);
        $this->view->registerTranslations(AiAssistant::TRANSLATION_CATEGORY, $translations);
    }

    private function getClassForType(string $type): string
    {
        $classes = [
            'openai' => 'Solspace\AIAssistant\Integrations\OpenAI\OpenAIIntegration',
            'gemini' => 'Solspace\AIAssistant\Integrations\Gemini\GeminiIntegration',
            'anthropic' => 'Solspace\AIAssistant\Integrations\Anthropic\AnthropicIntegration',
            'xai' => 'Solspace\AIAssistant\Integrations\xAI\xAIIntegration',
            'replicate' => 'Solspace\AIAssistant\Integrations\Replicate\ReplicateIntegration',
            'solspaceai' => 'Solspace\AIAssistant\Integrations\SolspaceAI\SolspaceAIIntegration',
        ];

        return $classes[$type] ?? '';
    }
}

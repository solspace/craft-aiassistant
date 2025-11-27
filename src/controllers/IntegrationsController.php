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

        return $this->renderTemplate('ai-assistant/integrations/index', [
            'integrations' => $integrations,
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
        }

        return $this->renderTemplate('ai-assistant/integrations/edit', [
            'integration' => $integration,
        ]);
    }

    public function actionSave(): Response
    {
        $this->requirePostRequest();

        $request = \Craft::$app->getRequest();
        $integration = new Integration();

        $rawId = $request->getBodyParam('id');
        $integration->id = null !== $rawId && '' !== $rawId ? (int) $rawId : null;
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
        $integration->apiKey = (string) $request->getBodyParam('apiKey');
        $integration->model = (string) $request->getBodyParam('model');
        $integration->maxTokens = (int) $request->getBodyParam('maxTokens');
        $integration->temperature = (string) $request->getBodyParam('temperature');

        // If model is empty, apply sensible defaults per provider
        if ('' === $integration->model) {
            $defaults = [
                'openai' => 'gpt-4o-mini',
                'gemini' => 'gemini-1.5-flash',
            ];
            $integration->model = $defaults[$integration->type] ?? '';
        }

        if (!$integration->validate()) {
            \Craft::$app->getSession()->setError('Couldn\'t save integration.');

            return $this->redirectToPostedUrl();
        }

        $integrationService = AiAssistant::getIntegrationService();
        if ($integrationService->saveIntegration($integration)) {
            \Craft::$app->getSession()->setNotice('Integration saved.');

            return $this->redirect('ai-assistant/integrations');
        }

        \Craft::$app->getSession()->setError('Couldn\'t save integration.');

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
        ];

        return $classes[$type] ?? '';
    }
}

<?php

namespace Solspace\AIAssistant\controllers;

use craft\web\Controller;
use Solspace\AIAssistant\AiAssistant;
use Solspace\AIAssistant\services\PromptService;
use yii\web\Response;

class ApiController extends Controller
{
    protected array|bool|int $allowAnonymous = false;

    public function actionGenerateText(): Response
    {
        $this->requirePostRequest();
        $this->requireAcceptsJson();

        $prompt = $this->request->getBodyParam('promptText') ?: $this->request->getBodyParam('prompt');
        $integrationHandle = $this->request->getBodyParam('integration', 'openai');
        $fieldType = $this->request->getBodyParam('fieldType', 'input');
        $options = $this->request->getBodyParam('options', []);

        if (!$prompt) {
            return $this->asJson(['success' => false, 'error' => 'Prompt is required']);
        }

        try {
            $integrationService = AiAssistant::getIntegrationService();
            $result = $integrationService->processRequest($integrationHandle, 'text', $prompt, array_merge($options, ['fieldType' => $fieldType]));

            return $this->asJson($result);
        } catch (\Exception $e) {
            return $this->asJson([
                'success' => false,
                'error' => 'Generation failed: '.$e->getMessage(),
            ]);
        }
    }

    public function actionGenerateImage(): Response
    {
        $this->requirePostRequest();
        $this->requireAcceptsJson();

        $prompt = $this->request->getBodyParam('prompt');
        $integrationHandle = $this->request->getBodyParam('integration', 'openai');
        $options = $this->request->getBodyParam('options', []);

        if (!$prompt) {
            return $this->asJson(['success' => false, 'error' => 'Prompt is required']);
        }

        $integrationService = AiAssistant::getIntegrationService();
        $result = $integrationService->processRequest($integrationHandle, 'image', $prompt, $options);

        return $this->asJson($result);
    }

    public function actionGetPrompts(): Response
    {
        $this->requireAcceptsJson();

        try {
            $type = $this->request->getQueryParam('type');

            $promptService = new PromptService();

            if ($type) {
                $prompts = $promptService->getPromptsByType($type);
            } else {
                $prompts = $promptService->getAllPrompts();
            }

            // Convert prompts to array format for JavaScript
            $processedPrompts = [];
            foreach ($prompts as $prompt) {
                $processedPrompts[] = [
                    'id' => $prompt->id,
                    'name' => $prompt->name,
                    'promptText' => $prompt->promptText,
                    'type' => $prompt->type,
                    'integrationHandle' => $prompt->integrationHandle,
                    'isBuiltIn' => $prompt->isBuiltIn ?? false,
                ];
            }

            return $this->asJson([
                'success' => true,
                'prompts' => $processedPrompts,
            ]);
        } catch (\Exception $e) {
            return $this->asJson([
                'success' => false,
                'error' => 'Failed to load prompts: '.$e->getMessage(),
                'prompts' => [],
            ]);
        }
    }

    public function actionGetIntegrations(): Response
    {
        $this->requireAcceptsJson();

        try {
            $integrationService = AiAssistant::getIntegrationService();
            $integrations = $integrationService->getEnabledIntegrations();

            $result = [];
            foreach ($integrations as $integration) {
                $result[] = [
                    'handle' => $integration->handle,
                    'name' => $integration->name,
                    'type' => $integration->type,
                    'model' => $integration->model,
                ];
            }

            return $this->asJson([
                'success' => true,
                'integrations' => $result,
            ]);
        } catch (\Exception $e) {
            return $this->asJson([
                'success' => false,
                'error' => 'Failed to load integrations: '.$e->getMessage(),
                'integrations' => [],
            ]);
        }
    }
}

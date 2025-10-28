<?php

namespace Solspace\AIAssistant\controllers;

use craft\web\Controller;
use Solspace\AIAssistant\AiAssistant;
use Solspace\AIAssistant\models\Prompt;
use yii\web\Response;

class PromptsController extends Controller
{
    protected array|bool|int $allowAnonymous = false;

    public function actionIndex(): ?Response
    {
        $promptService = AiAssistant::getPromptService();
        $prompts = $promptService->getAllPrompts();

        return $this->renderTemplate('ai-assistant/prompts', [
            'prompts' => $prompts,
        ]);
    }

    public function actionEdit($id = null): ?Response
    {
        // Accept both route param and query param for id (supports built-ins like builtin_*)
        $id ??= (string) $this->request->getQueryParam('id');

        $prompt = null;
        if ($id) {
            $promptService = AiAssistant::getPromptService();

            // Check if it's a built-in prompt
            if (str_starts_with($id, 'builtin_')) {
                $builtInPrompts = $promptService->getBuiltInPrompts();
                $promptName = str_replace('_', ' ', substr($id, 8));
                $promptName = ucwords($promptName);

                foreach ($builtInPrompts as $promptData) {
                    if ($promptData['name'] === $promptName) {
                        $prompt = new Prompt();
                        $prompt->id = $id;
                        $prompt->name = $promptData['name'];
                        $prompt->promptText = $promptData['promptText'];
                        $prompt->type = $promptData['type'];
                        $prompt->integrationHandle = $promptData['integrationHandle'];
                        $prompt->isActive = true;
                        $prompt->sortOrder = $promptData['sortOrder'];
                        $prompt->isBuiltIn = true;

                        break;
                    }
                }
            } else {
                // Numeric ids only for DB prompts
                $numericId = ctype_digit((string) $id) ? (int) $id : null;
                $prompt = $numericId ? $promptService->getPromptById($numericId) : null;
            }
        }

        if (!$prompt) {
            $prompt = new Prompt();
            $prompt->isActive = true;
            $prompt->sortOrder = 0;
        }

        $integrationService = AiAssistant::getIntegrationService();
        $integrations = $integrationService->getEnabledIntegrations();

        return $this->renderTemplate('ai-assistant/prompts/edit', [
            'prompt' => $prompt,
            'integrations' => $integrations,
        ]);
    }

    public function actionSave(): Response
    {
        $this->requirePostRequest();

        $promptService = AiAssistant::getPromptService();

        $id = $this->request->getBodyParam('id');

        // If it's a built-in prompt, create a new custom prompt instead
        if ($id && \is_string($id) && str_starts_with($id, 'builtin_')) {
            $prompt = new Prompt();
            $prompt->isBuiltIn = false;
        } else {
            $numericId = ctype_digit((string) $id) ? (int) $id : null;
            $prompt = $numericId ? $promptService->getPromptById($numericId) : new Prompt();
        }

        $prompt->name = (string) $this->request->getBodyParam('name');
        $prompt->promptText = (string) $this->request->getBodyParam('promptText');
        $prompt->type = (string) $this->request->getBodyParam('type');
        $integrationHandle = (string) $this->request->getBodyParam('integrationHandle');
        $prompt->integrationHandle = '' !== $integrationHandle ? $integrationHandle : null;
        $prompt->isActive = (bool) $this->request->getBodyParam('isActive', true);
        $prompt->sortOrder = (int) $this->request->getBodyParam('sortOrder', 0);

        // Check for duplicate names
        $existingPrompt = $promptService->getPromptByName($prompt->name);
        if ($existingPrompt && $existingPrompt->id != $prompt->id) {
            $this->setFailFlash('A prompt with this name already exists.');

            $integrationService = AiAssistant::getIntegrationService();
            $integrations = $integrationService->getEnabledIntegrations();

            return $this->renderTemplate('ai-assistant/prompts/edit', [
                'prompt' => $prompt,
                'integrations' => $integrations,
            ]);
        }

        // Validate before saving to provide UI feedback
        if (!$prompt->validate()) {
            $this->setFailFlash('Please fix errors.');

            $integrationService = AiAssistant::getIntegrationService();
            $integrations = $integrationService->getEnabledIntegrations();

            return $this->renderTemplate('ai-assistant/prompts/edit', [
                'prompt' => $prompt,
                'integrations' => $integrations,
            ]);
        }

        if ($promptService->savePrompt($prompt)) {
            $this->setSuccessFlash('Prompt saved successfully.');

            return $this->redirect('ai-assistant/prompts');
        }

        $this->setFailFlash('Could not save prompt.');

        $integrationService = AiAssistant::getIntegrationService();
        $integrations = $integrationService->getEnabledIntegrations();

        return $this->renderTemplate('ai-assistant/prompts/edit', [
            'prompt' => $prompt,
            'integrations' => $integrations,
        ]);
    }

    public function actionDelete(): Response
    {
        $this->requirePostRequest();

        $id = $this->request->getBodyParam('id');

        if ($id) {
            $promptService = AiAssistant::getPromptService();
            if ($promptService->deletePrompt($id)) {
                $this->setSuccessFlash('Prompt deleted successfully.');
            } else {
                $this->setFailFlash('Could not delete prompt.');
            }
        }

        return $this->redirect('ai-assistant/prompts');
    }
}

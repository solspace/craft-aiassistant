<?php

namespace Solspace\AIAssistant\controllers;

use craft\records\VolumeFolder;
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

        $volOptions = [];
        foreach (\Craft::$app->getVolumes()->getAllVolumes() as $vol) {
            $volOptions[] = ['label' => $vol->name, 'value' => $vol->id];
        }

        // Build asset target options (volumes + folders) using UIDs
        $assetTargetOptions = [];
        $volumes = \Craft::$app->getVolumes()->getAllVolumes();
        $volumeIdToName = [];
        foreach ($volumes as $vol) {
            $volumeIdToName[$vol->id] = $vol->name;
            $assetTargetOptions[] = [
                'label' => $vol->name.' (root)',
                'value' => 'volume:'.$vol->uid,
            ];
        }
        // Query folders via records to support Craft 4/5
        $folderRecords = VolumeFolder::find()->all();
        // Index by id to build full paths
        $folderById = [];
        foreach ($folderRecords as $fr) {
            $folderById[$fr->id] = $fr;
        }
        // Helper to build folder path within a volume
        $buildFolderPath = static function ($folder) use (&$folderById): string {
            $parts = [];
            $current = $folder;
            // Walk up to root (parentId === null)
            while ($current && $current->parentId) {
                $parts[] = $current->name;
                $current = $folderById[$current->parentId] ?? null;
            }

            return implode('/', array_reverse($parts));
        };
        foreach ($folderRecords as $fr) {
            // Skip root folders (no parent)
            if (null === $fr->parentId) {
                continue;
            }
            $volName = $volumeIdToName[$fr->volumeId] ?? 'Volume';
            $path = $buildFolderPath($fr);
            $label = $path ? ($volName.' / '.$path) : ($volName.' / '.$fr->name);
            $assetTargetOptions[] = [
                'label' => $label,
                'value' => 'folder:'.$fr->uid,
            ];
        }
        // Compute first option value for defaulting in UI
        $defaultAssetTargetValue = '';
        if (!empty($assetTargetOptions)) {
            $defaultAssetTargetValue = $assetTargetOptions[0]['value'] ?? '';
        }

        return $this->renderTemplate('ai-assistant/prompts/edit', [
            'prompt' => $prompt,
            'integrations' => $integrations,
            'volumesOptions' => $volOptions,
            'assetTargetOptions' => $assetTargetOptions,
            'defaultAssetTargetValue' => $defaultAssetTargetValue,
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
        // Image-specific fields (only when type=image, but safe to read regardless)
        $imageSize = $this->request->getBodyParam('imageSize');
        $prompt->imageSize = null !== $imageSize && '' !== $imageSize ? (string) $imageSize : null;
        $imageCount = $this->request->getBodyParam('imageCount');
        $prompt->imageCount = null !== $imageCount && '' !== $imageCount ? (int) $imageCount : null;
        $assetTarget = $this->request->getBodyParam('assetTarget');
        $prompt->assetTarget = null !== $assetTarget && '' !== $assetTarget ? (string) $assetTarget : null;

        // Check for duplicate names
        $existingPrompt = $promptService->getPromptByName($prompt->name);
        if ($existingPrompt && $existingPrompt->id != $prompt->id) {
            $this->setFailFlash('A prompt with this name already exists.');

            $integrationService = AiAssistant::getIntegrationService();
            $integrations = $integrationService->getEnabledIntegrations();

            $volOptions = [];
            foreach (\Craft::$app->getVolumes()->getAllVolumes() as $vol) {
                $volOptions[] = ['label' => $vol->name, 'value' => $vol->id];
            }

            // Rebuild asset target options for re-render
            $assetTargetOptions = [];
            $volumes = \Craft::$app->getVolumes()->getAllVolumes();
            foreach ($volumes as $vol) {
                $assetTargetOptions[] = [
                    'label' => $vol->name.' (root)',
                    'value' => 'volume:'.$vol->uid,
                ];
            }
            $folderRecords = VolumeFolder::find()->all();
            foreach ($folderRecords as $fr) {
                if (null === $fr->parentId) {
                    continue;
                }
                $assetTargetOptions[] = [
                    'label' => $fr->name,
                    'value' => 'folder:'.$fr->uid,
                ];
            }
            $defaultAssetTargetValue = '';
            if (!empty($assetTargetOptions)) {
                $defaultAssetTargetValue = $assetTargetOptions[0]['value'] ?? '';
            }

            return $this->renderTemplate('ai-assistant/prompts/edit', [
                'prompt' => $prompt,
                'integrations' => $integrations,
                'volumesOptions' => $volOptions,
                'assetTargetOptions' => $assetTargetOptions,
                'defaultAssetTargetValue' => $defaultAssetTargetValue,
            ]);
        }

        // Validate before saving to provide UI feedback
        if (!$prompt->validate()) {
            $this->setFailFlash('Please fix errors.');

            $integrationService = AiAssistant::getIntegrationService();
            $integrations = $integrationService->getEnabledIntegrations();

            $volOptions = [];
            foreach (\Craft::$app->getVolumes()->getAllVolumes() as $vol) {
                $volOptions[] = ['label' => $vol->name, 'value' => $vol->id];
            }

            // Rebuild asset target options for re-render
            $assetTargetOptions = [];
            $volumes = \Craft::$app->getVolumes()->getAllVolumes();
            foreach ($volumes as $vol) {
                $assetTargetOptions[] = [
                    'label' => $vol->name.' (root)',
                    'value' => 'volume:'.$vol->uid,
                ];
            }
            $folderRecords = VolumeFolder::find()->all();
            foreach ($folderRecords as $fr) {
                if (null === $fr->parentId) {
                    continue;
                }
                $assetTargetOptions[] = [
                    'label' => $fr->name,
                    'value' => 'folder:'.$fr->uid,
                ];
            }
            $defaultAssetTargetValue = '';
            if (!empty($assetTargetOptions)) {
                $defaultAssetTargetValue = $assetTargetOptions[0]['value'] ?? '';
            }

            return $this->renderTemplate('ai-assistant/prompts/edit', [
                'prompt' => $prompt,
                'integrations' => $integrations,
                'volumesOptions' => $volOptions,
                'assetTargetOptions' => $assetTargetOptions,
                'defaultAssetTargetValue' => $defaultAssetTargetValue,
            ]);
        }

        if ($promptService->savePrompt($prompt)) {
            $this->setSuccessFlash('Prompt saved successfully.');

            return $this->redirect('ai-assistant/prompts');
        }

        $this->setFailFlash('Could not save prompt.');

        $integrationService = AiAssistant::getIntegrationService();
        $integrations = $integrationService->getEnabledIntegrations();

        $volOptions = [];
        foreach (\Craft::$app->getVolumes()->getAllVolumes() as $vol) {
            $volOptions[] = ['label' => $vol->name, 'value' => $vol->id];
        }

        // Rebuild asset target options for re-render
        $assetTargetOptions = [];
        $volumes = \Craft::$app->getVolumes()->getAllVolumes();
        foreach ($volumes as $vol) {
            $assetTargetOptions[] = [
                'label' => $vol->name.' (root)',
                'value' => 'volume:'.$vol->uid,
            ];
        }
        $folderRecords = VolumeFolder::find()->all();
        foreach ($folderRecords as $fr) {
            if (null === $fr->parentId) {
                continue;
            }
            $assetTargetOptions[] = [
                'label' => $fr->name,
                'value' => 'folder:'.$fr->uid,
            ];
        }
        $defaultAssetTargetValue = '';
        if (!empty($assetTargetOptions)) {
            $defaultAssetTargetValue = $assetTargetOptions[0]['value'] ?? '';
        }

        return $this->renderTemplate('ai-assistant/prompts/edit', [
            'prompt' => $prompt,
            'integrations' => $integrations,
            'volumesOptions' => $volOptions,
            'assetTargetOptions' => $assetTargetOptions,
            'defaultAssetTargetValue' => $defaultAssetTargetValue,
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

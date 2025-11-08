<?php

namespace Solspace\AIAssistant\controllers;

use craft\web\Controller;
use Solspace\AIAssistant\AiAssistant;
use Solspace\AIAssistant\services\ImageService;
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
        $model = $this->request->getBodyParam('model');
        $size = $this->request->getBodyParam('size');
        $count = (int) $this->request->getBodyParam('count', 1);
        $assetTarget = $this->request->getBodyParam('assetTarget');
        $dryRun = (bool) $this->request->getBodyParam('dryRun', false);

        if (!$prompt) {
            return $this->asJson(['success' => false, 'error' => 'Prompt is required']);
        }

        // Merge model/size into options
        if ($model) {
            $options['model'] = $model;
        }
        if ($size) {
            $options['size'] = $size;
        }

        $integrationService = AiAssistant::getIntegrationService();
        $imageService = new ImageService();

        $assets = [];
        $revisedPrompt = null;
        $modelUsed = $model ?: 'dall-e-3';
        $previews = [];

        $iterations = max(1, $count);
        for ($i = 0; $i < $iterations; ++$i) {
            $result = $integrationService->processRequest($integrationHandle, 'image', $prompt, $options);
            if (!($result['success'] ?? false)) {
                return $this->asJson($result);
            }

            $imageUrl = $result['imageUrl'] ?? '';
            $revisedPrompt = $result['revisedPrompt'] ?? $revisedPrompt ?? $prompt;
            $modelUsed = $result['model'] ?? $modelUsed;

            if (!$imageUrl) {
                return $this->asJson(['success' => false, 'error' => 'No image URL returned from provider']);
            }

            // Resolve folderId from assetTarget
            $folderId = $assetTarget ? $this->resolveFolderIdFromAssetTarget($assetTarget) : null;
            if ($dryRun) {
                $previews[] = $imageUrl;
            } else {
                $asset = $imageService->createFromRemoteUrl($imageUrl, null, $folderId ? (int) $folderId : null, null, [
                    'title' => mb_substr($revisedPrompt ?? $prompt, 0, 60),
                ]);
                if ($asset) {
                    $assets[] = [
                        'id' => $asset->id,
                        'url' => $asset->getUrl(),
                    ];
                }
            }
        }

        if ($dryRun) {
            return $this->asJson([
                'success' => true,
                'previewUrls' => $previews,
                'revisedPrompt' => $revisedPrompt,
                'model' => $modelUsed,
            ]);
        }

        return $this->asJson([
            'success' => true,
            'assets' => $assets,
            'revisedPrompt' => $revisedPrompt,
            'model' => $modelUsed,
        ]);
    }

    public function actionSaveImageToAssets(): Response
    {
        $this->requirePostRequest();
        $this->requireAcceptsJson();

        $urls = $this->request->getBodyParam('urls', []);
        $assetTarget = $this->request->getBodyParam('assetTarget');
        $title = $this->request->getBodyParam('title', '');

        if (empty($urls) || !\is_array($urls)) {
            return $this->asJson(['success' => false, 'error' => 'No image URLs provided']);
        }

        $imageService = new ImageService();
        $assets = [];
        // Resolve folderId from assetTarget
        $folderId = $assetTarget ? $this->resolveFolderIdFromAssetTarget($assetTarget) : null;
        foreach ($urls as $u) {
            $asset = $imageService->createFromRemoteUrl((string) $u, null, $folderId ? (int) $folderId : null, null, [
                'title' => mb_substr($title, 0, 60),
            ]);
            if ($asset) {
                $assets[] = ['id' => $asset->id, 'url' => $asset->getUrl()];
            }
        }

        return $this->asJson([
            'success' => true,
            'assets' => $assets,
        ]);
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
                    // Image defaults (may be null)
                    'imageSize' => $prompt->imageSize ?? null,
                    'imageCount' => $prompt->imageCount ?? null,
                    'assetTarget' => $prompt->assetTarget ?? null,
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

    private function resolveFolderIdFromAssetTarget(?string $assetTarget): ?int
    {
        if (!$assetTarget || !\is_string($assetTarget)) {
            return null;
        }

        try {
            if (str_starts_with($assetTarget, 'folder:')) {
                $folderUid = substr($assetTarget, 7);
                $folder = \Craft::$app->getAssets()->getFolderByUid($folderUid);

                return $folder ? (int) $folder->id : null;
            }
            if (str_starts_with($assetTarget, 'volume:')) {
                $volumeUid = substr($assetTarget, 7);
                $volume = \Craft::$app->getVolumes()->getVolumeByUid($volumeUid);
                if ($volume) {
                    $root = \Craft::$app->getAssets()->getRootFolderByVolumeId($volume->id);

                    return $root ? (int) $root->id : null;
                }
            }
        } catch (\Throwable $e) {
            // ignore and return null
        }

        return null;
    }
}

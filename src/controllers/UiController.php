<?php

namespace Solspace\AIAssistant\controllers;

use craft\records\VolumeFolder;
use craft\web\Controller;
use Solspace\AIAssistant\AiAssistant;
use yii\web\Response;

class UiController extends Controller
{
    protected array|bool|int $allowAnonymous = false;

    public function actionGenerateTextModal(): Response
    {
        $this->requireCpRequest();

        $volOptions = [];
        foreach (\Craft::$app->getVolumes()->getAllVolumes() as $vol) {
            $volOptions[] = ['label' => $vol->name, 'value' => $vol->id];
        }

        // Build asset target options (volumes + folders) using UIDs for the modal
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
        $folderRecords = VolumeFolder::find()->all();
        $folderById = [];
        foreach ($folderRecords as $fr) {
            $folderById[$fr->id] = $fr;
        }
        $buildFolderPath = static function ($folder) use (&$folderById): string {
            $parts = [];
            $current = $folder;
            while ($current && $current->parentId) {
                $parts[] = $current->name;
                $current = $folderById[$current->parentId] ?? null;
            }

            return implode('/', array_reverse($parts));
        };
        foreach ($folderRecords as $fr) {
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
        $defaultAssetTargetValue = '';
        if (!empty($assetTargetOptions)) {
            $defaultAssetTargetValue = $assetTargetOptions[0]['value'] ?? '';
        }

        $html = \Craft::$app->getView()->renderTemplate('ai-assistant/modals/generate', [
            'volumesOptions' => $volOptions,
            'assetTargetOptions' => $assetTargetOptions,
            'defaultAssetTargetValue' => $defaultAssetTargetValue,
        ]);

        return $this->asRaw($html);
    }

    public function actionPromptEditModal(): Response
    {
        $this->requireCpRequest();

        $promptService = AiAssistant::getPromptService();
        $prompts = $promptService->getAllPrompts();

        $html = \Craft::$app->getView()->renderTemplate('ai-assistant/modals/prompt-edit', [
            'prompts' => $prompts,
        ]);

        return $this->asRaw($html);
    }

    public function actionGenerateImageModal(): Response
    {
        $this->requireCpRequest();

        $settings = AiAssistant::$plugin->getSettings();
        $html = \Craft::$app->getView()->renderTemplate('ai-assistant/modals/generate-image', [
            'settings' => $settings,
        ]);

        return $this->asRaw($html);
    }
}

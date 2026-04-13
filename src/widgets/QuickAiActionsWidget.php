<?php

namespace Solspace\AIAssistant\widgets;

use Craft;
use craft\base\Widget;
use craft\records\VolumeFolder;
use craft\web\View;
use Solspace\AIAssistant\AiAssistant;

class QuickAiActionsWidget extends Widget
{
    public static function displayName(): string
    {
        return \Craft::t('app', 'AI Assistant Quick Actions');
    }

    public static function icon(): ?string
    {
        return '@ai-assistant/icon-mask.svg';
    }

    public static function maxColspan(): ?int
    {
        return 1;
    }

    public function getTitle(): ?string
    {
        return static::displayName();
    }

    public function getBodyHtml(): ?string
    {
        $view = \Craft::$app->getView();

        // Get available prompts and integrations
        $promptService = AiAssistant::getPromptService();
        $integrationService = AiAssistant::getIntegrationService();

        $prompts = $promptService->getAllPrompts();
        $integrations = $integrationService->getEnabledIntegrations();
        $assetTargetOptions = [];
        $defaultAssetTargetValue = '';

        $volumes = \Craft::$app->getVolumes()->getAllVolumes();
        $volumeIdToName = [];
        foreach ($volumes as $volume) {
            $volumeIdToName[$volume->id] = $volume->name;
            $assetTargetOptions[] = [
                'label' => $volume->name.' (root)',
                'value' => 'volume:'.$volume->uid,
            ];
        }

        $folderRecords = VolumeFolder::find()->all();
        $foldersById = [];
        foreach ($folderRecords as $folderRecord) {
            $foldersById[$folderRecord->id] = $folderRecord;
        }

        $buildFolderPath = static function ($folder) use (&$foldersById): string {
            $parts = [];
            $current = $folder;

            while ($current && $current->parentId) {
                $parts[] = $current->name;
                $current = $foldersById[$current->parentId] ?? null;
            }

            return implode('/', array_reverse($parts));
        };

        foreach ($folderRecords as $folder) {
            if (null === $folder->parentId) {
                continue;
            }

            $volumeName = $volumeIdToName[$folder->volumeId] ?? 'Volume';
            $path = $buildFolderPath($folder);
            $label = $path ? ($volumeName.' / '.$path) : ($volumeName.' / '.$folder->name);

            $assetTargetOptions[] = [
                'label' => $label,
                'value' => 'folder:'.$folder->uid,
            ];
        }

        if (!empty($assetTargetOptions)) {
            $defaultAssetTargetValue = $assetTargetOptions[0]['value'] ?? '';
        }

        return $view->renderTemplate('ai-assistant/widgets/quick-ai-actions', [
            'prompts' => $prompts,
            'integrations' => $integrations,
            'assetTargetOptions' => $assetTargetOptions,
            'defaultAssetTargetValue' => $defaultAssetTargetValue,
        ], View::TEMPLATE_MODE_CP);
    }

    public function getSettingsHtml(): ?string
    {
        return null; // No settings needed for this widget
    }
}

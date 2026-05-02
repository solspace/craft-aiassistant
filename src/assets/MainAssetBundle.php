<?php

namespace Solspace\AIAssistant\assets;

use craft\web\AssetBundle;
use craft\web\View;
use craft\web\assets\cp\CpAsset;

/**
 * Main asset bundle for AI Assistant plugin
 * Loaded globally on all CP pages.
 */
class MainAssetBundle extends AssetBundle
{
    public function init(): void
    {
        $this->sourcePath = __DIR__.'/..';
        $this->depends = [CpAsset::class];
        $this->js = [
            'assets/js/ai-assistant.min.js',
        ];
        $this->css = [
            'assets/css/ai-assistant.min.css',
        ];

        parent::init();
    }

    public function registerAssetFiles($view)
    {
        parent::registerAssetFiles($view);

        $view->registerTranslations('ai-assistant', [
            'Write your custom prompt here...',
            'Describe the image you want to generate...',
            'Edit the prompt text as needed...',
        ]);
    }
}
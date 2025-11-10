<?php

namespace Solspace\AIAssistant\assets;

use craft\web\AssetBundle;
use craft\web\assets\cp\CpAsset;

class AiAssistantAsset extends AssetBundle
{
    public function init(): void
    {
        $this->sourcePath = __DIR__.'/../assets';
        $this->depends = [CpAsset::class];
        $this->js = [
            'js/ai-assistant-modal.min.js',
            'js/ai-assistant.min.js',
        ];
        $this->css = ['css/ai-assistant.min.css'];

        parent::init();
    }
}

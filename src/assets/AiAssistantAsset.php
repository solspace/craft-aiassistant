<?php

namespace Solspace\AIAssistant\assets;

use craft\web\AssetBundle;
use craft\web\assets\cp\CpAsset;

class AiAssistantAsset extends AssetBundle
{
    public function init(): void
    {
        $this->sourcePath = __DIR__ . '/../assets';
        $this->depends = [CpAsset::class];
        $this->js = [
            'js/ai-assistant-modal.js',
            'js/ai-assistant.js'
        ];
        $this->css = ['css/ai-assistant.css'];
        
        parent::init();
    }
}
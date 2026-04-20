<?php

namespace Solspace\AIAssistant\assets;

use craft\web\AssetBundle;
use craft\web\assets\cp\CpAsset;

/**
 * CP-only assets for the SolspaceAI usage dashboard (Chart.js + page UI).
 */
class SolspaceAiAssetBundle extends AssetBundle
{
    public function init(): void
    {
        $this->sourcePath = __DIR__.'/..';
        $this->depends = [CpAsset::class];
        $this->js = [
            'assets/js/solspaceai.min.js',
        ];
        $this->css = [
            'assets/css/solspaceai.min.css',
        ];

        parent::init();
    }
}

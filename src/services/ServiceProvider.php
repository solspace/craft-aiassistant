<?php

namespace Solspace\AIAssistant\services;

use Solspace\AIAssistant\services\helpers\JavaScriptHelper;
use yii\base\Component;

class ServiceProvider extends Component
{
    public JavaScriptHelper $javaScriptHelper;

    public function init(): void
    {
        parent::init();
        $this->initializeHelpers();
    }

    public function initializeJavaScript(array $settings, string $iconPath): void
    {
        $this->javaScriptHelper->initializeJavaScript($settings, $iconPath);
    }

    private function initializeHelpers(): void
    {
        $this->javaScriptHelper = new JavaScriptHelper();
    }
}

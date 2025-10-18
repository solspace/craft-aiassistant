<?php

namespace Solspace\AIAssistant\services;

use yii\base\Component;
use Solspace\AIAssistant\services\helpers\JavaScriptHelper;

class ServiceProvider extends Component
{
    public JavaScriptHelper $javaScriptHelper;

    public function init(): void
    {
        parent::init();
        $this->initializeHelpers();
    }

    private function initializeHelpers(): void
    {
        $this->javaScriptHelper = new JavaScriptHelper();
    }

    public function initializeJavaScript(array $settings, string $iconPath): void
    {
        $this->javaScriptHelper->initializeJavaScript($settings, $iconPath);
    }
}
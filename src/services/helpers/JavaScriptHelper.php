<?php

namespace Solspace\AIAssistant\services\helpers;

use Craft;
use craft\web\View;
use yii\base\Component;

class JavaScriptHelper extends Component
{
    public function initializeJavaScript(array $settings, string $iconPath): void
    {
        $view = Craft::$app->getView();

        $this->registerSettings($view, $settings);
        $this->registerIcon($view, $iconPath);
    }

    private function registerSettings(View $view, array $settings): void
    {
        $jsSettings = "window.aiAssistantSettings = " . json_encode($settings, JSON_THROW_ON_ERROR) . ";";
        $view->registerJs($jsSettings, View::POS_HEAD);
    }

    private function registerIcon(View $view, string $iconPath): void
    {
        $iconSvg = $this->loadIconSvg($iconPath);
        $iconSvg = $this->minifySvg($iconSvg);
        
        $iconVarJs = 'window.aiAssistantIconSvg = ' . json_encode($iconSvg, JSON_THROW_ON_ERROR) . ';';
        $view->registerJs($iconVarJs, View::POS_HEAD);
    }

    private function loadIconSvg(string $iconPath): string
    {
        if (!file_exists($iconPath)) {
            throw new \Exception("Icon file not found: {$iconPath}");
        }

        $content = file_get_contents($iconPath);
        if ($content === false) {
            throw new \Exception("Could not read icon file: {$iconPath}");
        }

        return $content;
    }

    private function minifySvg(string $svgContent): string
    {
        $svgContent = preg_replace('/\s+/', ' ', $svgContent);
        $svgContent = trim($svgContent);
        
        return $svgContent;
    }
}
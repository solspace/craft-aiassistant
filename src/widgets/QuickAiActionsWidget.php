<?php

namespace Solspace\AIAssistant\widgets;

use Craft;
use craft\base\Widget;
use craft\web\View;
use Solspace\AIAssistant\AiAssistant;

class QuickAiActionsWidget extends Widget
{
    public static function displayName(): string
    {
        return Craft::t('app', 'AI Assistant Quick Actions');
    }

    public static function icon(): ?string
    {
        return null; // Use Craft's fallback icon system
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
        $view = Craft::$app->getView();
        
        // Get available prompts and integrations
        $promptService = AiAssistant::getPromptService();
        $integrationService = AiAssistant::getIntegrationService();
        
        $prompts = $promptService->getAllPrompts();
        $integrations = $integrationService->getEnabledIntegrations();
        
        return $view->renderTemplate('ai-assistant/widgets/quick-ai-actions', [
            'prompts' => $prompts,
            'integrations' => $integrations,
        ], View::TEMPLATE_MODE_CP);
    }

    public function getSettingsHtml(): ?string
    {
        return null; // No settings needed for this widget
    }
}

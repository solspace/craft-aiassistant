<?php

namespace Solspace\AIAssistant\controllers;

use craft\web\Controller;
use Solspace\AIAssistant\AiAssistant;
use yii\web\Response;

class UiController extends Controller
{
    protected array|bool|int $allowAnonymous = false;

    public function actionGenerateTextModal(): Response
    {
        $this->requireCpRequest();

        $html = \Craft::$app->getView()->renderTemplate('ai-assistant/modals/generate-text', []);

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
}

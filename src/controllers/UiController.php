<?php

namespace Solspace\AIAssistant\controllers;

use craft\web\Controller;
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
}

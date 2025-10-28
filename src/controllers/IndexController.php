<?php

namespace Solspace\AIAssistant\controllers;

use craft\helpers\UrlHelper;
use craft\web\Controller;
use yii\web\Response;

class IndexController extends Controller
{
    protected array|bool|int $allowAnonymous = false;

    public function actionIndex(): Response
    {
        // Redirect to prompts section by default
        return $this->redirect(UrlHelper::cpUrl('ai-assistant/prompts'));
    }
}

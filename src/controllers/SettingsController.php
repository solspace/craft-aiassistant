<?php

namespace Solspace\AIAssistant\controllers;

use craft\web\Controller;

class SettingsController extends Controller
{
    protected array|bool|int $allowAnonymous = false;

    public function actionIndex(): ?\yii\web\Response
    {
        $plugin = \Craft::$app->plugins->getPlugin('ai-assistant');
        $settings = $plugin->getSettings();

        $fieldsService = \Craft::$app->getFields();
        $allFields = [];
        // Add Title pseudo field
        $allFields[] = [
            'handle' => 'title',
            'name' => 'Title',
            'type' => 'craft\\fields\\PlainText',
        ];
        foreach ($fieldsService->getAllFields() as $field) {
            try {
                $type = (new \ReflectionClass($field))->getName();
            } catch (\Throwable $e) {
                $type = get_class($field);
            }
            // Supported field classes (expand as needed)
            $supported = [
                'craft\\fields\\PlainText',
                'craft\\ckeditor\\Field',
                'craft\\redactor\\Field',
                'spicyweb\\tinymce\\fields\\TinyMCE',
            ];
            if (!in_array($type, $supported, true)) {
                continue;
            }
            $allFields[] = [
                'handle' => (string)$field->handle,
                'name' => (string)$field->name,
                'type' => $type,
            ];
        }

        return $this->renderTemplate('ai-assistant/settings', [
            'settings' => $settings,
            'plugin' => $plugin,
            'allFields' => $allFields,
        ]);
    }

    public function actionSave(): ?\yii\web\Response
    {
        $this->requirePostRequest();
        
        $plugin = \Craft::$app->plugins->getPlugin('ai-assistant');
        $settings = $plugin->getSettings();
        
        // Get the form data
        $enabledFieldHandles = $this->request->getBodyParam('settings.enabledFieldHandles', []);
        
        // Process the enabledFieldHandles data - only keep checked fields
        $processedHandles = [];
        if (is_array($enabledFieldHandles)) {
            foreach ($enabledFieldHandles as $handle => $value) {
                if ($value === '1' || $value === 1 || $value === true) {
                    $processedHandles[] = $handle;
                }
            }
        }
        
        // Update settings
        $settings->enabledFieldHandles = $processedHandles;
        
        // Save the plugin settings
        if (!\Craft::$app->plugins->savePluginSettings($plugin, $settings->toArray())) {
            \Craft::$app->session->setError('Couldn\'t save settings.');
            return $this->redirectToPostedUrl();
        }
        
        \Craft::$app->session->setNotice('Settings saved.');
        return $this->redirectToPostedUrl();
    }
} 
<?php

namespace Solspace\AIAssistant\controllers;

use craft\errors\FieldNotFoundException;
use craft\fieldlayoutelements\CustomField;
use craft\web\Controller;
use Solspace\AIAssistant\AiAssistant;
use Solspace\AIAssistant\models\Prompt;
use yii\web\Response;

class SettingsController extends Controller
{
    private const SUPPORTED_FIELD_TYPES = [
        'craft\fields\PlainText',
        'craft\ckeditor\Field',
        'craft\redactor\Field',
        'spicyweb\tinymce\fields\TinyMCE',
    ];

    protected array|bool|int $allowAnonymous = false;

    public function actionIndex(): ?Response
    {
        $plugin = \Craft::$app->plugins->getPlugin('ai-assistant');
        $settings = $plugin->getSettings();

        $fieldsService = \Craft::$app->getFields();
        $isCraft5 = version_compare(\Craft::$app->getInfo()->version, '5.0', '>=');

        $allFields = [];

        // Add "Title" pseudo-field
        $allFields[] = [
            'handle' => 'title',
            'name' => 'Title',
            'type' => 'craft\fields\PlainText',
        ];

        // Add all supported custom fields
        foreach ($fieldsService->getAllFields() as $field) {
            try {
                $type = (new \ReflectionClass($field))->getName();
            } catch (\Throwable) {
                $type = $field::class;
            }

            if (!\in_array($type, self::SUPPORTED_FIELD_TYPES, true)) {
                continue;
            }

            $allFields[] = [
                'handle' => (string) $field->handle,
                'name' => (string) $field->name,
                'type' => $type,
            ];
        }

        // Collect supported fields from all entry type layouts
        $_sections = $isCraft5
            ? \Craft::$app->entries->getAllSections()
            : \Craft::$app->sections->getAllSections();

        foreach ($_sections as $section) {
            foreach ($section->getEntryTypes() as $entryType) {
                $layout = $entryType->getFieldLayout();
                if (!$layout) {
                    continue;
                }

                foreach ($layout->getTabs() as $tab) {
                    foreach ($tab->elements as $element) {
                        if (!$element instanceof CustomField) {
                            continue;
                        }

                        // 🛡️ Safely get the field, skipping broken references
                        try {
                            $field = $element->getField();
                        } catch (FieldNotFoundException) {
                            continue; // Skip missing/deleted fields
                        } catch (\Throwable) {
                            continue; // Skip any other unexpected error
                        }

                        if (!$field) {
                            continue;
                        }

                        try {
                            $layoutFieldType = (new \ReflectionClass($field))->getName();
                        } catch (\Throwable) {
                            $layoutFieldType = $field::class;
                        }

                        if (!\in_array($layoutFieldType, self::SUPPORTED_FIELD_TYPES, true)) {
                            continue;
                        }

                        $allFields[] = [
                            'handle' => (string) $field->handle,
                            'name' => (string) $field->name,
                            'type' => $layoutFieldType,
                        ];
                    }
                }
            }
        }

        // Deduplicate fields by handle
        $seenHandles = [];
        $allFields = array_values(array_filter($allFields, function ($f) use (&$seenHandles) {
            if (isset($seenHandles[$f['handle']])) {
                return false;
            }
            $seenHandles[$f['handle']] = true;

            return true;
        }));

        // Get all prompts for the prompt picker
        $promptService = AiAssistant::getPromptService();
        $prompts = $promptService->getAllPrompts();
        $allPrompts = array_map(function ($prompt) {
            return [
                'id' => (string) $prompt->id, // Convert to string for consistent comparison in Twig
                'name' => $prompt->name,
                'type' => $prompt->type,
            ];
        }, $prompts);

        return $this->renderTemplate('ai-assistant/settings/index', [
            'settings' => $settings,
            'plugin' => $plugin,
            'allFields' => $allFields,
            'allPrompts' => $allPrompts,
        ]);
    }

    public function actionSave(): ?Response
    {
        $this->requirePostRequest();

        $plugin = \Craft::$app->plugins->getPlugin('ai-assistant');
        $settings = $plugin->getSettings();

        // Get the form data
        $enabledFieldHandles = $this->request->getBodyParam('settings.enabledFieldHandles', []);
        $fieldPrompts = $this->request->getBodyParam('settings.fieldPrompts', []);

        // Only keep checked fields
        $processedHandles = [];
        if (\is_array($enabledFieldHandles)) {
            foreach ($enabledFieldHandles as $handle => $value) {
                if ('1' === $value || 1 === $value || true === $value) {
                    $processedHandles[] = $handle;
                }
            }
        }

        // Process fieldPrompts - filter out empty values
        $processedFieldPrompts = [];
        if (\is_array($fieldPrompts)) {
            foreach ($fieldPrompts as $handle => $promptId) {
                if (!empty($promptId)) {
                    $processedFieldPrompts[$handle] = (string) $promptId;
                }
            }
        }

        // Update settings
        $settings->enabledFieldHandles = $processedHandles;
        $settings->fieldPrompts = $processedFieldPrompts;

        // Save the plugin settings
        if (!\Craft::$app->plugins->savePluginSettings($plugin, $settings->toArray())) {
            \Craft::$app->session->setError('Couldn’t save settings.');

            return $this->redirectToPostedUrl();
        }

        \Craft::$app->session->setNotice('Settings saved.');

        return $this->redirectToPostedUrl();
    }

    public function actionSavePrompt(): Response
    {
        $this->requirePostRequest();
        $this->requireAcceptsJson();

        try {
            $request = \Craft::$app->getRequest();
            $promptService = AiAssistant::getPromptService();

            $prompt = new Prompt();
            $prompt->name = (string) $request->getBodyParam('name', '');
            $prompt->promptText = (string) $request->getBodyParam('promptText', '');
            $prompt->type = (string) $request->getBodyParam('type', 'generate');
            $integrationHandle = (string) $request->getBodyParam('integrationHandle', '');
            $prompt->integrationHandle = '' !== $integrationHandle ? $integrationHandle : null;
            $prompt->isActive = true;
            $prompt->sortOrder = 0;

            if (!$prompt->validate()) {
                return $this->asJson(['success' => false, 'error' => 'Validation failed']);
            }

            if (!$promptService->savePrompt($prompt)) {
                return $this->asJson(['success' => false, 'error' => 'Save failed']);
            }

            return $this->asJson([
                'success' => true,
                'prompt' => [
                    'id' => $prompt->id,
                    'name' => $prompt->name,
                    'type' => $prompt->type,
                    'integrationHandle' => $prompt->integrationHandle,
                ],
            ]);
        } catch (\Throwable $e) {
            return $this->asJson(['success' => false, 'error' => $e->getMessage()]);
        }
    }
}

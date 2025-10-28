<?php

namespace Solspace\AIAssistant\controllers;

use craft\elements\Asset;
use craft\web\Controller;
use Solspace\AIAssistant\AiAssistant;
use yii\web\Response;

class AssetsController extends Controller
{
    protected array|bool|int $allowAnonymous = false;

    public function actionGenerateAlt(): Response
    {
        $this->requirePostRequest();
        $this->requireAcceptsJson();

        $assetId = (int) $this->request->getBodyParam('assetId');
        $siteId = $this->request->getBodyParam('siteId');
        $promptId = $this->request->getBodyParam('promptId');
        $dryRun = (bool) $this->request->getBodyParam('dryRun', false);
        $custom = (string) $this->request->getBodyParam('custom', '');
        $integrationHandleParam = (string) $this->request->getBodyParam('integration', '');

        $asset = Asset::find()->id($assetId)->siteId($siteId)->status(null)->one();
        if (!$asset) {
            return $this->asJson(['success' => false, 'error' => 'Asset not found']);
        }

        $promptService = new PromptService();
        $integrationService = AiAssistant::getIntegrationService();

        $integrationHandleToUse = '';
        if ($promptId) {
            $altPrompt = $promptService->getPromptById((int) $promptId);
            if (!$altPrompt || empty($altPrompt->integrationHandle)) {
                return $this->asJson(['success' => false, 'error' => 'Selected prompt not found or has no integration']);
            }
            $integrationHandleToUse = $altPrompt->integrationHandle;
        } else {
            // Custom-only flow: pick first enabled integration
            $integrationService = AiAssistant::getIntegrationService();
            $enabled = $integrationService->getEnabledIntegrations();
            if (!empty($enabled)) {
                $integrationHandleToUse = $enabled[0]->handle;
            }
        }
        if ('' === $integrationHandleToUse) {
            return $this->asJson(['success' => false, 'error' => 'No enabled integration found']);
        }

        $context = trim(($asset->title ?: '').' '.($asset->filename ?: ''));
        $baseInstruction = $altPrompt && $altPrompt->promptText ? $altPrompt->promptText : 'Generate concise, descriptive, human-friendly alt text for this image.';
        $instruction = $baseInstruction;
        if ('' !== $custom) {
            $instruction = trim($custom)."\n".$instruction;
        }
        $fullPrompt = $instruction."\nContext: ".$context."\nRequirements: 8–14 words, no trailing period, no quotes.";

        $aiResult = $integrationService->processRequest($integrationHandleToUse, 'text', $fullPrompt, []);

        if (!($aiResult['success'] ?? false)) {
            return $this->asJson($aiResult);
        }

        $alt = trim((string) ($aiResult['content'] ?? ''));
        if ('' === $alt) {
            return $this->asJson(['success' => false, 'error' => 'Empty result from AI']);
        }

        if ($dryRun) {
            return $this->asJson([
                'success' => true,
                'alt' => $alt,
                'promptName' => $altPrompt->name ?? null,
                'saved' => false,
            ]);
        }

        $asset->alt = $alt;
        if (!\Craft::$app->getElements()->saveElement($asset)) {
            return $this->asJson(['success' => false, 'error' => 'Failed to save asset alt text']);
        }

        $result = [
            'success' => true,
            'message' => 'Alt text updated',
            'alt' => $alt,
            'promptName' => $altPrompt->name ?? null,
            'saved' => true,
        ];

        return $this->asJson($result);
    }

    public function actionSaveAlt(): Response
    {
        $this->requirePostRequest();
        $this->requireAcceptsJson();

        $assetId = (int) $this->request->getBodyParam('assetId');
        $siteId = $this->request->getBodyParam('siteId');
        $alt = (string) $this->request->getBodyParam('alt', '');
        $overwrite = (bool) $this->request->getBodyParam('overwrite', false);

        $asset = Asset::find()->id($assetId)->siteId($siteId)->status(null)->one();
        if (!$asset) {
            return $this->asJson(['success' => false, 'error' => 'Asset not found']);
        }
        $alt = trim($alt);
        if ('' === $alt) {
            return $this->asJson(['success' => false, 'error' => 'Alt text cannot be empty']);
        }

        // Try to resolve an appropriate Asset field to store Alt Text
        $savedTo = null;
        $fieldLayout = $asset->getFieldLayout();
        if ($fieldLayout) {
            foreach ($fieldLayout->getCustomFields() as $field) {
                $handle = $field->handle ?? '';
                $name = method_exists($field, 'name') ? ($field->name ?? '') : '';
                $haystack = strtolower($handle.' '.$name);
                if (str_contains($haystack, 'alt')) {
                    if (!$overwrite) {
                        $existing = $asset->getFieldValue($handle);
                        if (\is_string($existing)) {
                            $existing = trim($existing);
                        }
                        if (!empty($existing)) {
                            return $this->asJson([
                                'success' => true,
                                'skipped' => true,
                                'message' => 'Alt text exists, skipped',
                                'savedTo' => $handle,
                            ]);
                        }
                    }
                    $asset->setFieldValue($handle, $alt);
                    $savedTo = $handle;

                    break;
                }
            }
        }

        // Fallback: update the title if no suitable field was found
        if (null === $savedTo) {
            if (!$overwrite && !empty($asset->title)) {
                return $this->asJson([
                    'success' => true,
                    'skipped' => true,
                    'message' => 'Title exists, skipped',
                    'savedTo' => 'title',
                ]);
            }
            $asset->title = $alt;
            $savedTo = 'title';
        }

        if (!\Craft::$app->getElements()->saveElement($asset)) {
            return $this->asJson(['success' => false, 'error' => 'Failed to save asset alt text']);
        }

        return $this->asJson([
            'success' => true,
            'message' => 'Alt text updated',
            'alt' => $alt,
            'savedTo' => $savedTo,
        ]);
    }
}

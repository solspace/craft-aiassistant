<?php

namespace Solspace\AIAssistant;

use craft\base\Field;
use craft\base\Plugin;
use craft\elements\Asset;
use craft\enums\MenuItemType;
use craft\events\DefineFieldHtmlEvent;
use craft\events\DefineMenuItemsEvent;
use craft\events\RegisterComponentTypesEvent;
use craft\helpers\UrlHelper;
use craft\services\Dashboard;
use craft\web\View;
use Solspace\AIAssistant\assets\AiAssistantAsset;
use Solspace\AIAssistant\models\Settings;
use Solspace\AIAssistant\services\IntegrationService;
use Solspace\AIAssistant\services\PromptService;
use Solspace\AIAssistant\services\ServiceProvider;
use Solspace\AIAssistant\widgets\QuickAiActionsWidget;
use yii\base\Event;
use yii\web\Response;

class AiAssistant extends Plugin
{
    /**
     * Plugin instance.
     */
    public static ?AiAssistant $plugin = null;

    /**
     * Whether the plugin has CP settings.
     */
    public bool $hasCpSettings = true;

    /**
     * Plugin icon.
     */
    public string $icon = __DIR__.'/icon.svg';

    /**
     * Plugin schema version.
     */
    public string $schemaVersion = '1.0.0';

    /**
     * Whether the plugin has a CP section.
     */
    public bool $hasCpSection = true;

    /**
     * Service provider instance.
     */
    public ServiceProvider $serviceProvider;

    /**
     * Integration service instance.
     */
    public IntegrationService $integrationService;

    /**
     * Prompt service instance.
     */
    public PromptService $promptService;

    /**
     * Initialize the plugin.
     */
    public function init(): void
    {
        parent::init();
        self::$plugin = $this;

        $this->initializeServices();
        $this->registerRoutes();
        $this->attachEventListeners();
        $this->registerAssetBundles();
        $this->registerWidgets();
    }

    /**
     * Plugins page Settings button opens the CP route.
     */
    public function getSettingsResponse(): ?Response
    {
        return \Craft::$app->getResponse()->redirect(UrlHelper::cpUrl('ai-assistant/settings'));
    }

    /**
     * Get the CP navigation item.
     */
    public function getCpNavItem(): ?array
    {
        $nav = parent::getCpNavItem();
        $nav['label'] = 'AI Assistant';
        $nav['url'] = 'ai-assistant';
        $nav['icon'] = __DIR__.'/icon-mask.svg';

        $nav['subnav'] = [
            'prompts' => [
                'label' => 'Prompts',
                'url' => 'ai-assistant/prompts',
            ],
            'integrations' => [
                'label' => 'Integrations',
                'url' => 'ai-assistant/integrations',
            ],
            'settings' => [
                'label' => 'Settings',
                'url' => 'ai-assistant/settings',
            ],
        ];

        return $nav;
    }

    /**
     * Get the IntegrationService instance.
     */
    public static function getIntegrationService(): IntegrationService
    {
        return self::$plugin->integrationService;
    }

    /**
     * Get the PromptService instance.
     */
    public static function getPromptService(): PromptService
    {
        return self::$plugin->promptService;
    }

    /**
     * Create the settings model.
     */
    protected function createSettingsModel(): Settings
    {
        return new Settings();
    }

    /**
     * Get the settings HTML.
     */
    protected function settingsHtml(): string
    {
        return \Craft::$app->getView()->renderTemplate(
            'ai-assistant/settings',
            ['settings' => $this->getSettings()]
        );
    }

    /**
     * Initialize services.
     */
    private function initializeServices(): void
    {
        $this->serviceProvider = new ServiceProvider();
        $this->integrationService = new IntegrationService();
        $this->promptService = new PromptService();
    }

    /**
     * Register plugin routes.
     */
    private function registerRoutes(): void
    {
        $routes = [];
        if (\Craft::$app->getRequest()->getIsCpRequest()) {
            $routes = [
                // Main pages
                'ai-assistant' => 'ai-assistant/index',
                'ai-assistant/prompts' => 'ai-assistant/prompts/index',
                'ai-assistant/prompts/new' => 'ai-assistant/prompts/edit',
                'ai-assistant/prompts/edit' => 'ai-assistant/prompts/edit',
                'ai-assistant/prompts/<id:\d+>' => 'ai-assistant/prompts/edit',
                'ai-assistant/integrations' => 'ai-assistant/integrations/index',
                'ai-assistant/integrations/new' => 'ai-assistant/integrations/edit',
                'ai-assistant/integrations/<id:\d+>' => 'ai-assistant/integrations/edit',
                'ai-assistant/settings' => 'ai-assistant/settings/index',
                'ai-assistant/settings/save' => 'ai-assistant/settings/save',
                'ai-assistant/settings/save-prompt' => 'ai-assistant/settings/save-prompt',

                // API endpoints
                'ai-assistant/api/integrations' => 'ai-assistant/api/get-integrations',
                'ai-assistant/api/prompts' => 'ai-assistant/api/get-prompts',
                'ai-assistant/api/generate-text' => 'ai-assistant/api/generate-text',
                'ai-assistant/api/generate-image' => 'ai-assistant/api/generate-image',
                'ai-assistant/api/save-image-to-assets' => 'ai-assistant/api/save-image-to-assets',
                'ai-assistant/api/get-asset-url' => 'ai-assistant/api/get-asset-url',
                'ai-assistant/api/stream-asset' => 'ai-assistant/api/stream-asset',
                'ai-assistant/integrations/test' => 'ai-assistant/integrations/test',
                'ai-assistant/api/save-prompt' => 'ai-assistant/api/save-prompt',

                // UI endpoints
                'ai-assistant/ui/generate-text-modal' => 'ai-assistant/ui/generate-text-modal',
                'ai-assistant/ui/prompt-edit-modal' => 'ai-assistant/ui/prompt-edit-modal',
                'ai-assistant/ui/generate-image-modal' => 'ai-assistant/ui/generate-image-modal',
                'ai-assistant/ui/generate-from-asset-modal' => 'ai-assistant/ui/generate-from-asset-modal',
            ];
        }
        // Site-accessible endpoint for temporary public streaming (token-protected)
        $routes['ai-assistant/api/public-stream-asset'] = 'ai-assistant/api/public-stream-asset';

        \Craft::$app->getUrlManager()->addRules($routes);
    }

    /**
     * Attach event listeners.
     */
    private function attachEventListeners(): void
    {
        $this->attachFieldInjectionListener();
        $this->attachAssetMenuListener();
    }

    /**
     * Attach field injection listener for server-side field detection.
     */
    private function attachFieldInjectionListener(): void
    {
        Event::on(
            Field::class,
            Field::EVENT_DEFINE_INPUT_HTML,
            function (DefineFieldHtmlEvent $event) {
                $this->injectAiAssistantFieldTag($event);
            }
        );
    }

    /**
     * Inject AI Assistant field tag into enabled fields.
     */
    private function injectAiAssistantFieldTag(DefineFieldHtmlEvent $event): void
    {
        $settings = $this->getSettings();
        $enabledFieldHandles = $settings->enabledFieldHandles ?? [];

        $fieldHandle = $event->sender->handle;
        if (!\in_array($fieldHandle, $enabledFieldHandles)) {
            return;
        }

        $supportedTypes = [
            'craft\fields\PlainText',
            'craft\ckeditor\Field',
            'craft\redactor\Field',
            'spicyweb\tinymce\fields\TinyMCE',
            'craft\fields\Assets',
        ];

        $fieldType = (new \ReflectionClass($event->sender))->getName();
        if (!\in_array($fieldType, $supportedTypes)) {
            return;
        }

        // Get field-specific prompt ID if set
        $fieldPrompts = $settings->fieldPrompts ?? [];
        $fieldSpecificPromptId = $fieldPrompts[$fieldHandle] ?? '';

        $fieldTag = \sprintf(
            '<div class="ai-assistant-field" data-field-handle="%s" data-field-type="%s" data-element="%s" data-field-prompt="%s" data-not-scanned></div>',
            htmlspecialchars($fieldHandle),
            htmlspecialchars($fieldType),
            htmlspecialchars($event->element->id),
            htmlspecialchars($fieldSpecificPromptId)
        );

        $event->html .= $fieldTag;
    }

    /**
     * Register asset bundles and initialize JavaScript.
     */
    private function registerAssetBundles(): void
    {
        Event::on(
            View::class,
            View::EVENT_BEGIN_BODY,
            function () {
                if (!\Craft::$app->getRequest()->getIsCpRequest()) {
                    return;
                }

                $this->registerAssetBundle();
                $this->initializeJavaScript();
            }
        );
    }

    /**
     * Register the main asset bundle.
     */
    private function registerAssetBundle(): void
    {
        \Craft::$app->getView()->registerAssetBundle(AiAssistantAsset::class);
    }

    /**
     * Initialize JavaScript with settings and icon.
     */
    private function initializeJavaScript(): void
    {
        $settings = $this->getSettings();
        $iconPath = __DIR__.'/icon-mask.svg';

        $this->serviceProvider->initializeJavaScript(
            $settings->toArray(),
            $iconPath
        );
    }

    /**
     * Attach asset menu listener to add AI Assistant option for images.
     */
    private function attachAssetMenuListener(): void
    {
        Event::on(
            Asset::class,
            Asset::EVENT_DEFINE_ACTION_MENU_ITEMS,
            function (DefineMenuItemsEvent $event) {
                /** @var Asset $asset */
                $asset = $event->sender;

                // Only show for image assets
                if (Asset::KIND_IMAGE !== $asset->kind) {
                    return;
                }

                $view = \Craft::$app->getView();
                $aiAssistantId = \sprintf('action-ai-assistant-%s', mt_rand());

                // Read AI Assistant icon
                $iconPath = __DIR__.'/icon-mask.svg';
                $iconSvg = file_exists($iconPath) ? file_get_contents($iconPath) : null;

                // Add AI Assistant menu item
                $items = $event->items;
                $items[] = [
                    'type' => MenuItemType::Button,
                    'id' => $aiAssistantId,
                    'icon' => $iconSvg ?: 'sparkles',
                    'label' => \Craft::t('ai-assistant', 'AI Assistant'),
                ];

                // Register JavaScript to open AI Assistant modal from asset
                $view->registerJsWithVars(fn ($id, $assetId, $assetUrl) => <<<JS
                    $('#' + {$id}).on('activate', () => {
                      if (window.AiAssistantModal && window.AiAssistantModal.openFromAssetModal) {
                        window.AiAssistantModal.openFromAssetModal({$assetId}, {$assetUrl});
                      } else {
                        Craft.cp.displayError('AI Assistant is not available');
                      }
                    });
                    JS, [
                    $view->namespaceInputId($aiAssistantId),
                    $asset->id,
                    $asset->getUrl() ?? '',
                ]);

                $event->items = $items;
            }
        );
    }

    /**
     * Register custom widgets.
     */
    private function registerWidgets(): void
    {
        Event::on(
            Dashboard::class,
            Dashboard::EVENT_REGISTER_WIDGET_TYPES,
            function (RegisterComponentTypesEvent $event) {
                $event->types[] = QuickAiActionsWidget::class;
            }
        );
    }
}

/**
 * Generate Modal View
 * Handles the main AI generation modal
 */

import {
  getFieldInput,
  getFieldHandle,
  getFieldType,
} from '../../utils/field.js';
import { createModal, injectModalIcon } from '../../components/modal.js';
import { renderImageSlider } from '../../components/image-slider.js';
import {
  fetchModalHtml,
  loadIntegrations,
  loadPrompts,
  generateText,
  generateImage,
  saveImageToAssets,
} from '../../services/api.js';

/**
 * Open generate modal for a field - full implementation
 */
export async function openGenerateModal(field) {
  // Get field type from the injected AI Assistant field tag
  const fieldTag = field.querySelector('.ai-assistant-field');
  const fieldType = fieldTag
    ? fieldTag.dataset.fieldType
    : 'craft\\fields\\PlainText';

  try {
    const modalHtml = await fetchModalHtml(
      Craft.getCpUrl('ai-assistant/ui/generate-text-modal')
    );
    const modal = createModal(modalHtml);

    // Wait for modal to be fully initialized before accessing elements
    const initializeModalElements = () => {
      try {
        const modalElement = document.querySelector('.modal:last-of-type');
        if (!modalElement) {
          setTimeout(initializeModalElements, 50);
          return;
        }

        const $body = $(modalElement).find('.body');
        if (!$body || !$body.length) {
          setTimeout(initializeModalElements, 50);
          return;
        }

        // Initialize Craft UI elements inside modal
        try {
          if (typeof Craft.initUiElements === 'function') {
            Craft.initUiElements($body);
          }
        } catch (e) {
          // ignore
        }

        // Inject AI Assistant icon into modal header
        injectModalIcon(modalElement);

        // Get modal elements
        const $integrationSelect = $body.find(
          'select[name="aiassistant-text-integration"]'
        );
        const $promptSelect = $body.find(
          'select[name="aiassistant-text-prompt"]'
        );
        const $promptText = $body.find(
          'textarea[name="aiassistant-text-prompt-text"]'
        );
        const $btnGenerate = modal.$container.find(
          'button#aiassistant-text-generate'
        );
        const $btnInsert = modal.$container.find(
          'button#aiassistant-text-insert'
        );
        const $loading = modal.$container.find('#aiassistant-text-loading');
        const $imageOptions = $body.find('#aiassistant-image-options');
        const $imageCol = $body.find('#aiassistant-image-col');
        const $promptLeft = $body.find('#aiassistant-prompt-left');
        const $imageSize = $body.find('#aiassistant-image-size');
        const $imageCount = $body.find('#aiassistant-image-count');
        const $assetTarget = $body.find('#aiassistant-asset-target');
        const $imagePreviewRight = $body.find(
          '#aiassistant-image-preview-right'
        );

        // Always use comparison layout
        const inputObj = getFieldInput(field);
        const fieldType = inputObj ? inputObj.type : 'input';

        const $comparisonSection = $body.find('#aiassistant-text-comparison');
        const $fallbackInput = $body.find('#aiassistant-text-input-fallback');
        const $fallbackGenerated = $body.find(
          '#aiassistant-text-generated-fallback'
        );

        $comparisonSection.show();
        $fallbackInput.hide();
        $fallbackGenerated.hide();
        $imageOptions.hide();
        if ($imageCol.length) {
          $imageCol.hide();
        }

        // Initialize rich text editors
        initializeRichTextEditors(fieldType, field, $comparisonSection);

        const $inputContext = $comparisonSection.find(
          '#aiassistant-text-input-rich'
        );
        const $includeContext = $body.find('#aiassistant-include-context');
        const $input = $comparisonSection.find(
          '#aiassistant-text-generated-rich'
        );

        // Get field handle and field-specific prompt ID
        const fieldHandle = getFieldHandle(field);
        let fieldSpecificPromptId = '';

        const fieldTag = field.querySelector('.ai-assistant-field');
        if (fieldTag && fieldTag.dataset.fieldPrompt) {
          fieldSpecificPromptId = fieldTag.dataset.fieldPrompt;
        }

        if (!fieldSpecificPromptId && fieldHandle) {
          const $hiddenInput = $(document).find(
            `input[name="settings[fieldPrompts][${fieldHandle}]"]`
          );
          if ($hiddenInput.length && $hiddenInput.val()) {
            fieldSpecificPromptId = $hiddenInput.val();
          }
        }

        if (
          !fieldSpecificPromptId &&
          fieldHandle &&
          window.aiAssistantSettings &&
          window.aiAssistantSettings.fieldPrompts
        ) {
          const fromSettings =
            window.aiAssistantSettings.fieldPrompts[fieldHandle];
          if (fromSettings) {
            fieldSpecificPromptId = fromSettings;
          }
        }

        // Load data and set up handlers
        Promise.all([loadIntegrations(), loadPrompts()])
          .then(([integrations, prompts]) => {
            // Populate integrations with type data attribute
            $integrationSelect.empty();
            if (integrations && integrations.length) {
              integrations.forEach((integration) => {
                $integrationSelect.append(
                  `<option value="${integration.handle}" data-type="${integration.type || ''}">${integration.name}</option>`
                );
              });
            }

            // Populate prompts
            $promptSelect.empty();
            if (prompts && prompts.length) {
              prompts.forEach((prompt) => {
                const safeText = (prompt.promptText || '').replace(
                  /"/g,
                  '&quot;'
                );
                $promptSelect.append(
                  `<option value="${prompt.id}" data-integration="${
                    prompt.integrationHandle || ''
                  }" data-type="${
                    prompt.type || ''
                  }" data-prompt-text="${safeText}">${prompt.name}</option>`
                );
              });
              $promptSelect.append('<option value="custom">Custom…</option>');
            }

            // Ensure lightswitch is initialized
            if ($includeContext && $includeContext.length) {
              const $lsContainer = $includeContext.closest('.lightswitch');
              if (
                $lsContainer &&
                $lsContainer.length &&
                !$lsContainer.data('lightswitch')
              ) {
                try {
                  new Garnish.LightSwitch($lsContainer);
                } catch (e) {
                  /* noop */
                }
              }
            }

            // Select field-specific prompt if available
            if (
              fieldSpecificPromptId &&
              $promptSelect.find(`option[value="${fieldSpecificPromptId}"]`)
                .length > 0
            ) {
              $promptSelect.val(fieldSpecificPromptId);
              // Manually populate textarea for initial selection
              const selectedOpt = $promptSelect.find(
                `option[value="${fieldSpecificPromptId}"]`
              );
              const promptTextValue = selectedOpt.data('prompt-text') || '';
              if (promptTextValue) {
                const tempDiv = $('<div>').html(promptTextValue);
                $promptText.val(tempDiv.text());
              }
              // Set integration from prompt if it has one
              const promptIntegration = selectedOpt.data('integration') || '';
              if (
                promptIntegration &&
                $integrationSelect.find(`option[value="${promptIntegration}"]`)
                  .length
              ) {
                $integrationSelect.val(promptIntegration);
              }
              // Trigger change after a small delay to ensure handlers are attached
              setTimeout(() => {
                $promptSelect.trigger('change');
              }, 10);
            } else if (prompts && prompts.length > 0) {
              const firstPrompt = prompts[0];
              $promptSelect.val(firstPrompt.id);
              // Manually populate textarea for initial selection
              const selectedOpt = $promptSelect.find(
                `option[value="${firstPrompt.id}"]`
              );
              const promptTextValue =
                selectedOpt.data('prompt-text') || firstPrompt.promptText || '';
              if (promptTextValue) {
                const tempDiv = $('<div>').html(promptTextValue);
                $promptText.val(tempDiv.text());
              }
              // Set integration from prompt if it has one
              const promptIntegration = selectedOpt.data('integration') || '';
              if (
                promptIntegration &&
                $integrationSelect.find(`option[value="${promptIntegration}"]`)
                  .length
              ) {
                $integrationSelect.val(promptIntegration);
              }
              // Trigger change after a small delay to ensure handlers are attached
              setTimeout(() => {
                $promptSelect.trigger('change');
              }, 10);
            }

            // Populate input context with current field value
            if (inputObj && inputObj.element) {
              const currentValue =
                typeof inputObj.value === 'function'
                  ? inputObj.value()
                  : inputObj.element.value || '';
              if (currentValue) {
                if ($inputContext.hasClass('aiassistant-rich-editor')) {
                  $inputContext.html(currentValue);
                } else {
                  $inputContext.val(currentValue);
                }
              }
            }

            // Check if selected integration supports image generation
            function integrationSupportsImage() {
              if (!$integrationSelect || !$integrationSelect.val()) {
                return false;
              }
              const selectedOption = $integrationSelect.find('option:selected');
              if (!selectedOption.length) {
                return false;
              }
              const integrationType = (selectedOption.data('type') || selectedOption.attr('data-type') || '').toLowerCase();
              const imageCapableTypes = ['openai', 'replicate'];
              return imageCapableTypes.includes(integrationType);
            }

            // Check if we should show image options based on prompt type
            // Image options are shown based on prompt type, not integration
            function shouldShowImageOptions(promptType) {
              const type = (promptType || '').toLowerCase();
              // Show image options if prompt type is 'image'
              return type === 'image';
            }

            // Toggle image vs text mode, and wire handlers accordingly
            function toggleImageMode(type) {
              const showImageOptions = shouldShowImageOptions(type);
              if (showImageOptions) {
                if ($imageCol.length) {
                  $imageCol.show();
                  $imageCol.css({ flex: '0 0 49%', maxWidth: '49%' });
                }
                $imageOptions.show();
                if ($promptLeft.length) {
                  $promptLeft.css({ flex: '0 0 49%', maxWidth: '49%' });
                }
                $comparisonSection.show();
                // Switch right panel to image preview mode
                const $genTitle = $body.find('#aiassistant-generated-title');
                const $genInstr = $body.find(
                  '#aiassistant-generated-instructions'
                );
                const $genText = $body.find('#aiassistant-text-generated-rich');
                const $imgPrevRight = $body.find(
                  '#aiassistant-image-preview-right'
                );
                if ($genTitle.length) $genTitle.text('Generated Image');
                if ($genInstr.length)
                  $genInstr.text(
                    'Preview the generated image(s). Click Save to persist to Assets.'
                  );
                $genText.hide();
                // Ensure image preview container is visible
                if ($imgPrevRight.length) {
                  $imgPrevRight.removeClass('aiassistant-hidden').show();
                }
                renderImageSlider($imgPrevRight, []);
                $btnInsert.data('previewUrls', []);
                // Change Insert button label to Save
                $btnInsert.text('Save').prop('disabled', true);
                // Rewire generate for image (dry-run)
                $btnGenerate.off('click').on('click', async function () {
                  const payload = {
                    prompt: $promptText.val(),
                    integration: $integrationSelect.val(),
                    count: parseInt($imageCount.val() || '1', 10),
                    assetTarget: (function () {
                      if (
                        $assetTarget &&
                        $assetTarget.length &&
                        $assetTarget.val()
                      ) {
                        return $assetTarget.val();
                      }
                      const selId = String($promptSelect.val());
                      const p = (prompts || []).find(
                        (pp) => String(pp.id) === selId
                      );
                      return p && p.assetTarget ? p.assetTarget : undefined;
                    })(),
                    options: {},
                    dryRun: true,
                  };
                  const sizeVal = ($imageSize.val() || '').trim();
                  if (sizeVal) {
                    payload.size = sizeVal;
                  }
                  // Include input context if requested
                  const includeContext = (() => {
                    if (!$includeContext || !$includeContext.length) {
                      return true;
                    }
                    const $ls = $includeContext.closest('.lightswitch');
                    if ($ls && $ls.length) {
                      return $ls.hasClass('on');
                    }
                    if ($includeContext.is(':checkbox')) {
                      return $includeContext.is(':checked');
                    }
                    const val =
                      ($includeContext.val && $includeContext.val()) || '1';
                    return val === '1' || val === 'true';
                  })();
                  const contextValue = (() => {
                    if (!$inputContext || !$inputContext.length) {
                      return '';
                    }
                    if ($inputContext.hasClass('aiassistant-rich-editor')) {
                      return ($inputContext.text() || '').trim();
                    }
                    if ($inputContext.is('textarea, input')) {
                      return ($inputContext.val() || '').trim();
                    }
                    return ($inputContext.text() || '').trim();
                  })();
                  if (includeContext && contextValue) {
                    payload.prompt = `${payload.prompt}\n\n${contextValue}`;
                  }
                  if (!payload.prompt) {
                    Craft.cp.displayError('Prompt is required');
                    return;
                  }
                  $btnGenerate.prop('disabled', true);
                  if ($loading && $loading.length) {
                    $loading.removeClass('aiassistant-hidden').show();
                  }
                  renderImageSlider($imgPrevRight, []);
                  try {
                    const result = await generateImage(payload);
                    if (!result.success) {
                      Craft.cp.displayError(
                        result.error || 'Failed to generate image'
                      );
                      if ($loading && $loading.length) {
                        $loading.addClass('aiassistant-hidden').hide();
                      }
                      $btnGenerate.prop('disabled', false);
                      return;
                    }
                    const previews = result.previewUrls || [];
                    console.log('Image generation result:', result);
                    console.log('Preview URLs:', previews);
                    if (previews.length > 0) {
                      renderImageSlider($imgPrevRight, previews);
                      $btnInsert.data('previewUrls', previews);
                    } else {
                      Craft.cp.displayError(
                        'No images were returned from the API'
                      );
                      renderImageSlider($imgPrevRight, []);
                      $btnInsert.data('previewUrls', []);
                    }
                    // Save handler persists images
                    if (previews.length > 0) {
                      $btnInsert.prop('disabled', false);
                      $btnInsert.off('click').on('click', async function () {
                        $btnInsert.prop('disabled', true);
                        if ($loading && $loading.length) {
                          $loading.removeClass('aiassistant-hidden').show();
                        }
                        try {
                          const saveResult = await saveImageToAssets(
                            previews,
                            (function () {
                              if (
                                $assetTarget &&
                                $assetTarget.length &&
                                $assetTarget.val()
                              ) {
                                return $assetTarget.val();
                              }
                              const selId = String($promptSelect.val());
                              const p = (prompts || []).find(
                                (pp) => String(pp.id) === selId
                              );
                              return p && p.assetTarget
                                ? p.assetTarget
                                : undefined;
                            })(),
                            ($promptText.val() || '').slice(0, 60)
                          );
                          if (!saveResult.success) {
                            Craft.cp.displayError(
                              saveResult.error || 'Failed to save image(s)'
                            );
                            return;
                          }
                          const createdAssets = saveResult.assets || [];
                          const inputObj2 = getFieldInput(field);
                          if (inputObj2 && inputObj2.type === 'assets') {
                            const hidden = field.querySelector(
                              'input[type="hidden"]'
                            );
                            if (hidden) {
                              hidden.value = createdAssets
                                .map((a) => a.id)
                                .join(',');
                              $(hidden).trigger('change');
                            }
                          }
                          modal.hide();
                        } catch (e) {
                          Craft.cp.displayError('Failed to save image(s)');
                        } finally {
                          $btnInsert.prop('disabled', false);
                          if ($loading && $loading.length) {
                            $loading.addClass('aiassistant-hidden').hide();
                          }
                        }
                      });
                    } else {
                      renderImageSlider($imgPrevRight, []);
                      $btnInsert.prop('disabled', true);
                      $btnInsert.data('previewUrls', []);
                    }
                  } catch (e) {
                    console.error('Image generation error:', e);
                    Craft.cp.displayError(
                      'Failed to generate image: ' +
                        (e.message || 'Unknown error')
                    );
                    renderImageSlider($imgPrevRight, []);
                    $btnInsert.data('previewUrls', []);
                  } finally {
                    $btnGenerate.prop('disabled', false);
                    if ($loading && $loading.length) {
                      $loading.addClass('aiassistant-hidden').hide();
                    }
                  }
                });
              } else {
                $imageOptions.hide();
                if ($imageCol.length) {
                  $imageCol.hide();
                  $imageCol.css({ flex: '', maxWidth: '' });
                }
                if ($promptLeft.length) {
                  $promptLeft.css({ flex: '0 0 100%', maxWidth: '100%' });
                }
                $comparisonSection.show();
                // Rewire handlers back to text generation
                $btnInsert.prop('disabled', true);
                $btnInsert.text('Insert');
                $btnGenerate.off('click');
                $btnInsert.off('click');
                setupGenerateHandler(
                  $btnGenerate,
                  $promptText,
                  $inputContext,
                  $integrationSelect,
                  $input,
                  $btnInsert,
                  $loading,
                  field,
                  $includeContext
                );
                // Reset right panel - hide image preview, show text
                const $genText = $body.find('#aiassistant-text-generated-rich');
                const $imgPrevRight = $body.find(
                  '#aiassistant-image-preview-right'
                );
                $genText.show();
                if ($imgPrevRight.length) {
                  $imgPrevRight.addClass('aiassistant-hidden').hide();
                }
                renderImageSlider($imgPrevRight, []);
                setupInsertHandler($btnInsert, $input, modal, field);
              }
            }

            // Only set up handlers if buttons exist
            if ($btnGenerate.length > 0 && $btnInsert.length > 0) {
              setupGenerateHandler(
                $btnGenerate,
                $promptText,
                $inputContext,
                $integrationSelect,
                $input,
                $btnInsert,
                $loading,
                field,
                $includeContext
              );

              setupInsertHandler($btnInsert, $input, modal, field);
              setupCancelHandler(modal);
            }

            // Toggle image mode when prompt changes and prefill image defaults
            $promptSelect.on('change', function () {
              const opt = $(this).find('option:selected');
              const selectedVal = String($(this).val() || '');
              const type = opt.data('type') || '';

              // Populate prompt text textarea
              if (selectedVal === 'custom') {
                // Clear textarea for custom prompt
                $promptText.val('');
              } else {
                // Get prompt text from data attribute or from prompts array
                let promptTextValue = opt.data('prompt-text') || '';
                if (!promptTextValue) {
                  // Fallback: find in prompts array
                  const selId = String(selectedVal);
                  const p = (prompts || []).find(
                    (pp) => String(pp.id) === selId
                  );
                  if (p && p.promptText) {
                    promptTextValue = p.promptText;
                  }
                }
                // Decode HTML entities
                if (promptTextValue) {
                  const tempDiv = $('<div>').html(promptTextValue);
                  promptTextValue = tempDiv.text();
                  $promptText.val(promptTextValue);
                }
              }

              // Update integration select if prompt has specific integration
              const promptIntegration = opt.data('integration') || '';
              if (
                promptIntegration &&
                $integrationSelect.find(`option[value="${promptIntegration}"]`)
                  .length
              ) {
                $integrationSelect.val(promptIntegration);
              }

              toggleImageMode(type);
              if (shouldShowImageOptions(type)) {
                const selId = String(selectedVal);
                const p = (prompts || []).find((pp) => String(pp.id) === selId);
                if (p) {
                  // Set image size - use prompt value or default to "1024x1024"
                  if ($imageSize.length) {
                    $imageSize.val(p.imageSize || '1024x1024');
                  }
                  // Set image count - use prompt value or default to 1
                  if ($imageCount.length) {
                    $imageCount.val(p.imageCount || '1');
                  }
                  // Set asset target - use prompt value or default to first option
                  if ($assetTarget.length) {
                    if (p.assetTarget) {
                      if ($assetTarget.find(`option[value="${p.assetTarget}"]`).length) {
                        $assetTarget.val(p.assetTarget);
                      } else {
                        // If prompt value doesn't exist, use first option
                        const firstOption = $assetTarget.find('option').first();
                        if (firstOption.length) {
                          $assetTarget.val(firstOption.val());
                        }
                      }
                    } else {
                      // No prompt value, use first option or existing value
                      if (!$assetTarget.val() || $assetTarget.val() === '') {
                        const firstOption = $assetTarget.find('option').first();
                        if (firstOption.length) {
                          $assetTarget.val(firstOption.val());
                        }
                      }
                    }
                  }
                } else {
                  // No prompt found, set defaults
                  if ($imageSize.length && !$imageSize.val()) {
                    $imageSize.val('1024x1024');
                  }
                  if ($imageCount.length && !$imageCount.val()) {
                    $imageCount.val('1');
                  }
                  if ($assetTarget.length && (!$assetTarget.val() || $assetTarget.val() === '')) {
                    const firstOption = $assetTarget.find('option').first();
                    if (firstOption.length) {
                      $assetTarget.val(firstOption.val());
                    }
                  }
                }
              }
            });

            // Note: Image options visibility is based on prompt type, not integration
            // Integration change doesn't affect visibility, only generation capability
            // Initial toggle - ensure image options are shown if prompt type is 'image'
            // Run after a small delay to ensure change handler has completed
            setTimeout(() => {
              const initOpt = $promptSelect.find('option:selected');
              if (initOpt && initOpt.length) {
                const initType = initOpt.data('type') || '';
                const initVal = String($promptSelect.val() || '');
                // Force toggle to ensure image options are visible if needed
                if ((initType || '').toLowerCase() === 'image') {
                  toggleImageMode(initType);
                  // Also prefill image options from prompt data with defaults
                  if (initVal !== 'custom') {
                    const p = (prompts || []).find((pp) => String(pp.id) === initVal);
                    if (p) {
                      // Set image size - use prompt value or default to "1024x1024"
                      if ($imageSize.length) {
                        $imageSize.val(p.imageSize || '1024x1024');
                      }
                      // Set image count - use prompt value or default to 1
                      if ($imageCount.length) {
                        $imageCount.val(p.imageCount || '1');
                      }
                      // Set asset target - use prompt value or default to first option
                      if ($assetTarget.length) {
                        if (p.assetTarget) {
                          if ($assetTarget.find(`option[value="${p.assetTarget}"]`).length) {
                            $assetTarget.val(p.assetTarget);
                          } else {
                            const firstOption = $assetTarget.find('option').first();
                            if (firstOption.length) {
                              $assetTarget.val(firstOption.val());
                            }
                          }
                        } else {
                          if (!$assetTarget.val() || $assetTarget.val() === '') {
                            const firstOption = $assetTarget.find('option').first();
                            if (firstOption.length) {
                              $assetTarget.val(firstOption.val());
                            }
                          }
                        }
                      }
                    } else {
                      // No prompt found, set defaults
                      if ($imageSize.length && !$imageSize.val()) {
                        $imageSize.val('1024x1024');
                      }
                      if ($imageCount.length && !$imageCount.val()) {
                        $imageCount.val('1');
                      }
                      if ($assetTarget.length && (!$assetTarget.val() || $assetTarget.val() === '')) {
                        const firstOption = $assetTarget.find('option').first();
                        if (firstOption.length) {
                          $assetTarget.val(firstOption.val());
                        }
                      }
                    }
                  }
                }
              }
            }, 100);
          })
          .catch((error) => {
            Craft.cp.displayError('Failed to load modal data');
          });
      } catch (error) {
        Craft.cp.displayError('Failed to initialize modal');
      }
    };

    setTimeout(initializeModalElements, 100);
  } catch (error) {
    Craft.cp.displayError('Failed to load modal');
  }
}

function initializeRichTextEditors(fieldType, field, $comparisonSection) {
  const $inputRich = $comparisonSection.find('#aiassistant-text-input-rich');
  const $generatedRich = $comparisonSection.find(
    '#aiassistant-text-generated-rich'
  );

  const inputObj = getFieldInput(field);
  const currentContent = inputObj ? inputObj.value() : '';

  $inputRich.html(currentContent);
  $inputRich.addClass('aiassistant-html-display');
  $generatedRich.addClass('aiassistant-html-display');
}

function setupGenerateHandler(
  $btn,
  $promptText,
  $inputContext,
  $integrationSelect,
  $input,
  $btnInsert,
  $loading,
  field,
  $includeContext
) {
  $btn.on('click', async function () {
    const promptText = $promptText.val();
    const integrationHandle = $integrationSelect.val();
    const inputContext =
      $inputContext && $inputContext.length
        ? $inputContext.hasClass('aiassistant-rich-editor')
          ? $inputContext.html()
          : $inputContext.is('textarea, input')
          ? $inputContext.val()
          : $inputContext.text()
        : '';
    let includeContext = true;
    if ($includeContext && $includeContext.length) {
      const $ls = $includeContext.closest('.lightswitch');
      if ($ls && $ls.length) {
        includeContext = $ls.hasClass('on');
      } else if ($includeContext.is(':checkbox')) {
        includeContext = $includeContext.is(':checked');
      }
    }

    if (!promptText || !integrationHandle) {
      Craft.cp.displayError('Please select a prompt and integration.');
      return;
    }

    let fullPrompt = promptText;
    if (includeContext && inputContext && inputContext.trim()) {
      fullPrompt += '\n\n' + inputContext.trim();
    }

    $btn.prop('disabled', true);
    if ($loading && $loading.length) {
      $loading.removeClass('aiassistant-hidden').show();
    }

    try {
      const inputObj = getFieldInput(field);
      if (!inputObj || !inputObj.element) {
        Craft.cp.displayError('Could not detect field type');
        return;
      }

      const fieldType = getFieldType(inputObj.element);

      const result = await generateText({
        promptText: fullPrompt,
        integrationHandle,
        fieldType,
      });

      if (result.success) {
        const generatedText =
          result.data || result.content || result.text || '';

        const isRichTextEditor = $input.hasClass('aiassistant-rich-editor');

        if (isRichTextEditor) {
          $input.html(generatedText);
        } else {
          $input.val(generatedText);
        }

        $btnInsert.prop('disabled', false);
      } else {
        Craft.cp.displayError(
          result.message || result.error || 'Generation failed'
        );
      }
    } catch (error) {
      console.error('Generation error:', error);
      Craft.cp.displayError(
        'Failed to generate text: ' + (error.message || 'Unknown error')
      );
    } finally {
      $btn.prop('disabled', false);
      if ($loading && $loading.length) {
        $loading.addClass('aiassistant-hidden').hide();
      }
    }
  });
}

function setupInsertHandler($btn, $input, modal, field) {
  $btn.on('click', function () {
    const isRichTextEditor = $input.hasClass('aiassistant-rich-editor');
    const generatedText = isRichTextEditor ? $input.html() : $input.val();

    if (!generatedText || !generatedText.trim()) {
      Craft.cp.displayError('No content to insert.');
      return;
    }

    const inputObj = getFieldInput(field);

    if (!inputObj || !inputObj.element) {
      console.error('Field input object not found:', field);
      Craft.cp.displayError('Could not find field to insert content into.');
      return;
    }

    try {
      // Set the value using the field's setValue method
      if (typeof inputObj.setValue === 'function') {
        inputObj.setValue(generatedText);
      } else {
        // Fallback: direct value assignment
        if (
          inputObj.element.tagName === 'TEXTAREA' ||
          inputObj.element.tagName === 'INPUT'
        ) {
          inputObj.element.value = generatedText;
        } else if (inputObj.element.innerHTML !== undefined) {
          inputObj.element.innerHTML = generatedText;
        }
      }

      // Trigger change event to notify Craft - use multiple methods for compatibility
      const $element = $(inputObj.element);

      // Method 1: jQuery trigger (most reliable for Craft)
      $element.trigger('change');

      // Method 2: Native change event
      if (inputObj.element.dispatchEvent) {
        const changeEvent = new Event('change', {
          bubbles: true,
          cancelable: true,
        });
        inputObj.element.dispatchEvent(changeEvent);
      }

      // Method 3: Input event (some editors listen to this)
      $element.trigger('input');

      // Method 4: For CKEditor, also trigger editor change
      if (inputObj.type === 'ckeditor') {
        const editable = inputObj.element.querySelector('.ck-editor__editable');
        if (editable && editable.ckeditorInstance) {
          editable.ckeditorInstance.fire('change');
          editable.ckeditorInstance.fire('data');
        }
      }

      // Method 5: For TinyMCE, trigger editor change
      if (inputObj.type === 'tinymce' && inputObj.element.id) {
        const instance = window.tinymce?.get(inputObj.element.id);
        if (instance && typeof instance.fire === 'function') {
          instance.fire('change');
          instance.fire('SetContent', { content: generatedText });
        }
      }

      // Method 6: For Redactor, trigger sync and update events
      if (inputObj.type === 'redactor' && inputObj.element.id) {
        const $redactor = $(inputObj.element);
        const instance = $redactor.data('redactor');
        if (instance) {
          if (typeof instance.sync === 'function') {
            instance.sync();
          }
          if (typeof instance.update === 'function') {
            instance.update();
          }
        }
      }

      // Method 7: For plain text/textarea (including Title), ensure Craft detects the change
      if (inputObj.type === 'input' || inputObj.type === 'textarea') {
        // Additional trigger for Craft's form handling
        $element.trigger('blur');
        // For Title fields specifically, trigger Craft's title update
        if (inputObj.element.name === 'title') {
          $element.trigger('keyup');
        }
      }

      // Small delay to ensure value is set and events are processed before closing modal
      setTimeout(() => {
        modal.hide();
      }, 150);
    } catch (error) {
      console.error('Error setting field value:', error);
      console.error('Field:', field);
      console.error('Input object:', inputObj);
      Craft.cp.displayError(
        'Failed to insert content: ' + (error.message || 'Unknown error')
      );
    }
  });
}

function setupCancelHandler(modal) {
  const $cancelBtn = modal.$container.find('button.cancel');
  $cancelBtn.on('click', function () {
    modal.hide();
  });
}

/**
 * Open from asset modal - full implementation
 */
export async function openFromAssetModal(assetId, assetUrl) {
  try {
    const modalHtml = await fetchModalHtml(
      Craft.getCpUrl('ai-assistant/ui/generate-from-asset-modal')
    );
    const modal = createModal(modalHtml);

    // Wait for modal to be fully initialized
    const initializeModalElements = () => {
      try {
        const modalElement = document.querySelector('.modal:last-of-type');
        if (!modalElement) {
          setTimeout(initializeModalElements, 50);
          return;
        }

        const $body = $(modalElement).find('.body');
        if (!$body || !$body.length) {
          setTimeout(initializeModalElements, 50);
          return;
        }

        // Initialize Craft UI elements
        try {
          if (typeof Craft.initUiElements === 'function') {
            Craft.initUiElements($body);
          }
        } catch (e) {
          // ignore
        }

        // Inject AI Assistant icon into modal header
        injectModalIcon(modalElement);

        // Get modal elements
        const $integrationSelect = $body.find(
          'select[name="aiassistant-text-integration"]'
        );
        const $promptSelect = $body.find(
          'select[name="aiassistant-text-prompt"]'
        );
        const $promptText = $body.find(
          'textarea[name="aiassistant-text-prompt-text"]'
        );
        const $btnGenerate = modal.$container.find(
          'button#aiassistant-text-generate'
        );
        const $btnSave = modal.$container.find(
          'button#aiassistant-text-insert'
        );
        const $loading = modal.$container.find('#aiassistant-text-loading');
        const $imageOptions = $body.find('#aiassistant-image-options');
        const $imageCol = $body.find('#aiassistant-image-col');
        const $promptLeft = $body.find('#aiassistant-prompt-left');
        const $keepOriginalSize = $body.find('#aiassistant-keep-original-size');
        const $imageSize = $body.find('#aiassistant-image-size');
        const $sizeFieldWrap = $body.find('#aiassistant-size-field-wrap');
        const $imageCount = $body.find('#aiassistant-image-count');
        const $assetTarget = $body.find('#aiassistant-asset-target');
        const $assetPreview = $body.find('#aiassistant-asset-preview');
        const $imagePreviewRight = $body.find(
          '#aiassistant-image-preview-right'
        );
        const $generatedText = $body.find('#aiassistant-text-generated-rich');

        // Display the asset image
        if ($assetPreview.length) {
          const containerHeight = $assetPreview.outerHeight();
          const padding = 20;
          const maxImageHeight = Math.max(containerHeight - padding, 240);
          const imageStyle =
            'max-height:' +
            maxImageHeight +
            'px; width:auto; border-radius:4px; object-fit:contain; display:block;';

          if (assetUrl) {
            $assetPreview.html(
              '<img src="' +
                assetUrl +
                '" style="' +
                imageStyle +
                '" alt="Asset preview" />'
            );
          } else if (assetId) {
            fetch(
              Craft.getCpUrl('ai-assistant/api/get-asset-url', {
                assetId: assetId,
              }),
              {
                headers: { Accept: 'application/json' },
              }
            )
              .then((r) =>
                r.ok ? r.json() : Promise.reject(new Error('Failed to fetch'))
              )
              .then((data) => {
                if (data.success && data.url) {
                  $assetPreview.html(
                    '<img src="' +
                      data.url +
                      '" style="' +
                      imageStyle +
                      '" alt="Asset preview" />'
                  );
                } else {
                  const streamUrl = Craft.getCpUrl(
                    'ai-assistant/api/stream-asset',
                    { assetId: assetId }
                  );
                  $assetPreview.html(
                    '<img src="' +
                      streamUrl +
                      '" style="' +
                      imageStyle +
                      '" alt="Asset preview" />'
                  );
                }
              })
              .catch(() => {
                const streamUrl = Craft.getCpUrl(
                  'ai-assistant/api/stream-asset',
                  { assetId: assetId }
                );
                $assetPreview.html(
                  '<img src="' +
                    streamUrl +
                    '" style="' +
                    imageStyle +
                    '" alt="Asset preview" />'
                );
              });
          } else {
            $assetPreview.html(
              '<div style="color:#9ca3af; padding:20px; text-align:center;">No asset selected</div>'
            );
          }
        }

        // Hide image options initially
        $imageOptions.hide();
        if ($imageCol.length) {
          $imageCol.hide();
        }

        // Toggle size input state based on Keep original size (lightswitch)
        if ($keepOriginalSize.length) {
          const $lightswitchContainer =
            $keepOriginalSize.closest('.lightswitch');
          const $sizeInstructions = $sizeFieldWrap.find('.instructions');

          if (
            $lightswitchContainer.length &&
            !$lightswitchContainer.data('lightswitch')
          ) {
            try {
              new Garnish.LightSwitch($lightswitchContainer);
            } catch (e) {
              // ignore
            }
          }

          const syncKeepOriginal = () => {
            const keep =
              $lightswitchContainer.length &&
              $lightswitchContainer.hasClass('on');

            if ($sizeFieldWrap && $sizeFieldWrap.length) {
              $sizeFieldWrap.show();

              if (keep) {
                $imageSize.hide();
                if ($sizeInstructions.length) {
                  $sizeInstructions.text('Keep original size (recommended).');
                }
              } else {
                $imageSize.show().prop('disabled', false);
                if ($sizeInstructions.length) {
                  $sizeInstructions.text('WidthxHeight, e.g., 1024x1024.');
                }
              }
            }
          };

          if ($lightswitchContainer.length) {
            $lightswitchContainer.on('change', syncKeepOriginal);
          } else {
            $keepOriginalSize.on('change', syncKeepOriginal);
          }
          syncKeepOriginal();
        }

        // Load data and set up handlers
        Promise.all([loadIntegrations(), loadPrompts('image')])
          .then(([integrations, prompts]) => {
            // Populate integrations with type data attribute
            $integrationSelect.empty();
            if (integrations && integrations.length) {
              integrations.forEach((integration) => {
                $integrationSelect.append(
                  `<option value="${integration.handle}" data-type="${integration.type || ''}">${integration.name}</option>`
                );
              });
            }

            // Populate prompts
            $promptSelect.empty();
            if (prompts && prompts.length) {
              prompts.forEach((prompt) => {
                const safeText = (prompt.promptText || '').replace(
                  /"/g,
                  '&quot;'
                );
                $promptSelect.append(
                  `<option value="${prompt.id}" data-integration="${
                    prompt.integrationHandle || ''
                  }" data-type="${
                    prompt.type || ''
                  }" data-prompt-text="${safeText}">${prompt.name}</option>`
                );
              });
              $promptSelect.append('<option value="custom">Custom…</option>');
            }

            // Helper: prefill UI from selected prompt with defaults
            function prefillFromPrompt(p) {
              if (!p) return;
              if ($keepOriginalSize.length && $imageSize.length) {
                const $lightswitchContainer =
                  $keepOriginalSize.closest('.lightswitch');
                if (p.imageSize && String(p.imageSize).trim()) {
                  if (
                    $lightswitchContainer.length &&
                    $lightswitchContainer.hasClass('on')
                  ) {
                    $lightswitchContainer.trigger('click');
                  }
                  $imageSize.val(p.imageSize);
                } else {
                  // No prompt size, use default "1024x1024"
                  if (
                    $lightswitchContainer.length &&
                    $lightswitchContainer.hasClass('on')
                  ) {
                    $lightswitchContainer.trigger('click');
                  }
                  $imageSize.val('1024x1024');
                }
                if ($lightswitchContainer.length) {
                  $lightswitchContainer.trigger('change');
                }
              }
              // Count - use prompt value or default to 1
              if ($imageCount.length) {
                if (
                  p.imageCount !== undefined &&
                  p.imageCount !== null &&
                  String(p.imageCount).trim() !== ''
                ) {
                  $imageCount.val(p.imageCount);
                } else {
                  $imageCount.val('1');
                }
              }
              // Asset target - use prompt value or default to first option
              if ($assetTarget.length) {
                if (p.assetTarget) {
                  if (
                    $assetTarget.find(`option[value="${p.assetTarget}"]`).length
                  ) {
                    $assetTarget.val(p.assetTarget);
                  } else {
                    // Prompt value doesn't exist, use first option
                    const firstOption = $assetTarget.find('option').first();
                    if (firstOption.length) {
                      $assetTarget.val(firstOption.val());
                    }
                  }
                } else {
                  // No prompt value, use first option if not already set
                  if (!$assetTarget.val() || $assetTarget.val() === '') {
                    const firstOption = $assetTarget.find('option').first();
                    if (firstOption.length) {
                      $assetTarget.val(firstOption.val());
                    }
                  }
                }
              }
              if ($integrationSelect.length && p.integrationHandle) {
                if (
                  $integrationSelect.find(
                    `option[value="${p.integrationHandle}"]`
                  ).length
                ) {
                  $integrationSelect.val(p.integrationHandle);
                }
              }
            }

            // Default to "Generate Image" prompt if available
            const generateImagePrompt = prompts.find(
              (p) => p.name === 'Generate Image' || p.type === 'image'
            );
            if (generateImagePrompt) {
              $promptSelect.val(generateImagePrompt.id);
              // Manually populate textarea for initial selection
              const selectedOpt = $promptSelect.find(
                `option[value="${generateImagePrompt.id}"]`
              );
              const promptTextValue =
                selectedOpt.data('prompt-text') ||
                generateImagePrompt.promptText ||
                '';
              if (promptTextValue) {
                const tempDiv = $('<div>').html(promptTextValue);
                $promptText.val(tempDiv.text());
              }
              $promptSelect.trigger('change');
              prefillFromPrompt(generateImagePrompt);
            } else if (prompts && prompts.length > 0) {
              const imagePrompt = prompts.find((p) => p.type === 'image');
              const selected = imagePrompt || prompts[0];
              $promptSelect.val(selected.id);
              // Manually populate textarea for initial selection
              const selectedOpt = $promptSelect.find(
                `option[value="${selected.id}"]`
              );
              const promptTextValue =
                selectedOpt.data('prompt-text') || selected.promptText || '';
              if (promptTextValue) {
                const tempDiv = $('<div>').html(promptTextValue);
                $promptText.val(tempDiv.text());
              }
              $promptSelect.trigger('change');
              prefillFromPrompt(selected);
            }

            // Check if selected integration supports image generation
            function integrationSupportsImage() {
              if (!$integrationSelect || !$integrationSelect.val()) {
                return false;
              }
              const selectedOption = $integrationSelect.find('option:selected');
              if (!selectedOption.length) {
                return false;
              }
              const integrationType = (selectedOption.data('type') || selectedOption.attr('data-type') || '').toLowerCase();
              const imageCapableTypes = ['openai', 'replicate'];
              return imageCapableTypes.includes(integrationType);
            }

            // Check if we should show image options based on prompt type
            // Image options are shown based on prompt type, not integration
            function shouldShowImageOptions(promptType) {
              const type = (promptType || '').toLowerCase();
              // Show image options if prompt type is 'image'
              return type === 'image';
            }

            // Toggle image vs text mode
            function toggleImageMode(type) {
              const showImageOptions = shouldShowImageOptions(type);
              if (showImageOptions) {
                if ($imageCol.length) {
                  $imageCol.show();
                  $imageCol.css({ flex: '0 0 49%', maxWidth: '49%' });
                }
                if ($promptLeft.length) {
                  $promptLeft.css({ flex: '0 0 49%', maxWidth: '49%' });
                }
                $imageOptions.show();
                $btnSave.text('Save').prop('disabled', true);
                $generatedText.hide();
                renderImageSlider($imagePreviewRight, []);
              } else {
                $imageOptions.hide();
                if ($imageCol.length) {
                  $imageCol.hide();
                  $imageCol.css({ flex: '', maxWidth: '' });
                }
                if ($promptLeft.length) {
                  $promptLeft.css({ flex: '0 0 100%', maxWidth: '100%' });
                }
                $btnSave.text('Insert').prop('disabled', true);
                $generatedText.show();
                renderImageSlider($imagePreviewRight, []);
                $btnSave.data('previewUrls', []);
              }
            }

            // Set up generate handler for asset context
            function setupAssetGenerateHandler() {
              $btnGenerate.off('click').on('click', async function () {
                const prompt = $promptText.val() || '';
                const integrationHandle = $integrationSelect.val() || 'openai';
                const selectedPrompt = prompts.find(
                  (p) => String(p.id) === $promptSelect.val()
                );
                const promptType = selectedPrompt?.type || '';
                const selectedVal = String($promptSelect.val() || '');
                const isImageMode =
                  (promptType || '').toLowerCase() === 'image' ||
                  selectedVal === 'custom';

                if (!prompt) {
                  Craft.cp.displayError('Please enter a prompt');
                  return;
                }

                $btnGenerate.prop('disabled', true);
                if ($loading && $loading.length) {
                  $loading.removeClass('aiassistant-hidden').show();
                }

                try {
                  if (isImageMode) {
                    const assetTarget = $assetTarget.val() || '';
                    const payload = {
                      prompt: prompt,
                      integration: integrationHandle,
                      assetTarget: assetTarget,
                      dryRun: true,
                      assetId: assetId,
                      assetUrl: assetUrl,
                    };

                    if ($keepOriginalSize && $keepOriginalSize.length) {
                      const $lightswitchContainer =
                        $keepOriginalSize.closest('.lightswitch');
                      const keepOriginal =
                        $lightswitchContainer.length &&
                        $lightswitchContainer.hasClass('on');
                      if (!keepOriginal) {
                        const sz = ($imageSize.val() || '').trim();
                        if (sz) payload.size = sz;
                      }
                    } else {
                      const sz = ($imageSize.val() || '').trim();
                      if (sz) payload.size = sz;
                    }

                    if ($imageCount.length) {
                      const cnt = parseInt($imageCount.val() || '1', 10);
                      if (!isNaN(cnt) && cnt > 0) payload.count = cnt;
                    }

                    renderImageSlider($imagePreviewRight, []);

                    const result = await generateImage(payload);
                    if (
                      result.success &&
                      Array.isArray(result.previewUrls) &&
                      result.previewUrls.length
                    ) {
                      const previews = result.previewUrls;
                      renderImageSlider($imagePreviewRight, previews);
                      $btnSave
                        .prop('disabled', false)
                        .data('previewUrls', previews);
                      $imagePreviewRight
                        .off('click.sliderSave')
                        .on(
                          'click.sliderSave',
                          '.aiassistant-image-slider-img',
                          function () {
                            const urls =
                              $imagePreviewRight.data('sliderUrls') || [];
                            const currentIndex =
                              $imagePreviewRight.data('sliderIndex') || 0;
                            const currentUrl = urls[currentIndex];
                            if (currentUrl) {
                              saveImageToAssets(
                                [currentUrl],
                                assetTarget,
                                prompt
                              );
                            }
                          }
                        );
                    } else {
                      renderImageSlider($imagePreviewRight, []);
                      $btnSave.data('previewUrls', []);
                      Craft.cp.displayError(
                        result.error || 'Failed to generate image'
                      );
                    }
                  } else {
                    const result = await generateText({
                      promptText: prompt,
                      integrationHandle,
                      assetId,
                      assetUrl,
                    });

                    if (result.success && result.text) {
                      $generatedText.html(result.text).show();
                      renderImageSlider($imagePreviewRight, []);
                      $btnSave.data('previewUrls', []);
                      $btnSave.prop('disabled', false);
                    } else {
                      Craft.cp.displayError(
                        result.error || 'Failed to generate text'
                      );
                    }
                  }
                } catch (error) {
                  Craft.cp.displayError('Generation failed: ' + error.message);
                } finally {
                  $btnGenerate.prop('disabled', false);
                  if ($loading && $loading.length) {
                    $loading.addClass('aiassistant-hidden').hide();
                  }
                }
              });
            }

            // Set up save handler
            function setupAssetSaveHandler() {
              $btnSave.off('click').on('click', function () {
                const selectedPrompt = prompts.find(
                  (p) => String(p.id) === $promptSelect.val()
                );
                const promptType = selectedPrompt?.type || '';

                if ((promptType || '').toLowerCase() === 'image') {
                  const previewUrls = $btnSave.data('previewUrls') || [];
                  const assetTarget = $assetTarget.val() || '';
                  const prompt = $promptText.val() || '';
                  if (previewUrls.length > 0) {
                    saveImageToAssets(previewUrls, assetTarget, prompt).then(
                      (result) => {
                        if (result.success) {
                          Craft.cp.displayNotice('Images saved successfully');
                          modal.hide();
                          if (typeof Craft.elementIndex !== 'undefined') {
                            Craft.elementIndex.updateElements();
                          }
                        }
                      }
                    );
                  }
                } else {
                  modal.hide();
                }
              });
            }

            // Set up handlers
            setupAssetGenerateHandler();
            setupAssetSaveHandler();
            setupCancelHandler(modal);

            // Toggle image mode when prompt changes
            $promptSelect.on('change', function () {
              const opt = $(this).find('option:selected');
              const selVal = String($(this).val() || '');
              const type = opt.data('type') || '';
              const isImage =
                (type || '').toLowerCase() === 'image' || selVal === 'custom';

              // Populate prompt text textarea
              if (selVal === 'custom') {
                // Clear textarea for custom prompt
                $promptText.val('');
              } else {
                // Get prompt text from data attribute or from prompts array
                let promptTextValue = opt.data('prompt-text') || '';
                if (!promptTextValue) {
                  // Fallback: find in prompts array
                  const p = prompts.find((pp) => String(pp.id) === selVal);
                  if (p && p.promptText) {
                    promptTextValue = p.promptText;
                  }
                }
                // Decode HTML entities
                if (promptTextValue) {
                  const tempDiv = $('<div>').html(promptTextValue);
                  promptTextValue = tempDiv.text();
                  $promptText.val(promptTextValue);
                }
              }

              // Update integration select if prompt has specific integration
              const promptIntegration = opt.data('integration') || '';
              if (
                promptIntegration &&
                $integrationSelect.find(`option[value="${promptIntegration}"]`)
                  .length
              ) {
                $integrationSelect.val(promptIntegration);
              }

              toggleImageMode(isImage ? 'image' : type);
              if (isImage || shouldShowImageOptions(type)) {
                const p = prompts.find((pp) => String(pp.id) === selVal);
                if (p) {
                  prefillFromPrompt(p);
                } else if (isImage) {
                  // No prompt found but in image mode, set defaults
                  if ($imageSize.length && !$imageSize.val()) {
                    $imageSize.val('1024x1024');
                  }
                  if ($imageCount.length && !$imageCount.val()) {
                    $imageCount.val('1');
                  }
                  if ($assetTarget.length && (!$assetTarget.val() || $assetTarget.val() === '')) {
                    const firstOption = $assetTarget.find('option').first();
                    if (firstOption.length) {
                      $assetTarget.val(firstOption.val());
                    }
                  }
                }
              }
            });

            // Note: Image options visibility is based on prompt type, not integration
            // Integration change doesn't affect visibility, only generation capability

            // Initial toggle
            const initOpt = $promptSelect.find('option:selected');
            if (initOpt && initOpt.length) {
              const initVal = String($promptSelect.val() || '');
              const initType = initOpt.data('type') || '';
              // Ensure prompt text is populated on initial load
              if (initVal !== 'custom') {
                let promptTextValue = initOpt.data('prompt-text') || '';
                if (!promptTextValue) {
                  const p = prompts.find((pp) => String(pp.id) === initVal);
                  if (p && p.promptText) {
                    promptTextValue = p.promptText;
                  }
                }
                if (promptTextValue) {
                  const tempDiv = $('<div>').html(promptTextValue);
                  $promptText.val(tempDiv.text());
                }
              }
              const isImageInit =
                (initType || '').toLowerCase() === 'image' ||
                initVal === 'custom';
              toggleImageMode(isImageInit ? 'image' : initType);
            }
          })
          .catch((error) => {
            Craft.cp.displayError('Failed to load modal data');
          });
      } catch (error) {
        Craft.cp.displayError('Failed to initialize modal');
      }
    };

    setTimeout(initializeModalElements, 100);
  } catch (error) {
    Craft.cp.displayError('Failed to load modal');
  }
}

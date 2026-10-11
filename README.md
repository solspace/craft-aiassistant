# Solspace AI Assistant plugin for Craft CMS 5.x

Generate smarter text and images with AI using custom prompts and support for multiple models.

![AI Assistant icon](src/icon.svg)

## Overview

AI Assistant adds simple, powerful AI tools to Craft CMS so you can create and improve content right inside the control panel. It supports multiple AI models and custom prompts, giving you full control over how AI helps your team.

Use it to rewrite text, generate new content, translate languages, summarize long copy, or create images that save directly to Craft Assets. It works with most field types, so AI is always available where you edit your content.

## Choosing an AI Model

For OpenAI, Google Gemini, Anthropic, and xAI, the integration editor loads a searchable model list after you enter an API key. You do not need to save first. Use **Refresh models** to reload the list, or **Other / Custom model ID** to enter an exact model ID or an environment-variable reference such as $MY_MODEL.

Model choices come from the provider. Supported aliases are verified before they are offered. Existing saved models are preserved, including IDs that are absent from the list. Replicate continues to accept custom model IDs, and SolspaceAI uses its server configuration.

For Gemini, leave **Max Tokens** blank or set it to **0** to use the provider default. A positive number limits the response tokens; the allowed maximum depends on the selected model. Temporary overload and rate-limit errors are retried up to twice. If the request still fails, the complete provider error is shown with credentials removed.

Saved prompts contain literal instructions. They do not automatically substitute entry fields or Twig variables. **Include current field content as context** only adds the field being edited. Putting a URL in a prompt does not enable web retrieval.

## Helpful Links

- [Buy AI Assistant at the Plugin Store](https://plugins.craftcms.com/ai-assistant)
- [AI Assistant Documentation](https://docs.solspace.com/craft/ai-assistant/v1/)
- [Report an Issue](https://github.com/solspace/craft-aiassistant/issues)
- [Feature Requests](https://github.com/solspace/craft-aiassistant/discussions)
- [Ask a Question](https://github.com/solspace/craft-aiassistant/discussions)
- [Private Support Ticket](https://docs.solspace.com/support/)
- [Craft Stack Exchange](https://craftcms.stackexchange.com/questions/tagged/solspace)

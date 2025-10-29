# AI Assistant for Craft CMS (Solspace)

AI-powered content assistance for Craft CMS with prompt management, multiple providers, and a rich in-field workflow.

- Package: `solspace/craft-aiassistant`
- Namespace: `Solspace\AIAssistant`

## Current functionality

- [x] Inline AI button on supported fields (Title, Plain Text, CKEditor, Redactor, TinyMCE)
- [x] Two‑column modal (Input Context left, Generated Text right) with rich HTML rendering
- [x] Lightswitch to include/exclude input context in the prompt
- [x] Correct HTML handling for CKEditor, TinyMCE, and Redactor when inserting back into the field
- [x] Prompt management (built‑in and custom) with integration binding and sort order
- [x] Field‑specific prompts per field with automatic modal preselection
- [x] Integration management for OpenAI, Google Gemini, Antropic and xAI (enable/disable, API keys, model selection)
- [x] Quick AI Actions dashboard widget (select prompt, editable prompt text, generate, copy)
- [x] Craft-native UI components (lightswitch, notices), event-based widget registration
- [x] Responsive, larger modal with dynamic body height

## Upcoming Features

- [ ] Image generation for Assets fields
- [ ] Per-site settings and field rules
- [ ] Prompt variables and templating
- [ ] Batch content processing
- [ ] Analytics dashboard
- [ ] SEO content assistant
- [ ] Commerce integration
- [ ] Multi-language support

## Installation

1. Require the package:
   - `composer require solspace/craft-aiassistant`
2. In Craft CP → Plugins, install “AI Assistant”
3. Configure providers in **AI Assistant → Integrations**
4. Enable fields in **AI Assistant → Settings**

## Configuration

### Integrations
1. Go to **AI Assistant → Integrations**
2. Click **New Integration**
3. Choose provider (OpenAI, Gemini, Antropic, xAI), set API key, model, and defaults
4. Save and test

### Field enablement
1. Go to **AI Assistant → Settings**
2. Toggle which fields show the inline AI button
3. Save

### Prompts
1. Go to **AI Assistant → Prompts**
2. Create custom prompts or view built‑in prompts
3. Optionally bind a prompt to a specific integration

### Field‑specific prompts

You can preselect a prompt for each enabled field so the Generate modal opens with the right context:

1. Go to **AI Assistant → Settings**
2. In the “Field Prompts” table, choose a prompt per field (or keep “Any”)
3. Save Settings

Behavior on entry edit pages:
- When you click the inline AI button, the modal will auto‑select the field’s prompt.
- This works for Craft fields (Plain Text, CKEditor, Redactor, TinyMCE, Assets) and for the built‑in Title field (handle `title`).
- For Title specifically, the modal reads the selection from plugin settings, so it’s honored even though Title isn’t a custom Craft field.

Notes:
- Choosing “Any” means the modal won’t preselect a specific prompt.
- If a prompt is bound to a particular integration, that integration is used automatically; otherwise the selected integration is used.
- Changes you make to the selected prompt inside an entry are not saved back to Settings; edit the mapping in **AI Assistant → Settings**.

## Usage

1. Open any entry with enabled fields; an inline AI button appears inside the input area
2. Click the button to open the modal
3. Pick a prompt, edit “Prompt Text” as needed
4. Optionally enable “Include input context”
5. Generate and review in the right column; Insert replaces the field’s content

### Quick AI Actions widget

- Add the “AI Assistant Quick Actions” widget on the dashboard
- Select a prompt, edit “Prompt Text,” Generate, and Copy as needed

## API endpoints

- `GET /admin/ai-assistant/api/integrations`
- `GET /admin/ai-assistant/api/prompts`
- `POST /admin/ai-assistant/api/generate-text`
- `POST /admin/ai-assistant/api/generate-image` (coming soon)

## Requirements

- Craft CMS 5+
- PHP 8.0+
- Valid API key(s) for configured providers

## File structure (high level)

```
aiassistant/
├── src/
│   ├── assets/                 # JS/CSS + AssetBundle
│   ├── controllers/            # CP + API endpoints
│   ├── models/                 # Integration, Prompt, Settings
│   ├── records/                # ActiveRecord for DB tables
│   ├── services/               # Business logic + helpers
│   ├── Integrations/           # Providers (OpenAI, Gemini, …)
│   ├── templates/              # Twig (modal, widget, CP screens)
│   └── AiAssistant.php         # Main plugin class
├── icon.svg
└── composer.json
```

## Support

For issues and feature requests, please contact Solspace.

# Solspace AI Assistant Changelog

## 1.4.0 - 2026-11-14

### Added
- Added support for Craft CMS 4 alongside Craft CMS 5.
- Added Assets fields to the field enablement settings.

### Fixed
- Fixed template errors on Craft 4 when editing integrations and prompts, opening generation modals, and using the Quick AI Actions widget.
- Fixed the asset generation modal failing to open due to a missing control panel route.
- Fixed the image generation modal referencing a missing template.
- Fixed the missing AI Assistant action in Craft 5 image asset menus and prevented registration of unsupported asset menu events on Craft 4.

## 1.3.0 - 2026-10-11

### Added
- Added searchable model pickers for OpenAI, Google Gemini, Anthropic, and xAI, with automatic model discovery, verified aliases, refresh controls, and custom model IDs.

### Fixed
- Fixed Gemini requests failing when Max Tokens was blank or set to zero.
- Fixed truncated Gemini error messages and removed API credentials from error output and logs.
- Added bounded retries for temporary Gemini service and rate-limit failures.
- Corrected prompt editor instructions that incorrectly claimed support for variable and context placeholders.

## 1.2.1 - 2026-10-05

### Fixed
- Fixed an issue where AI Assistant buttons could be missing or unresponsive in Matrix fields, including newly added or duplicated entries and slideout editors.

## 1.2.0 - 2026-05-02

### Changed
- Enhanced the **AI Assistant** modal layout.
- Enhanced the **AI Assistant** widget design.
- Refactored model field handling and improved autofill tracking logic.

## 1.1.0 - 2026-04-20

### Added
- Added support for the **SolspaceAI** integration, including a free trial.

### Fixed
- Fixed an issue where the Dashboard widget icon was missing.

## 1.0.1 - 2026-04-03

### Fixed
- Fixed visual issues in the **AI Prompt** modal.
- Fixed an issue with asset title generation.

## 1.0.0 - 2026-01-08

### Added
- Initial release.

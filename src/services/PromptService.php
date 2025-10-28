<?php

namespace Solspace\AIAssistant\services;

use craft\base\Component;
use Solspace\AIAssistant\models\Prompt;
use Solspace\AIAssistant\records\PromptRecord;

class PromptService extends Component
{
    public function getAllPrompts(): array
    {
        $prompts = [];

        // Add built-in prompts first
        $builtInPrompts = $this->getBuiltInPrompts();
        foreach ($builtInPrompts as $promptData) {
            $prompt = new Prompt();
            $prompt->id = 'builtin_'.strtolower(str_replace(' ', '_', $promptData['name']));
            $prompt->name = $promptData['name'];
            $prompt->promptText = $promptData['promptText'];
            $prompt->type = $promptData['type'];
            $prompt->integrationHandle = $promptData['integrationHandle'];
            $prompt->isActive = true;
            $prompt->sortOrder = $promptData['sortOrder'];
            $prompt->isBuiltIn = true;
            $prompts[] = $prompt;
        }

        // Add user-created prompts
        $records = PromptRecord::find()
            ->where(['isActive' => true])
            ->orderBy(['sortOrder' => \SORT_ASC, 'name' => \SORT_ASC])
            ->all()
        ;

        foreach ($records as $record) {
            $prompt = $this->recordToModel($record);
            $prompt->isBuiltIn = false;
            $prompts[] = $prompt;
        }

        return $prompts;
    }

    public function getPromptsByType(string $type): array
    {
        $records = PromptRecord::find()
            ->where(['isActive' => true, 'type' => $type])
            ->orderBy(['sortOrder' => \SORT_ASC, 'name' => \SORT_ASC])
            ->all()
        ;

        $prompts = [];
        foreach ($records as $record) {
            $prompts[] = $this->recordToModel($record);
        }

        return $prompts;
    }

    public function getPromptById(int $id): ?Prompt
    {
        $record = PromptRecord::findOne($id);

        return $record ? $this->recordToModel($record) : null;
    }

    public function getPromptByName(string $name): ?Prompt
    {
        $record = PromptRecord::findOne(['name' => $name]);

        return $record ? $this->recordToModel($record) : null;
    }

    public function savePrompt(Prompt $prompt): bool
    {
        if ($prompt->id) {
            $record = PromptRecord::findOne($prompt->id);
            if (!$record) {
                return false;
            }
        } else {
            $record = new PromptRecord();
        }

        $record->name = $prompt->name;
        $record->promptText = $prompt->promptText;
        $record->type = $prompt->type;
        $record->integrationHandle = $prompt->integrationHandle;
        $record->isActive = $prompt->isActive;
        $record->sortOrder = $prompt->sortOrder;

        return $record->save();
    }

    public function deletePrompt(int $id): bool
    {
        $record = PromptRecord::findOne($id);

        return $record ? $record->delete() : false;
    }

    public function getBuiltInPrompts(): array
    {
        return [
            [
                'name' => 'Generate Text',
                'promptText' => 'Generate high-quality content about:',
                'type' => 'generate',
                'integrationHandle' => null,
                'sortOrder' => 1,
            ],
            [
                'name' => 'Rephrase Content',
                'promptText' => 'Rephrase this text to be clearer and more engaging:',
                'type' => 'rephrase',
                'integrationHandle' => null,
                'sortOrder' => 2,
            ],
            [
                'name' => 'Translate Text',
                'promptText' => 'Translate this text to English:',
                'type' => 'translate',
                'integrationHandle' => null,
                'sortOrder' => 3,
            ],
        ];
    }

    private function recordToModel(PromptRecord $record): Prompt
    {
        $prompt = new Prompt();
        $prompt->id = $record->id;
        $prompt->name = $record->name;
        $prompt->promptText = $record->promptText;
        $prompt->type = $record->type;
        $prompt->integrationHandle = $record->integrationHandle;
        $prompt->isActive = $record->isActive;
        $prompt->sortOrder = $record->sortOrder;
        $prompt->isBuiltIn = false;
        $prompt->dateCreated = $record->dateCreated;
        $prompt->dateUpdated = $record->dateUpdated;
        $prompt->uid = $record->uid;

        return $prompt;
    }
}

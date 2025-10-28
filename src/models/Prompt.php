<?php

namespace Solspace\AIAssistant\models;

use craft\base\Model;

class Prompt extends Model
{
    public $id;
    public string $name = '';
    public string $promptText = '';
    public string $type = 'generate';
    public ?string $integrationHandle = null;
    public bool $isActive = true;
    public int $sortOrder = 0;
    public bool $isBuiltIn = false;
    public ?string $dateCreated = null;
    public ?string $dateUpdated = null;
    public ?string $uid = null;

    public function rules(): array
    {
        return [
            [['name', 'promptText', 'type'], 'required'],
            [['name', 'promptText', 'integrationHandle'], 'string'],
            [['type'], 'in', 'range' => ['generate', 'rephrase', 'translate', 'image']],
            [['isActive'], 'boolean'],
            [['sortOrder'], 'integer'],
            [['id'], 'integer'],
        ];
    }

    public function attributeLabels(): array
    {
        return [
            'name' => 'Prompt Name',
            'promptText' => 'Prompt Text',
            'type' => 'Type',
            'integrationHandle' => 'Integration',
            'isActive' => 'Active',
            'sortOrder' => 'Sort Order',
        ];
    }

    public function getTypeOptions(): array
    {
        return [
            'generate' => 'Generate Text',
            'rephrase' => 'Rephrase Text',
            'translate' => 'Translation',
            'image' => 'Generate Image',
        ];
    }

    public function getModelOptions(): array
    {
        return [
            '' => 'Use Default',
            'gpt-3.5-turbo' => 'GPT-3.5 Turbo',
            'gpt-4' => 'GPT-4',
            'gpt-4-turbo' => 'GPT-4 Turbo',
        ];
    }
}

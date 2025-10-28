<?php

namespace Solspace\AIAssistant\records;

use craft\db\ActiveRecord;

class PromptRecord extends ActiveRecord
{
    public static function tableName(): string
    {
        return '{{%aiassistant_prompts}}';
    }

    public function rules(): array
    {
        return [
            [['name', 'promptText', 'type'], 'required'],
            [['name', 'promptText'], 'string'],
            [['integrationHandle'], 'string', 'skipOnEmpty' => true],
            [['type'], 'in', 'range' => ['generate', 'rephrase', 'translate', 'image']],
            [['isActive'], 'boolean'],
            [['sortOrder'], 'integer'],
            [['isActive'], 'default', 'value' => true],
            [['sortOrder'], 'default', 'value' => 0],
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
}

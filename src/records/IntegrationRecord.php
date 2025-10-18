<?php

namespace Solspace\AIAssistant\records;

use craft\db\ActiveRecord;

class IntegrationRecord extends ActiveRecord
{
    public const TABLE = '{{%aiassistant_integrations}}';

    public static function tableName(): string
    {
        return self::TABLE;
    }

    public function rules(): array
    {
        return [
            [['handle'], 'unique'],
            [['name', 'handle', 'type', 'class'], 'required'],
            [['enabled'], 'boolean'],
            [['enabled'], 'default', 'value' => true],
        ];
    }

    public function attributeLabels(): array
    {
        return [
            'id' => 'ID',
            'uid' => 'UID',
            'enabled' => 'Enabled',
            'handle' => 'Handle',
            'name' => 'Name',
            'type' => 'Type',
            'class' => 'Class',
            'metadata' => 'Metadata',
            'dateCreated' => 'Date Created',
            'dateUpdated' => 'Date Updated',
        ];
    }
}

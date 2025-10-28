<?php

namespace Solspace\AIAssistant\migrations;

use craft\db\Migration;

/**
 * m240101_000000_aiassistant_install migration.
 */
class Install extends Migration
{
    public function safeUp(): bool
    {
        // Create integrations table
        $this->createTable('{{%aiassistant_integrations}}', [
            'id' => $this->primaryKey(),
            'uid' => $this->uid(),
            'enabled' => $this->boolean()->notNull()->defaultValue(true),
            'handle' => $this->string()->notNull(),
            'name' => $this->string()->notNull(),
            'type' => $this->string()->notNull(),
            'class' => $this->string()->notNull(),
            'metadata' => $this->text(),
            'dateCreated' => $this->dateTime()->notNull(),
            'dateUpdated' => $this->dateTime()->notNull(),
        ]);

        // Create unique index on handle
        $this->createIndex(
            'idx_aiassistant_integrations_handle',
            '{{%aiassistant_integrations}}',
            'handle',
            true
        );

        // Create prompts table
        $this->createTable('{{%aiassistant_prompts}}', [
            'id' => $this->primaryKey(),
            'uid' => $this->uid(),
            'name' => $this->string()->notNull(),
            'promptText' => $this->text()->notNull(),
            'type' => $this->string()->notNull(),
            // Store which Integration a prompt uses
            'integrationHandle' => $this->string(),
            'isActive' => $this->boolean()->notNull()->defaultValue(true),
            'sortOrder' => $this->integer()->notNull()->defaultValue(0),
            'dateCreated' => $this->dateTime()->notNull(),
            'dateUpdated' => $this->dateTime()->notNull(),
        ]);

        // Create unique index on name
        $this->createIndex(
            'idx_aiassistant_prompts_name',
            '{{%aiassistant_prompts}}',
            'name',
            true
        );

        return true;
    }

    public function safeDown(): bool
    {
        $this->dropTableIfExists('{{%aiassistant_prompts}}');
        $this->dropTableIfExists('{{%aiassistant_integrations}}');

        return true;
    }
}

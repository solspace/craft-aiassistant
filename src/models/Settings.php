<?php

namespace Solspace\AIAssistant\models;

use craft\base\Model;

class Settings extends Model
{
    public array $enabledFieldHandles = [];

    public function rules(): array
    {
        return [
            [['enabledFieldHandles'], 'each', 'rule' => ['string']],
        ];
    }

    public function attributeLabels(): array
    {
        return [
            'enabledFieldHandles' => 'Enabled Field Handles',
        ];
    }

    public function isFieldEnabled(string $handle): bool
    {
        return in_array($handle, $this->enabledFieldHandles, true);
    }

    public function enableField(string $handle): void
    {
        if (!$this->isFieldEnabled($handle)) {
            $this->enabledFieldHandles[] = $handle;
        }
    }

    public function disableField(string $handle): void
    {
        $key = array_search($handle, $this->enabledFieldHandles, true);
        if ($key !== false) {
            unset($this->enabledFieldHandles[$key]);
            $this->enabledFieldHandles = array_values($this->enabledFieldHandles);
        }
    }

    public function getEnabledFieldCount(): int
    {
        return count($this->enabledFieldHandles);
    }

    public function hasEnabledFields(): bool
    {
        return $this->getEnabledFieldCount() > 0;
    }
}
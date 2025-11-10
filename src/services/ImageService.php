<?php

namespace Solspace\AIAssistant\services;

use Craft;
use craft\base\Component;
use craft\elements\Asset;
use craft\helpers\FileHelper;
use GuzzleHttp\Client;
use yii\base\Exception;

class ImageService extends Component
{
    /**
     * Download an image and save as an Asset.
     *
     * @throws Exception
     */
    public function createFromRemoteUrl(string $url, ?int $volumeId, ?int $folderId, ?string $filename = null, array $metadata = []): ?Asset
    {
        $tmpPath = \Craft::$app->getPath()->getTempPath();
        FileHelper::createDirectory($tmpPath);

        // Support data URLs (data:image/png;base64,...) and remote URLs
        $isDataUrl = false;
        $ext = 'png';
        if (preg_match('/^data:image\/(png|jpe?g|webp);base64,/', $url, $m)) {
            $isDataUrl = true;
            $ext = 'jpeg' === $m[1] ? 'jpg' : $m[1];
        } else {
            $ext = pathinfo(parse_url($url, \PHP_URL_PATH) ?? '', \PATHINFO_EXTENSION) ?: 'png';
        }
        $safeName = $filename ?: ('ai-image-'.time().'-'.substr(sha1($url), 0, 8).'.'.$ext);
        $tmpFile = $tmpPath.\DIRECTORY_SEPARATOR.$safeName;

        if ($isDataUrl) {
            $data = preg_replace('/^data:image\/[a-zA-Z0-9.+-]+;base64,/', '', $url);
            $bytes = base64_decode((string) $data, true);
            if (false === $bytes) {
                return null;
            }
            file_put_contents($tmpFile, $bytes);
        } else {
            $client = new Client();
            $client->request('GET', $url, ['sink' => $tmpFile]);
        }

        // Resolve target folder
        $targetFolderId = null;
        if ($folderId) {
            $targetFolderId = (int) $folderId;
        } elseif ($volumeId) {
            $assets = \Craft::$app->getAssets();
            $root = $assets->getRootFolderByVolumeId((int) $volumeId);
            if ($root) {
                $targetFolderId = (int) $root->id;
            }
        } else {
            // Fallback to first available volume root
            $volumes = \Craft::$app->getVolumes()->getAllVolumes();
            if (!empty($volumes)) {
                $root = \Craft::$app->getAssets()->getRootFolderByVolumeId($volumes[0]->id);
                if ($root) {
                    $targetFolderId = (int) $root->id;
                }
            }
        }

        if (!$targetFolderId) {
            return null;
        }

        $asset = new Asset();
        $asset->folderId = $targetFolderId;
        // Craft expects a tempFilePath property for local file uploads
        $asset->tempFilePath = $tmpFile;
        $asset->filename = $safeName;
        $asset->title = $metadata['title'] ?? pathinfo($safeName, \PATHINFO_FILENAME);
        $asset->kind = Asset::KIND_IMAGE;

        if (!\Craft::$app->getElements()->saveElement($asset)) {
            return null;
        }

        return $asset;
    }
}

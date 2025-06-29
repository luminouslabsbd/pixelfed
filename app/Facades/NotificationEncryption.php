<?php

namespace App\Facades;

use Illuminate\Support\Facades\Facade;
use App\Services\NotificationEncryptionService;

class NotificationEncryption extends Facade
{
    /**
     * Get the registered name of the component.
     *
     * @return string
     */
    protected static function getFacadeAccessor()
    {
        return NotificationEncryptionService::class;
    }
}

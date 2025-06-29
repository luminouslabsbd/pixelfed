<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Services\NotificationEncryptionService;

class NotificationServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     *
     * @return void
     */
    public function register()
    {
        $this->app->singleton(NotificationEncryptionService::class, function ($app) {
            return new NotificationEncryptionService();
        });
    }

    /**
     * Bootstrap services.
     *
     * @return void
     */
    public function boot()
    {
        //
    }
}

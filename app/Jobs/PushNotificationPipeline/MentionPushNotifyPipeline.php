<?php

namespace App\Jobs\PushNotificationPipeline;

use App\Services\NotificationAppGatewayService;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class MentionPushNotifyPipeline implements ShouldQueue
{
    use Queueable;

    public $pushToken;

    public $actor;

    public $statusId;

    /**
     * Create a new job instance.
     */
    public function __construct($pushToken, $actor,$statusId)
    {
        $this->pushToken = $pushToken;
        $this->actor = $actor;
        $this->statusId = $statusId;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            NotificationAppGatewayService::send($this->pushToken, 'mention', $this->actor,$this->statusId);
        } catch (Exception $e) {
            return;
        }
    }
}

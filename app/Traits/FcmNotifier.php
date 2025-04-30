<?php

namespace App\Traits;
use App\User;
use Google\Auth\Credentials\ServiceAccountCredentials;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

trait FcmNotifier
{
    /**
     * Send FCM notification to a device using Firebase v1 HTTP API.
     *
     * @param array $userinfo ['access_token' => string, 'fcm_token' => string]
     * @param string $title
     * @return array
     */

    function getGoogleAccessToken()
    {
        return Cache::remember('google_fcm_access_token', 55 * 60, function () {
            $scopes = ['https://www.googleapis.com/auth/cloud-platform'];
            $jsonKeyPath = storage_path('app/pixelfed-firebase.json');
            if (file_exists($jsonKeyPath)) {
                $credentials = new ServiceAccountCredentials($scopes, $jsonKeyPath);
                $authTokenArray = $credentials->fetchAuthToken();
                Log::info( $authTokenArray);
                return $authTokenArray['access_token'];
            }
            
        });
    }

    public function sendFcmNotification()
    {

        $accessToken = $this->getGoogleAccessToken();
        $userData = User::where('profile_id', 823047827513188353)->select('expo_token')->first();

        if($userData){
            $response = Http::withToken($accessToken)
                ->withHeaders([
                    'Content-Type' => 'application/json',
                ])
                ->post('https://fcm.googleapis.com/v1/projects/pixelfed-38904/messages:send', [
                    'message' => [
                        'token' => $userData->expo_token,
                        'notification' => [
                            'title' => env('APP_NAME') ?? "Pixelfed",
                            'body' => 'This is an FCM notification message Tanha!',
                        ],
                        'data' => [
                            'story_id' => 'story_12345',
                        ],
                    ],
                ]);

            return $response->json();
        }

        
    }
}


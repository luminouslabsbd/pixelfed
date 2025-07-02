<?php

namespace App\Http\Controllers;
use Illuminate\Http\Request;
use App\Services\NotificationEncryptionService;

class NotificationController extends Controller
{

    public function decrypt(Request $request)
    {
        $body = $request->input('body');
        $url = $request->input('url');
        return response()->json([
            'body' => $body ? NotificationEncryptionService::decryptString($body) : null,
            'url' => $url ? NotificationEncryptionService::decryptString($url) : null,
        ]);
    }

    public function encrypt(Request $request)
    {
        $body = $request->input('body');
        $url = $request->input('url');
        return response()->json([
            'body' => $body ? NotificationEncryptionService::encryptString($body) : null,
            'url' => $url ? NotificationEncryptionService::encryptString($url) : null,
        ]);
    }
}

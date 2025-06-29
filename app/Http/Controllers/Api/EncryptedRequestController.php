<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Facades\NotificationEncryption;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class EncryptedRequestController extends Controller
{
    /**
     * Handle an encrypted request from the frontend
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function handleEncryptedRequest(Request $request)
    {
        try {
            // Get the encrypted data from the request
            $encryptedData = $request->all();
            
            // Decrypt the request data
            $decryptedData = NotificationEncryption::decryptRequest($encryptedData);
            
            if ($decryptedData === null) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Failed to decrypt request data'
                ], 400);
            }
            
            // Process the decrypted data
            // This is where you would handle the actual business logic
            // For demonstration, we'll just return the decrypted data
            
            // Encrypt the response
            $encryptedResponse = NotificationEncryption::encrypt([
                'status' => 'success',
                'message' => 'Request processed successfully',
                'data' => $decryptedData
            ]);
            
            return response()->json($encryptedResponse);
        } catch (\Exception $e) {
            Log::error('Error handling encrypted request: ' . $e->getMessage());
            
            return response()->json([
                'status' => 'error',
                'message' => 'An error occurred while processing your request'
            ], 500);
        }
    }
}

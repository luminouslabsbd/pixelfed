<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Exception;

class NotificationEncryptionService
{
    /**
     * The encryption method to use
     */
    const CIPHER_METHOD = 'aes-256-cbc';
    
    /**
     * The key length for the encryption
     */
    const KEY_LENGTH = 32; // 256 bits
    
    /**
     * The IV length for the encryption
     */
    const IV_LENGTH = 16; // 128 bits
    
    /**
     * Get the encryption key
     * 
     * @return string
     */
    public static function getEncryptionKey()
    {
        $key = env('NOTIFICATION_ENCRYPTION_KEY');
        
        if (!$key) {
            // Generate a key if one doesn't exist
            $key = self::generateEncryptionKey();
            
            // Log that a key was generated, but don't store it in the .env file
            // In production, you should manually set this in your .env file
            Log::warning('NOTIFICATION_ENCRYPTION_KEY not found in .env file. Using a temporary key.');
        }
        
        // Ensure the key is the correct length
        return substr(hash('sha256', $key), 0, self::KEY_LENGTH);
    }
    
    /**
     * Generate a random encryption key
     * 
     * @return string
     */
    public static function generateEncryptionKey()
    {
        return bin2hex(random_bytes(self::KEY_LENGTH));
    }
    
    /**
     * Encrypt data
     * 
     * @param array $data
     * @return array
     */
    public static function encrypt($data)
    {
        try {
            // Generate a random IV
            $iv = random_bytes(self::IV_LENGTH);
            
            // Get the encryption key
            $key = self::getEncryptionKey();
            
            // Convert data to JSON
            $jsonData = json_encode($data);
            
            // Encrypt the data
            $encrypted = openssl_encrypt(
                $jsonData,
                self::CIPHER_METHOD,
                $key,
                0,
                $iv
            );
            
            if ($encrypted === false) {
                throw new Exception('Failed to encrypt data');
            }
            
            // Return the encrypted data and IV
            // IMPORTANT: FCM requires all data values to be strings
            return [
                'encrypted' => 'true', // Convert boolean to string for FCM compatibility
                'data' => base64_encode($encrypted),
                'iv' => base64_encode($iv),
                'timestamp' => (string) time() // Convert timestamp to string for FCM compatibility
            ];
        } catch (Exception $e) {
            Log::error('Notification encryption failed: ' . $e->getMessage());
            
            // Return the original data if encryption fails
            return [
                'encrypted' => 'false', // Convert boolean to string for FCM compatibility
                'data' => json_encode($data), // Convert data to JSON string
                'error' => 'Encryption failed'
            ];
        }
    }
    
    /**
     * Decrypt data
     * 
     * @param string $encryptedData
     * @param string $iv
     * @return array|null
     */
    public static function decrypt($encryptedData, $iv)
    {
        try {
            // Get the encryption key
            $key = self::getEncryptionKey();
            
            // Decode the base64 encoded data
            $encryptedData = base64_decode($encryptedData);
            $iv = base64_decode($iv);
            
            // Decrypt the data
            $decrypted = openssl_decrypt(
                $encryptedData,
                self::CIPHER_METHOD,
                $key,
                0,
                $iv
            );
            
            if ($decrypted === false) {
                throw new Exception('Failed to decrypt data');
            }
            
            // Convert JSON back to array
            return json_decode($decrypted, true);
        } catch (Exception $e) {
            Log::error('Notification decryption failed: ' . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Decrypt incoming request data from frontend
     *
     * @param array $encryptedRequest The encrypted request data
     * @return array|null The decrypted data or null if decryption fails
     */
    public static function decryptRequest($encryptedRequest)
    {
        try {
            // Validate the encrypted request structure
            if (!isset($encryptedRequest['encrypted']) || 
                !isset($encryptedRequest['data']) || 
                !isset($encryptedRequest['iv'])) {
                Log::error('Invalid encrypted request structure');
                return null;
            }
            
            // Check if the request is actually encrypted
            if ($encryptedRequest['encrypted'] !== true && $encryptedRequest['encrypted'] !== 'true') {
                // Not encrypted, return as is
                return $encryptedRequest;
            }
            
            // Decrypt the payload
            return self::decrypt($encryptedRequest['data'], $encryptedRequest['iv']);
        } catch (Exception $e) {
            Log::error('Error decrypting request data: ' . $e->getMessage());
            return null;
        }
    }
}

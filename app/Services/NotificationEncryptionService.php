<?php

namespace App\Services;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Contracts\Encryption\DecryptException;

class NotificationEncryptionService
{
   public static function  encryptString(string $plainText): string
    {
        return Crypt::encryptString($plainText);
    }

    public static function decryptString(string $encryptedText): string
    {
        try {
            return Crypt::decryptString($encryptedText);
        } catch (DecryptException $e) {
            return 'Decryption failed: ' . $e->getMessage();
        }
    }
}


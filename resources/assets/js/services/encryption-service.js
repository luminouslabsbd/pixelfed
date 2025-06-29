/**
 * Frontend Encryption Service
 * Handles encryption and decryption of data sent to and from the backend
 */
export default class EncryptionService {
    /**
     * Convert a string to an array buffer
     * @param {string} str - String to convert
     * @returns {ArrayBuffer} - Array buffer
     */
    static stringToArrayBuffer(str) {
        const encoder = new TextEncoder();
        return encoder.encode(str).buffer;
    }

    /**
     * Convert an array buffer to a string
     * @param {ArrayBuffer} buffer - Array buffer
     * @returns {string} - String
     */
    static arrayBufferToString(buffer) {
        const decoder = new TextDecoder();
        return decoder.decode(buffer);
    }

    /**
     * Convert a base64 string to an array buffer
     * @param {string} base64 - Base64 encoded string
     * @returns {ArrayBuffer} - Array buffer
     */
    static base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Convert an array buffer to a base64 string
     * @param {ArrayBuffer} buffer - Array buffer
     * @returns {string} - Base64 encoded string
     */
    static arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Derive a key from a password
     * @param {string} password - Password to derive key from
     * @returns {Promise<CryptoKey>} - Derived key
     */
    static async deriveKey(password) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );
        
        // Use a salt and iteration count
        const salt = encoder.encode('pixelfed-notification-salt');
        
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-CBC', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Get the encryption key
     * @returns {string} - Encryption key
     */
    static getEncryptionKey() {
        // In a real implementation, you might get this from a secure source
        // For demo purposes, we're using a hardcoded key
        // WARNING: In production, use a proper key management system
        return "PIXELFED_NOTIFICATION_KEY";
    }

    /**
     * Encrypt data
     * @param {object} data - Data to encrypt
     * @returns {Promise<object>} - Object containing encrypted data and IV
     */
    static async encrypt(data) {
        try {
            // Convert data to JSON string
            const jsonString = JSON.stringify(data);
            
            // Convert string to array buffer
            const dataBuffer = this.stringToArrayBuffer(jsonString);
            
            // Generate a random IV
            const iv = crypto.getRandomValues(new Uint8Array(16));
            
            // Derive the key
            const key = await this.deriveKey(this.getEncryptionKey());
            
            // Encrypt the data
            const encryptedBuffer = await crypto.subtle.encrypt(
                {
                    name: 'AES-CBC',
                    iv: iv
                },
                key,
                dataBuffer
            );
            
            // Convert encrypted data and IV to base64
            const encryptedBase64 = this.arrayBufferToBase64(encryptedBuffer);
            const ivBase64 = this.arrayBufferToBase64(iv);
            
            // Return encrypted data and IV
            return {
                encrypted: true,
                data: encryptedBase64,
                iv: ivBase64
            };
        } catch (error) {
            console.error('Encryption error:', error);
            return null;
        }
    }

    /**
     * Decrypt data
     * @param {string} encryptedData - Base64 encoded encrypted data
     * @param {string} iv - Base64 encoded initialization vector
     * @returns {Promise<object>} - Decrypted data as an object
     */
    static async decrypt(encryptedData, iv) {
        try {
            // Convert base64 to array buffer
            const encryptedBuffer = this.base64ToArrayBuffer(encryptedData);
            const ivBuffer = this.base64ToArrayBuffer(iv);
            
            // Derive the key
            const key = await this.deriveKey(this.getEncryptionKey());
            
            // Decrypt the data
            const decryptedBuffer = await crypto.subtle.decrypt(
                {
                    name: 'AES-CBC',
                    iv: ivBuffer
                },
                key,
                encryptedBuffer
            );
            
            // Convert the decrypted buffer to a string and parse as JSON
            const decryptedString = this.arrayBufferToString(decryptedBuffer);
            return JSON.parse(decryptedString);
        } catch (error) {
            console.error('Decryption error:', error);
            return null;
        }
    }
}

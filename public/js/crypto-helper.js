/**
 * CryptoHelper - Utility for encrypting and decrypting notification payloads
 */
const CryptoHelper = {
    /**
     * Convert a base64 string to an array buffer
     * @param {string} base64 - Base64 encoded string
     * @returns {ArrayBuffer} - Array buffer
     */
    base64ToArrayBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    },

    /**
     * Convert an array buffer to a base64 string
     * @param {ArrayBuffer} buffer - Array buffer
     * @returns {string} - Base64 encoded string
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    },

    /**
     * Convert a string to an array buffer
     * @param {string} str - String to convert
     * @returns {ArrayBuffer} - Array buffer
     */
    stringToArrayBuffer(str) {
        const encoder = new TextEncoder();
        return encoder.encode(str).buffer;
    },

    /**
     * Convert an array buffer to a string
     * @param {ArrayBuffer} buffer - Array buffer
     * @returns {string} - String
     */
    arrayBufferToString(buffer) {
        const decoder = new TextDecoder();
        return decoder.decode(buffer);
    },

    /**
     * Derive a key from a password
     * @param {string} password - Password to derive key from
     * @returns {Promise<CryptoKey>} - Derived key
     */
    async deriveKey(password) {
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
    },

    /**
     * Decrypt data
     * @param {string} encryptedData - Base64 encoded encrypted data
     * @param {string} iv - Base64 encoded initialization vector
     * @param {string} key - Encryption key
     * @returns {object} - Decrypted data as an object
     */
    async decrypt(encryptedData, iv, key) {
        try {
            // Convert base64 to array buffer
            const encryptedBuffer = this.base64ToArrayBuffer(encryptedData);
            const ivBuffer = this.base64ToArrayBuffer(iv);
            
            // Derive the key
            const cryptoKey = await this.deriveKey(key);
            
            // Decrypt the data
            const decryptedBuffer = await crypto.subtle.decrypt(
                {
                    name: 'AES-CBC',
                    iv: ivBuffer
                },
                cryptoKey,
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
};

// Make it available to the service worker
self.CryptoHelper = CryptoHelper;

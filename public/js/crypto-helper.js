/**
 * CryptoHelper - Utility for encrypting and decrypting notification payloads
 */
const CryptoHelper = {
    /**
     * Convert base64 to array buffer
     * @param {string} base64 - Base64 encoded string
     * @returns {ArrayBuffer} - Array buffer
     */
    base64ToArrayBuffer(base64) {
        try {
            console.log('Converting base64 to ArrayBuffer, length:', base64.length);
            
            // Remove any whitespace and make sure we have clean base64
            base64 = base64.replace(/\s/g, '');
            
            // Add padding if needed
            while (base64.length % 4 !== 0) {
                base64 += '=';
            }
            
            console.log('Cleaned base64 string, length:', base64.length);
            
            const binaryString = atob(base64);
            console.log('Binary string created, length:', binaryString.length);
            
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            console.log('ArrayBuffer created, byteLength:', bytes.buffer.byteLength);
            return bytes.buffer;
        } catch (error) {
            console.error('Error in base64ToArrayBuffer:', error);
            console.error('Problematic base64 string (first 20 chars):', 
                base64 ? base64.substring(0, 20) + '...' : 'undefined');
            throw error;
        }
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
     * Derive a key from a password using the same method as backend
     * @param {string} password - Password to derive key from
     * @returns {Promise<CryptoKey>} - Derived key
     */
    async deriveKey(password) {
        const encoder = new TextEncoder();

        // Hash the password using SHA-256 and take first 32 bytes (same as backend)
        const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
        const hashArray = new Uint8Array(hashBuffer);
        const keyBytes = hashArray.slice(0, 32); // Take first 32 bytes (256 bits)

        // Import the key for AES-CBC
        return crypto.subtle.importKey(
            'raw',
            keyBytes,
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
            console.log('Decryption started with:', { 
                encryptedDataLength: encryptedData ? encryptedData.length : 0, 
                ivLength: iv ? iv.length : 0, 
                keyLength: key ? key.length : 0 
            });
            
            if (!encryptedData || !iv || !key) {
                console.error('Missing required parameters for decryption');
                return null;
            }
            
            // Ensure we have clean base64 strings
            encryptedData = encryptedData.trim();
            iv = iv.trim();
            
            // Convert base64 to array buffer
            try {
                var encryptedBuffer = this.base64ToArrayBuffer(encryptedData);
                var ivBuffer = this.base64ToArrayBuffer(iv);
                
                console.log('Buffers created:', { 
                    encryptedBufferLength: encryptedBuffer.byteLength,
                    ivBufferLength: ivBuffer.byteLength 
                });
            } catch (bufferError) {
                console.error('Error creating buffers:', bufferError);
                return null;
            }
            
            // Derive the key
            try {
                var cryptoKey = await this.deriveKey(key);
                console.log('Key derived successfully');
            } catch (keyError) {
                console.error('Error deriving key:', keyError);
                return null;
            }
            
            // Decrypt the data
            console.log('Attempting decryption with AES-CBC...');
            let decryptedBuffer;
            try {
                decryptedBuffer = await crypto.subtle.decrypt(
                    {
                        name: 'AES-CBC',
                        iv: ivBuffer
                    },
                    cryptoKey,
                    encryptedBuffer
                );
                
                console.log('Decryption successful, buffer size:', decryptedBuffer.byteLength);
            } catch (decryptError) {
                console.error('Error during decryption operation:', decryptError);
                return null;
            }
            
            // Convert the decrypted buffer to a string
            let decryptedString;
            try {
                decryptedString = this.arrayBufferToString(decryptedBuffer);
                console.log('Decrypted string (first 100 chars):', 
                    decryptedString.substring(0, Math.min(100, decryptedString.length)));
            } catch (stringError) {
                console.error('Error converting buffer to string:', stringError);
                return null;
            }
            
            // Parse as JSON
            try {
                const parsedData = JSON.parse(decryptedString);
                console.log('JSON parsed successfully:', parsedData);
                return parsedData;
            } catch (jsonError) {
                console.error('Error parsing JSON:', jsonError);
                console.log('Raw decrypted content:', decryptedString);
                return null;
            }
        } catch (error) {
            console.error('Decryption error:', error);
            console.error('Error details:', { 
                message: error.message, 
                stack: error.stack,
                name: error.name
            });
            return null;
        }
    }
};

// Make it available to the service worker
self.CryptoHelper = CryptoHelper;

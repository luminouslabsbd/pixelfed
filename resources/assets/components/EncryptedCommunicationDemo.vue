<template>
  <div class="card">
    <div class="card-header bg-white font-weight-bold">
      Encrypted Communication Demo
    </div>
    <div class="card-body">
      <div class="form-group">
        <label for="message">Message to encrypt:</label>
        <textarea 
          id="message" 
          v-model="message" 
          class="form-control" 
          rows="3" 
          placeholder="Enter a message to encrypt and send to the server"
        ></textarea>
      </div>
      
      <button 
        @click="sendEncryptedMessage" 
        class="btn btn-primary" 
        :disabled="loading"
      >
        <span v-if="loading" class="spinner-border spinner-border-sm mr-1" role="status" aria-hidden="true"></span>
        Send Encrypted Message
      </button>
      
      <div v-if="error" class="alert alert-danger mt-3">
        {{ error }}
      </div>
      
      <div v-if="response" class="mt-4">
        <h5>Server Response:</h5>
        <div class="card bg-light">
          <div class="card-body">
            <pre class="mb-0">{{ responseFormatted }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import EncryptionService from '../js/services/encryption-service';
import axios from 'axios';

export default {
  name: 'EncryptedCommunicationDemo',
  
  data() {
    return {
      message: '',
      loading: false,
      error: null,
      response: null
    };
  },
  
  computed: {
    responseFormatted() {
      return JSON.stringify(this.response, null, 2);
    }
  },
  
  methods: {
    async sendEncryptedMessage() {
      if (!this.message.trim()) {
        this.error = 'Please enter a message to encrypt';
        return;
      }
      
      this.loading = true;
      this.error = null;
      this.response = null;
      
      try {
        // Data to encrypt
        const dataToEncrypt = {
          message: this.message,
          timestamp: new Date().toISOString(),
          metadata: {
            client: 'web',
            version: '1.0.0'
          }
        };
        
        // Encrypt the data
        const encryptedData = await EncryptionService.encrypt(dataToEncrypt);
        
        if (!encryptedData) {
          throw new Error('Failed to encrypt data');
        }
        
        // Send the encrypted data to the server
        const response = await axios.post('/api/v1/encrypted/request', encryptedData);
        
        // Check if the response is encrypted
        if (response.data && response.data.encrypted === true) {
          // Decrypt the response
          const decryptedResponse = await EncryptionService.decrypt(
            response.data.data,
            response.data.iv
          );
          
          this.response = decryptedResponse;
        } else {
          // Handle non-encrypted response
          this.response = response.data;
        }
      } catch (error) {
        console.error('Error sending encrypted message:', error);
        this.error = error.message || 'An error occurred while sending the encrypted message';
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
pre {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

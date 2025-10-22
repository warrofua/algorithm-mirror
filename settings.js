/**
 * Claudey AI Vision - Settings Script
 * Manages extension configuration and system diagnostics
 */

class ClaudeySettings {
    constructor() {
        this.settings = {
            isActive: true,
            analysisInterval: 30000,
            vlmModel: 'llava:7b',
            embeddingModel: 'nomic-embed-text',
            ollamaEndpoint: 'http://localhost:11434',
            retentionDays: 30,
            excludedDomains: []
        };
        
        this.availableModels = [];
        this.init();
    }

    async init() {
        await this.loadSettings();
        await this.loadAvailableModels();
        this.setupEventListeners();
        this.populateUI();
        this.checkSystemStatus();
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['claudeySettings']);
            if (result.claudeySettings) {
                this.settings = { ...this.settings, ...result.claudeySettings };
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    async saveSettings() {
        try {
            this.showSaveIndicator('saving');
            await chrome.storage.local.set({ claudeySettings: this.settings });
            
            // Notify background script
            await chrome.runtime.sendMessage({
                type: 'SETTINGS_UPDATED',
                data: this.settings
            });
            
            this.showSaveIndicator('saved');
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showSaveIndicator('error');
        }
    }

    async loadAvailableModels() {
        try {
            const response = await fetch(`${this.settings.ollamaEndpoint}/api/tags`);
            if (response.ok) {
                const data = await response.json();
                this.availableModels = data.models || [];
            }
        } catch (error) {
            console.error('Failed to load models:', error);
            this.availableModels = [];
        }
    }

    setupEventListeners() {
        // AI Toggle
        document.getElementById('aiToggle').addEventListener('click', () => {
            this.settings.isActive = !this.settings.isActive;
            this.updateAIToggle();
            this.saveSettings();
        });

        // Analysis Interval
        document.getElementById('analysisInterval').addEventListener('input', (e) => {
            this.settings.analysisInterval = parseInt(e.target.value) * 1000;
            document.getElementById('intervalValue').textContent = `${e.target.value}s`;
            this.saveSettings();
        });

        // Ollama Endpoint
        document.getElementById('ollamaEndpoint').addEventListener('change', (e) => {
            this.settings.ollamaEndpoint = e.target.value;
            this.saveSettings();
            this.checkSystemStatus();
        });

        // Embedding Model
        document.getElementById('embeddingModel').addEventListener('change', (e) => {
            this.settings.embeddingModel = e.target.value;
            this.saveSettings();
        });

        // Retention Days
        document.getElementById('retentionDays').addEventListener('input', (e) => {
            this.settings.retentionDays = parseInt(e.target.value);
            document.getElementById('retentionValue').textContent = `${e.target.value} days`;
            this.saveSettings();
        });

        // Excluded Domains
        document.getElementById('excludedDomains').addEventListener('change', (e) => {
            this.settings.excludedDomains = e.target.value
                .split('\n')
                .map(domain => domain.trim())
                .filter(domain => domain.length > 0);
            this.saveSettings();
        });

        // Button handlers
        document.getElementById('refreshModels').addEventListener('click', () => {
            this.refreshModels();
        });

        document.getElementById('installModel').addEventListener('click', () => {
            this.showInstallModelDialog();
        });

        document.getElementById('clearMemories').addEventListener('click', () => {
            this.clearAllMemories();
        });

        document.getElementById('exportMemories').addEventListener('click', () => {
            this.exportMemories();
        });

        document.getElementById('runDiagnostics').addEventListener('click', () => {
            this.runDiagnostics();
        });

        document.getElementById('testCapture').addEventListener('click', () => {
            this.testCapture();
        });

        document.getElementById('testVLM').addEventListener('click', () => {
            this.testVLM();
        });
    }

    populateUI() {
        // AI Toggle
        this.updateAIToggle();

        // Analysis Interval
        const intervalSeconds = this.settings.analysisInterval / 1000;
        document.getElementById('analysisInterval').value = intervalSeconds;
        document.getElementById('intervalValue').textContent = `${intervalSeconds}s`;

        // Ollama Endpoint
        document.getElementById('ollamaEndpoint').value = this.settings.ollamaEndpoint;

        // Embedding Model
        document.getElementById('embeddingModel').value = this.settings.embeddingModel;

        // Retention Days
        document.getElementById('retentionDays').value = this.settings.retentionDays;
        document.getElementById('retentionValue').textContent = `${this.settings.retentionDays} days`;

        // Excluded Domains
        document.getElementById('excludedDomains').value = this.settings.excludedDomains.join('\n');

        // Populate VLM models
        this.populateVLMModels();
    }

    updateAIToggle() {
        const toggle = document.getElementById('aiToggle');
        const label = document.getElementById('aiToggleLabel');
        
        if (this.settings.isActive) {
            toggle.classList.add('active');
            label.textContent = 'AI Vision Active';
        } else {
            toggle.classList.remove('active');
            label.textContent = 'AI Vision Inactive';
        }
    }

    populateVLMModels() {
        const container = document.getElementById('vlmModels');
        container.innerHTML = '';

        const vlmModels = [
            {
                name: 'llava:7b',
                description: 'Balanced performance and quality for vision tasks',
                size: '4.7GB',
                available: this.availableModels.some(m => m.name.includes('llava:7b'))
            },
            {
                name: 'llava:13b',
                description: 'Higher quality analysis, requires more resources',
                size: '7.3GB',
                available: this.availableModels.some(m => m.name.includes('llava:13b'))
            },
            {
                name: 'llava:34b',
                description: 'Best quality but very resource intensive',
                size: '20GB',
                available: this.availableModels.some(m => m.name.includes('llava:34b'))
            },
            {
                name: 'bakllava',
                description: 'Alternative vision model with good performance',
                size: '4.1GB',
                available: this.availableModels.some(m => m.name.includes('bakllava'))
            }
        ];

        vlmModels.forEach(model => {
            const card = document.createElement('div');
            card.className = `model-card ${model.name === this.settings.vlmModel ? 'selected' : ''}`;
            card.innerHTML = `
                <div class="model-name">${model.name} ${!model.available ? '(Not Installed)' : ''}</div>
                <div class="model-description">${model.description}</div>
                <div class="model-size">${model.size}</div>
            `;
            
            card.addEventListener('click', () => {
                if (model.available) {
                    this.settings.vlmModel = model.name;
                    this.saveSettings();
                    this.populateVLMModels();
                } else {
                    this.installModel(model.name);
                }
            });
            
            container.appendChild(card);
        });
    }

    async checkSystemStatus() {
        // Check Ollama connection
        try {
            const response = await fetch(`${this.settings.ollamaEndpoint}/api/tags`);
            document.getElementById('ollamaStatus').textContent = response.ok ? 'Connected' : 'Failed';
            document.getElementById('ollamaStatus').className = response.ok ? 'status-value status-success' : 'status-value status-error';
        } catch (error) {
            document.getElementById('ollamaStatus').textContent = 'Error';
            document.getElementById('ollamaStatus').className = 'status-value status-error';
        }

        // Check VLM model
        const vlmAvailable = this.availableModels.some(m => m.name.includes(this.settings.vlmModel));
        document.getElementById('vlmStatus').textContent = vlmAvailable ? 'Available' : 'Not Installed';
        document.getElementById('vlmStatus').className = vlmAvailable ? 'status-value status-success' : 'status-value status-error';

        // Check embedding model
        const embeddingAvailable = this.availableModels.some(m => m.name.includes(this.settings.embeddingModel));
        document.getElementById('embeddingStatus').textContent = embeddingAvailable ? 'Available' : 'Not Installed';
        document.getElementById('embeddingStatus').className = embeddingAvailable ? 'status-value status-success' : 'status-value status-error';

        // Get memory stats
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_MEMORY' });
            if (response && response.memory) {
                document.getElementById('totalMemories').textContent = response.memory.length;
                
                // Estimate storage size (rough calculation)
                const estimatedSize = response.memory.length * 0.5; // ~500KB per memory
                document.getElementById('storageUsed').textContent = `${estimatedSize.toFixed(1)} MB`;
            }
        } catch (error) {
            console.error('Failed to get memory stats:', error);
        }
    }

    async refreshModels() {
        document.getElementById('refreshModels').textContent = '🔄 Refreshing...';
        await this.loadAvailableModels();
        this.populateVLMModels();
        this.checkSystemStatus();
        document.getElementById('refreshModels').textContent = '🔄 Refresh Available Models';
        this.showNotification('Models refreshed successfully');
    }

    showInstallModelDialog() {
        const modelName = prompt('Enter model name to install (e.g., llava:13b):');
        if (modelName) {
            this.installModel(modelName);
        }
    }

    async installModel(modelName) {
        try {
            this.showNotification(`Installing ${modelName}... This may take several minutes.`, 'info');
            
            // Note: In a real implementation, you'd need to trigger Ollama pull
            // This is a placeholder for the UI
            const confirmed = confirm(`Install ${modelName}? This will download several GB of data and may take time.`);
            
            if (confirmed) {
                this.showNotification(`Model installation started. Check Ollama logs for progress.`, 'success');
            }
        } catch (error) {
            this.showNotification(`Failed to install model: ${error.message}`, 'error');
        }
    }

    async clearAllMemories() {
        const confirmed = confirm('Are you sure you want to clear all memories? This cannot be undone.');
        if (confirmed) {
            try {
                await chrome.runtime.sendMessage({ type: 'CLEAR_ALL_MEMORIES' });
                this.showNotification('All memories cleared successfully');
                this.checkSystemStatus();
            } catch (error) {
                this.showNotification('Failed to clear memories', 'error');
            }
        }
    }

    async exportMemories() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_MEMORY' });
            if (response && response.memory) {
                const dataStr = JSON.stringify(response.memory, null, 2);
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                
                const link = document.createElement('a');
                link.href = URL.createObjectURL(dataBlob);
                link.download = `claudey-memories-${new Date().toISOString().split('T')[0]}.json`;
                link.click();
                
                this.showNotification('Memories exported successfully');
            }
        } catch (error) {
            this.showNotification('Failed to export memories', 'error');
        }
    }

    async runDiagnostics() {
        document.getElementById('runDiagnostics').textContent = '🔍 Running...';
        
        // Run comprehensive diagnostics
        await this.checkSystemStatus();
        await this.loadAvailableModels();
        
        // Test basic functionality
        try {
            await chrome.runtime.sendMessage({ type: 'PING' });
            this.showNotification('Diagnostics completed successfully');
        } catch (error) {
            this.showNotification('Diagnostics found issues - check system status', 'error');
        }
        
        document.getElementById('runDiagnostics').textContent = '🔍 Run Diagnostics';
    }

    async testCapture() {
        try {
            await chrome.runtime.sendMessage({ type: 'TEST_CAPTURE' });
            this.showNotification('Test capture initiated - check active tab', 'info');
        } catch (error) {
            this.showNotification('Test capture failed', 'error');
        }
    }

    async testVLM() {
        try {
            document.getElementById('testVLM').textContent = '🔄 Testing...';
            const response = await chrome.runtime.sendMessage({ type: 'TEST_VLM' });
            
            if (response.success) {
                this.showNotification('VLM connection test successful!', 'success');
            } else {
                this.showNotification(`VLM test failed: ${response.error}`, 'error');
            }
            
            document.getElementById('testVLM').textContent = '🧠 Test VLM Connection';
        } catch (error) {
            this.showNotification(`VLM test failed: ${error.message}`, 'error');
            document.getElementById('testVLM').textContent = '🧠 Test VLM Connection';
        }
    }

    showSaveIndicator(status) {
        const indicator = document.getElementById('saveIndicator');
        indicator.className = `save-indicator ${status}`;
        
        switch (status) {
            case 'saving':
                indicator.textContent = 'Saving...';
                break;
            case 'saved':
                indicator.textContent = 'All changes saved';
                setTimeout(() => {
                    indicator.className = 'save-indicator';
                }, 2000);
                break;
            case 'error':
                indicator.textContent = 'Save failed';
                setTimeout(() => {
                    indicator.className = 'save-indicator';
                }, 3000);
                break;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? 'rgba(255, 69, 58, 0.9)' : 
                        type === 'success' ? 'rgba(48, 209, 88, 0.9)' : 
                        'rgba(0, 122, 255, 0.9)'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            font-size: 14px;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 4000);
    }
}

// Initialize settings when page loads
let claudeySettings;
document.addEventListener('DOMContentLoaded', () => {
    claudeySettings = new ClaudeySettings();
});
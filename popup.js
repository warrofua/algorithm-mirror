/**
 * Algorithm Mirror - Popup Script
 * Handles the extension popup interface
 */

class ClaudeyPopup {
    constructor() {
        this.isAIActive = true;
        this.stats = {
            pagesAnalyzed: 0,
            memoriesStored: 0
        };
        
        this.init();
    }

    async init() {
        await this.loadSettings();
        await this.loadStats();
        this.setupEventListeners();
        await this.checkPermissions();
        this.updateUI();
    }

    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_SETTINGS'
            });
            
            if (response.settings) {
                this.isAIActive = response.settings.isActive !== false;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    async loadStats() {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'GET_MEMORY'
            });
            
            if (response.memory) {
                this.stats.memoriesStored = response.memory.length;
                this.stats.pagesAnalyzed = response.memory.length; // For now, same value
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    setupEventListeners() {
        // AI Toggle
        document.getElementById('aiToggle').addEventListener('click', () => {
            this.toggleAI();
        });

        // Capture button
        document.getElementById('captureBtn').addEventListener('click', () => {
            this.captureCurrentPage();
        });

        // Permission button
        document.getElementById('permissionBtn').addEventListener('click', () => {
            this.requestPermissions();
        });

        // Memory timeline
        document.getElementById('memoryBtn').addEventListener('click', () => {
            this.openMemoryTimeline();
        });

        // Search
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.openSearch();
        });

        // Settings
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.openSettings();
        });
    }

    updateUI() {
        const statusLight = document.getElementById('statusLight');
        const statusTitle = document.getElementById('statusTitle');
        const statusDesc = document.getElementById('statusDesc');
        const aiToggle = document.getElementById('aiToggle');

        if (this.isAIActive) {
            statusLight.style.background = '#30d158';
            statusTitle.textContent = 'Algorithm Mirror Active';
            statusDesc.textContent = 'Watching and analyzing your browsing';
            aiToggle.classList.add('active');
        } else {
            statusLight.style.background = '#ff453a';
            statusLight.style.animation = 'none';
            statusTitle.textContent = 'Algorithm Mirror Inactive';
            statusDesc.textContent = 'Click to enable automatic analysis';
            aiToggle.classList.remove('active');
        }

        // Update stats
        document.getElementById('pagesAnalyzed').textContent = this.stats.pagesAnalyzed;
        document.getElementById('memoriesStored').textContent = this.stats.memoriesStored;
    }

    async toggleAI() {
        this.isAIActive = !this.isAIActive;
        
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'TOGGLE_AI',
                data: { isActive: this.isAIActive }
            });
            
            this.updateUI();
            
            let message = this.isAIActive ? 'Algorithm Mirror enabled' : 'Algorithm Mirror disabled';
            if (!this.isAIActive && response.cancelledAnalyses > 0) {
                message += ` (${response.cancelledAnalyses} active analysis${response.cancelledAnalyses > 1 ? 'es' : ''} cancelled)`;
            }
            
            this.showNotification(message);
        } catch (error) {
            console.error('Failed to toggle AI:', error);
            this.isAIActive = !this.isAIActive; // Revert on error
        }
    }

    async captureCurrentPage() {
        try {
            // Get current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                this.showNotification('No active tab found');
                return;
            }

            // Send capture message to content script
            await chrome.tabs.sendMessage(tab.id, {
                type: 'MANUAL_CAPTURE'
            });

            this.showNotification('📸 Capturing page...');
            
            // Close popup after a short delay
            setTimeout(() => {
                window.close();
            }, 1000);
            
        } catch (error) {
            console.error('Capture failed:', error);
            this.showNotification('Capture failed - make sure page is loaded');
        }
    }

    async openMemoryTimeline() {
        try {
            // Open memory timeline in a new tab
            await chrome.tabs.create({
                url: chrome.runtime.getURL('memory-timeline.html')
            });
            
            window.close();
        } catch (error) {
            console.error('Failed to open memory timeline:', error);
            this.showNotification('Failed to open memory timeline');
        }
    }

    async openSearch() {
        try {
            // For now, just show a notification
            // In a full implementation, this would open a search interface
            this.showNotification('Search interface coming soon!');
        } catch (error) {
            console.error('Failed to open search:', error);
        }
    }

    async openSettings() {
        try {
            // Open settings in a new tab
            await chrome.tabs.create({
                url: chrome.runtime.getURL('settings.html')
            });
            
            window.close();
        } catch (error) {
            console.error('Failed to open settings:', error);
            this.showNotification('Settings interface coming soon!');
        }
    }

    showNotification(message) {
        // Create a temporary notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 12px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 100);
        
        // Remove after 2 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 2000);
    }

    async checkPermissions() {
        try {
            const hasActiveTab = await chrome.permissions.contains({
                permissions: ['activeTab']
            });
            
            const hasHostPermissions = await chrome.permissions.contains({
                origins: ['<all_urls>']
            });
            
            // Show permission button if we're missing essential permissions
            const needsPermission = !hasActiveTab || !hasHostPermissions;
            const permissionBtn = document.getElementById('permissionBtn');
            
            if (needsPermission) {
                permissionBtn.style.display = 'block';
                this.showNotification('⚠️ Screenshot permissions needed');
            } else {
                permissionBtn.style.display = 'none';
            }
        } catch (error) {
            console.error('Error checking permissions:', error);
            // Show permission button as fallback
            document.getElementById('permissionBtn').style.display = 'block';
        }
    }

    async requestPermissions() {
        try {
            const granted = await chrome.permissions.request({
                permissions: ['activeTab'],
                origins: ['<all_urls>']
            });
            
            if (granted) {
                this.showNotification('✅ Permissions granted!');
                document.getElementById('permissionBtn').style.display = 'none';
                
                // Tell background script to retry screenshot
                chrome.runtime.sendMessage({
                    type: 'PERMISSIONS_GRANTED'
                });
            } else {
                this.showNotification('❌ Permissions denied');
            }
        } catch (error) {
            console.error('Error requesting permissions:', error);
            this.showNotification('❌ Permission request failed');
        }
    }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ClaudeyPopup();
});
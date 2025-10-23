/**
 * Algorithm Mirror - Electron Renderer Process
 * Handles UI interactions and communicates with main process
 */

const { ipcRenderer } = require('electron');

class AlgorithmMirrorElectronRenderer {
    constructor() {
        // Core state
        this.isAIActive = true;
        this.currentUrl = '';
        this.memoryData = new Map();
        this.timelineData = [];
        this.categories = new Set();
        
        // VLM & Analysis
        this.vlmEndpoint = 'http://localhost:11434/api/generate';
        this.selectedModel = 'llava:latest';
        
        // UI elements
        this.elements = {};
        
        this.init();
    }

    async init() {
        this.initElements();
        this.setupEventListeners();
        this.setupIPC();
        this.initAI();
        this.showToast('Algorithm Mirror ready', 'success');
        
        // Load existing memory data
        await this.loadMemoryData();
    }

    initElements() {
        // Core UI elements
        this.elements = {
            // Browser controls
            addressBar: document.getElementById('address-bar'),
            goBtn: document.getElementById('go-btn'),
            backBtn: document.getElementById('back-btn'),
            forwardBtn: document.getElementById('forward-btn'),
            refreshBtn: document.getElementById('refresh-btn'),
            
            // AI controls
            aiToggleBtn: document.getElementById('ai-toggle-btn'),
            memoryBtn: document.getElementById('memory-btn'),
            aiStatus: document.getElementById('ai-status'),
            captureBtn: document.getElementById('capture-btn'),
            
            // Sidebar
            aiSidebar: document.getElementById('ai-sidebar'),
            analysisFeed: document.getElementById('analysis-feed'),
            memorySearch: document.getElementById('memory-search'),
            searchMemoryBtn: document.getElementById('search-memory-btn'),
            
            // Memory modal
            memoryModal: document.getElementById('memory-modal'),
            timelineContainer: document.getElementById('timeline-container'),
            closeMemoryBtn: document.getElementById('close-memory-btn'),
            
            // PDF
            pdfDropZone: document.getElementById('pdf-drop-zone'),
            pdfUpload: document.getElementById('pdf-upload'),
            
            // Toast
            toastContainer: document.getElementById('toast-container')
        };

        // Hide the browser viewport since we're using BrowserView
        const browserViewport = document.querySelector('.browser-viewport');
        if (browserViewport) {
            browserViewport.style.display = 'none';
        }
    }

    setupEventListeners() {
        // Browser navigation
        this.elements.goBtn.addEventListener('click', () => this.navigateToUrl());
        this.elements.addressBar.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.navigateToUrl();
        });
        this.elements.backBtn.addEventListener('click', () => this.goBack());
        this.elements.forwardBtn.addEventListener('click', () => this.goForward());
        this.elements.refreshBtn.addEventListener('click', () => this.refresh());

        // AI controls
        this.elements.aiToggleBtn.addEventListener('click', () => this.toggleAI());
        this.elements.memoryBtn.addEventListener('click', () => this.openMemoryTimeline());
        this.elements.captureBtn.addEventListener('click', () => this.manualCapture());

        // Memory search
        this.elements.searchMemoryBtn.addEventListener('click', () => this.searchMemory());
        this.elements.memorySearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchMemory();
        });

        // Memory modal
        this.elements.closeMemoryBtn.addEventListener('click', () => this.closeMemoryModal());
        this.elements.memoryModal.addEventListener('click', (e) => {
            if (e.target === this.elements.memoryModal) this.closeMemoryModal();
        });

        // PDF handling
        this.setupPDFHandlers();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    setupIPC() {
        // Listen for URL changes from main process
        ipcRenderer.on('url-changed', (event, url) => {
            this.currentUrl = url;
            this.elements.addressBar.value = url;
        });

        // Listen for page load events
        ipcRenderer.on('page-loaded', () => {
            this.showToast('Page loaded', 'success');
        });

        // Listen for new screenshots
        ipcRenderer.on('new-screenshot', (event, memoryEntry) => {
            this.handleNewScreenshot(memoryEntry);
        });
    }

    async navigateToUrl() {
        const url = this.elements.addressBar.value.trim();
        if (!url) return;

        try {
            const result = await ipcRenderer.invoke('navigate-to', url);
            if (result.success) {
                this.currentUrl = result.url;
                this.elements.addressBar.value = result.url;
                this.showToast('Navigating...', 'info');
            } else {
                this.showToast('Navigation failed', 'error');
            }
        } catch (error) {
            this.showToast('Navigation error', 'error');
        }
    }

    async goBack() {
        const canGoBack = await ipcRenderer.invoke('browser-back');
        if (!canGoBack) {
            this.showToast('Cannot go back', 'info');
        }
    }

    async goForward() {
        const canGoForward = await ipcRenderer.invoke('browser-forward');
        if (!canGoForward) {
            this.showToast('Cannot go forward', 'info');
        }
    }

    async refresh() {
        await ipcRenderer.invoke('browser-refresh');
        this.showToast('Refreshing...', 'info');
    }

    async manualCapture() {
        try {
            const screenshot = await ipcRenderer.invoke('capture-screenshot');
            if (screenshot) {
                this.showToast('Screenshot captured', 'success');
            } else {
                this.showToast('Capture failed', 'error');
            }
        } catch (error) {
            this.showToast('Capture error', 'error');
        }
    }

    async toggleAI() {
        this.isAIActive = !this.isAIActive;
        await ipcRenderer.invoke('toggle-ai', this.isAIActive);
        
        this.updateAIStatus(
            this.isAIActive ? 'AI Active' : 'AI Inactive',
            this.isAIActive
        );
        
        this.showToast(
            this.isAIActive ? 'Algorithm Mirror enabled' : 'Algorithm Mirror disabled',
            this.isAIActive ? 'success' : 'info'
        );
    }

    async handleNewScreenshot(memoryEntry) {
        // Add to local memory
        this.memoryData.set(memoryEntry.id, memoryEntry);
        this.timelineData.push(memoryEntry);
        this.timelineData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Analyze with VLM if available
        if (this.isAIActive) {
            await this.analyzeScreenshot(memoryEntry);
        }

        // Update UI
        this.addAnalysisToFeed(memoryEntry);
    }

    async analyzeScreenshot(memoryEntry) {
        try {
            const analysis = await this.analyzeWithVLM(memoryEntry.screenshot);
            
            // Update memory entry with analysis
            memoryEntry.analysis = analysis;
            memoryEntry.type = 'vlm_analysis';
            
            // Categorize content
            this.categorizeEntry(memoryEntry);
            
            // Generate embeddings
            await this.generateEmbeddings(memoryEntry);
            
            // Save updated entry
            await ipcRenderer.invoke('save-memory-entry', memoryEntry);
            
        } catch (error) {
            console.error('VLM analysis failed:', error);
            memoryEntry.analysis = 'Analysis failed';
        }
    }

    async analyzeWithVLM(screenshot) {
        try {
            const prompt = `Describe what content is visible on this screenshot:
1. What specific content is being shown to users
2. Any feeds, posts, articles, or content streams visible
3. Advertisements, sponsored content, or promotional material
4. Recommended or suggested items/content
5. Any personalized or algorithmically-curated content
6. The type of information being served to users

Focus on describing what content users are being served and shown.`;

            const response = await fetch(this.vlmEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.selectedModel,
                    prompt: prompt,
                    images: [screenshot.split(',')[1]], // Remove data URL prefix
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error(`VLM API error: ${response.status}`);
            }

            const data = await response.json();
            return data.response || 'Analysis failed';

        } catch (error) {
            console.error('VLM analysis error:', error);
            return `Analysis unavailable: ${error.message}`;
        }
    }

    async generateEmbeddings(memoryEntry) {
        try {
            const textForEmbedding = `
                URL: ${memoryEntry.url}
                Analysis: ${memoryEntry.analysis}
                Timestamp: ${memoryEntry.timestamp}
                Type: ${memoryEntry.type}
            `;

            const response = await fetch('http://localhost:11434/api/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'nomic-embed-text',
                    prompt: textForEmbedding
                })
            });

            if (response.ok) {
                const data = await response.json();
                memoryEntry.embedding = data.embedding;
            }
        } catch (error) {
            console.error('Embedding generation failed:', error);
        }
    }

    categorizeEntry(entry) {
        const url = entry.url.toLowerCase();
        const analysis = (entry.analysis || '').toLowerCase();
        
        let category = 'general';
        
        if (url.includes('github') || analysis.includes('code')) {
            category = 'development';
        } else if (url.includes('youtube') || url.includes('video') || analysis.includes('video')) {
            category = 'media';
        } else if (analysis.includes('document') || analysis.includes('text')) {
            category = 'documents';
        } else if (url.includes('social') || url.includes('twitter') || url.includes('linkedin')) {
            category = 'social';
        } else if (url.includes('news') || analysis.includes('article')) {
            category = 'news';
        }
        
        entry.category = category;
        this.categories.add(category);
    }

    addAnalysisToFeed(entry) {
        const analysisItem = document.createElement('div');
        analysisItem.className = 'analysis-item';
        analysisItem.dataset.entryId = entry.id;
        
        const timeAgo = this.formatTimeAgo(new Date(entry.timestamp));
        
        analysisItem.innerHTML = `
            <div class="timestamp">${timeAgo}</div>
            <div class="analysis-content">
                <p><strong>📸 Screenshot Captured</strong></p>
                <p><small>📍 ${entry.url}</small></p>
                <img src="${entry.screenshot}" class="screenshot-preview" alt="Screenshot">
                ${entry.analysis ? `<p>${entry.analysis}</p>` : '<p>Analysis in progress...</p>'}
                ${entry.category ? `<div class="category-tag">${entry.category}</div>` : ''}
            </div>
        `;
        
        // Add to feed (prepend to show latest first)
        this.elements.analysisFeed.insertBefore(analysisItem, this.elements.analysisFeed.firstChild);
        
        // Remove old items if too many
        const items = this.elements.analysisFeed.querySelectorAll('.analysis-item');
        if (items.length > 50) {
            items[items.length - 1].remove();
        }
        
        // Scroll to top
        this.elements.analysisFeed.scrollTop = 0;
    }

    formatTimeAgo(timestamp) {
        const now = new Date();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }

    async initAI() {
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            if (response.ok) {
                const data = await response.json();
                const vlmModels = data.models.filter(model => 
                    model.name.includes('llava') || 
                    model.name.includes('vision') ||
                    model.name.includes('bakllava')
                );
                
                if (vlmModels.length > 0) {
                    this.selectedModel = vlmModels[0].name;
                    this.updateAIStatus('AI Connected', true);
                } else {
                    this.updateAIStatus('No VLM available', false);
                }
            } else {
                this.updateAIStatus('AI Offline', false);
            }
        } catch (error) {
            console.error('AI initialization failed:', error);
            this.updateAIStatus('AI Error', false);
        }
    }

    updateAIStatus(text, isActive) {
        const statusText = this.elements.aiStatus.querySelector('.status-text');
        const pulse = this.elements.aiStatus.querySelector('.pulse');
        
        statusText.textContent = text;
        pulse.style.backgroundColor = isActive ? 'var(--accent-green)' : 'var(--accent-red)';
        
        if (isActive) {
            this.elements.aiToggleBtn.classList.add('active');
        } else {
            this.elements.aiToggleBtn.classList.remove('active');
        }
    }

    async loadMemoryData() {
        try {
            const memoryEntries = await ipcRenderer.invoke('get-memory-data');
            memoryEntries.forEach(([id, entry]) => {
                this.memoryData.set(id, entry);
                this.timelineData.push(entry);
            });
            
            this.timelineData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Load recent entries in feed
            this.timelineData.slice(0, 10).forEach(entry => {
                this.addAnalysisToFeed(entry);
            });
        } catch (error) {
            console.error('Failed to load memory data:', error);
        }
    }

    // Memory and search methods (same as before)
    async searchMemory() {
        const query = this.elements.memorySearch.value.trim();
        if (!query) return;
        
        // Simple text search for now
        const results = this.timelineData.filter(entry => 
            entry.url.toLowerCase().includes(query.toLowerCase()) ||
            (entry.analysis && entry.analysis.toLowerCase().includes(query.toLowerCase()))
        );
        
        this.displaySearchResults(results, query);
    }

    displaySearchResults(results, query) {
        this.elements.analysisFeed.innerHTML = `
            <div class="analysis-item welcome">
                <div class="timestamp">Search Results</div>
                <div class="analysis-content">
                    <p><strong>🔍 Search: "${query}"</strong></p>
                    <p>Found ${results.length} relevant memories</p>
                </div>
            </div>
        `;
        
        results.forEach(entry => {
            this.addAnalysisToFeed(entry);
        });
        
        if (results.length === 0) {
            this.showToast('No results found', 'info');
        }
    }

    openMemoryTimeline() {
        this.elements.memoryModal.classList.add('active');
        this.renderTimeline();
    }

    closeMemoryModal() {
        this.elements.memoryModal.classList.remove('active');
    }

    renderTimeline() {
        const container = this.elements.timelineContainer;
        container.innerHTML = '';
        
        // Group by date
        const groupedData = this.groupByDate(this.timelineData);
        
        for (const [date, entries] of groupedData) {
            const dateSection = document.createElement('div');
            dateSection.className = 'timeline-date-section';
            dateSection.innerHTML = `
                <h3 class="timeline-date">${date}</h3>
                <div class="timeline-entries"></div>
            `;
            
            const entriesContainer = dateSection.querySelector('.timeline-entries');
            
            entries.forEach(entry => {
                const entryEl = document.createElement('div');
                entryEl.className = 'timeline-entry';
                entryEl.innerHTML = `
                    <div class="timeline-time">${new Date(entry.timestamp).toLocaleTimeString()}</div>
                    <div class="timeline-content">
                        <img src="${entry.screenshot}" class="timeline-screenshot" alt="Screenshot">
                        <div class="timeline-details">
                            <div class="timeline-url">${entry.url}</div>
                            <div class="timeline-analysis">${(entry.analysis || 'No analysis').substring(0, 200)}...</div>
                            <div class="timeline-category">${entry.category || 'general'}</div>
                        </div>
                    </div>
                `;
                
                entriesContainer.appendChild(entryEl);
            });
            
            container.appendChild(dateSection);
        }
    }

    groupByDate(data) {
        const grouped = new Map();
        
        data.forEach(entry => {
            const date = new Date(entry.timestamp).toDateString();
            if (!grouped.has(date)) {
                grouped.set(date, []);
            }
            grouped.get(date).push(entry);
        });
        
        return grouped;
    }

    setupPDFHandlers() {
        this.elements.pdfDropZone.addEventListener('click', async () => {
            const filePath = await ipcRenderer.invoke('open-pdf-dialog');
            if (filePath) {
                this.showToast('PDF support coming soon', 'info');
            }
        });
    }

    handleKeyboardShortcuts(e) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
            e.preventDefault();
            this.elements.addressBar.focus();
            this.elements.addressBar.select();
        }
        
        if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
            e.preventDefault();
            this.refresh();
        }
        
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            this.manualCapture();
        }
        
        if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
            e.preventDefault();
            this.openMemoryTimeline();
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.elements.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.algorithmMirrorRenderer = new AlgorithmMirrorElectronRenderer();
});

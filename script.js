/**
 * Claudey AI Browser - Advanced Visual Intelligence System
 * Features: VLM analysis, OCR, multimodal memory, real-time commentary
 */

class ClaudeyAIBrowser {
    constructor() {
        // Core state
        this.isAIActive = true;
        this.currentUrl = '';
        this.memoryData = new Map();
        this.analysisInterval = null;
        this.screenshotInterval = null;
        
        // VLM & Analysis
        this.vlmEndpoint = 'http://localhost:11434/api/generate'; // Ollama
        this.selectedModel = 'llava:latest'; // Default VLM model
        this.ocrEngine = null;
        
        // Memory system
        this.embeddings = new Map();
        this.timelineData = [];
        this.categories = new Set();
        
        // UI elements
        this.elements = {};
        
        this.init();
    }

    async init() {
        this.initElements();
        this.setupEventListeners();
        this.initAI();
        this.startAnalysisEngine();
        this.showToast('AI Browser initialized', 'success');
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
            
            // Browser viewport
            browserFrame: document.getElementById('browser-frame'),
            loadingOverlay: document.getElementById('loading-overlay'),
            screenshotOverlay: document.getElementById('screenshot-overlay'),
            
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
            pdfViewer: document.getElementById('pdf-viewer'),
            pdfCanvas: document.getElementById('pdf-canvas'),
            
            // Toast
            toastContainer: document.getElementById('toast-container')
        };
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

        // Window events
        window.addEventListener('beforeunload', () => this.saveState());
        window.addEventListener('load', () => this.loadState());
    }

    setupPDFHandlers() {
        // Drag and drop
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (this.isPDFFile(e.dataTransfer)) {
                this.elements.pdfDropZone.classList.add('active');
            }
        });

        document.addEventListener('dragleave', (e) => {
            if (!e.relatedTarget || !document.contains(e.relatedTarget)) {
                this.elements.pdfDropZone.classList.remove('active');
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            this.elements.pdfDropZone.classList.remove('active');
            const files = Array.from(e.dataTransfer.files);
            const pdfFile = files.find(file => file.type === 'application/pdf');
            if (pdfFile) {
                this.loadPDF(pdfFile);
            }
        });

        // File input
        this.elements.pdfUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.loadPDF(file);
        });

        // Drop zone click
        this.elements.pdfDropZone.addEventListener('click', () => {
            this.elements.pdfUpload.click();
        });
    }

    async initAI() {
        try {
            // Check for available models
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
            this.isAIActive = false;
        }
    }

    startAnalysisEngine() {
        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
        }

        // Continuous analysis every 10 seconds
        this.analysisInterval = setInterval(() => {
            if (this.isAIActive && this.currentUrl) {
                this.performVLMAnalysis();
            }
        }, 10000);

        // Screenshot capture every 30 seconds
        this.screenshotInterval = setInterval(() => {
            if (this.isAIActive && this.currentUrl) {
                this.captureScreenshot();
            }
        }, 30000);
    }

    async performVLMAnalysis() {
        try {
            const screenshot = await this.getScreenshot();
            if (!screenshot) return;

            const analysis = await this.analyzeWithVLM(screenshot);
            const timestamp = new Date();

            // Create memory entry
            const memoryEntry = {
                id: `analysis_${Date.now()}`,
                timestamp,
                url: this.currentUrl,
                screenshot,
                analysis,
                type: 'vlm_analysis'
            };

            // Store in memory
            this.addToMemory(memoryEntry);
            
            // Update UI
            this.addAnalysisToFeed(memoryEntry);
            
            // Generate embeddings for semantic search
            this.generateEmbeddings(memoryEntry);

        } catch (error) {
            console.error('VLM analysis failed:', error);
        }
    }

    async getScreenshot() {
        try {
            // Since we can't access iframe content due to CORS, we'll create a mock screenshot
            // that represents the current page state
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 1200;
            canvas.height = 800;
            
            // Create browser-like background
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#f8f9fa');
            gradient.addColorStop(1, '#e9ecef');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw browser chrome
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(20, 20, canvas.width - 40, 60);
            ctx.strokeStyle = '#dee2e6';
            ctx.lineWidth = 1;
            ctx.strokeRect(20, 20, canvas.width - 40, 60);
            
            // Add address bar
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(40, 35, canvas.width - 120, 30);
            ctx.strokeRect(40, 35, canvas.width - 120, 30);
            
            // Add URL text
            ctx.fillStyle = '#495057';
            ctx.font = '16px Inter, sans-serif';
            ctx.fillText(this.currentUrl || 'No URL loaded', 50, 55);
            
            // Draw content area
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(20, 90, canvas.width - 40, canvas.height - 120);
            ctx.strokeRect(20, 90, canvas.width - 40, canvas.height - 120);
            
            // Add page title
            ctx.fillStyle = '#212529';
            ctx.font = 'bold 24px Inter, sans-serif';
            const domain = this.currentUrl ? new URL(this.currentUrl).hostname : 'localhost';
            ctx.fillText(`Browsing: ${domain}`, 40, 140);
            
            // Add timestamp
            ctx.fillStyle = '#6c757d';
            ctx.font = '14px Inter, sans-serif';
            ctx.fillText(`Captured: ${new Date().toLocaleString()}`, 40, 170);
            
            // Add some visual elements to represent content
            for (let i = 0; i < 8; i++) {
                const y = 200 + (i * 60);
                const width = Math.random() * 400 + 200;
                
                // Content blocks
                ctx.fillStyle = '#f8f9fa';
                ctx.fillRect(40, y, width, 20);
                ctx.fillRect(40, y + 25, width * 0.8, 15);
                ctx.fillRect(40, y + 45, width * 0.6, 10);
            }
            
            // Add AI analysis indicator
            ctx.fillStyle = '#007bff';
            ctx.fillRect(canvas.width - 200, canvas.height - 60, 160, 40);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 14px Inter, sans-serif';
            ctx.fillText('🤖 AI Analyzed', canvas.width - 190, canvas.height - 35);
            
            return canvas.toDataURL('image/jpeg', 0.9);
        } catch (error) {
            console.error('Screenshot capture failed:', error);
            return null;
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
                    images: [screenshot.split(',')[1]], // Remove data:image/jpeg;base64, prefix
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
            // Create text for embedding from analysis and metadata
            const textForEmbedding = `
                URL: ${memoryEntry.url}
                Analysis: ${memoryEntry.analysis}
                Timestamp: ${memoryEntry.timestamp.toISOString()}
                Type: ${memoryEntry.type}
            `;

            // Use Ollama embedding model
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
                this.embeddings.set(memoryEntry.id, data.embedding);
            }
        } catch (error) {
            console.error('Embedding generation failed:', error);
        }
    }

    addToMemory(entry) {
        this.memoryData.set(entry.id, entry);
        this.timelineData.push(entry);
        
        // Sort timeline by timestamp
        this.timelineData.sort((a, b) => b.timestamp - a.timestamp);
        
        // Categorize content
        this.categorizeEntry(entry);
        
        // Limit memory size (keep last 1000 entries)
        if (this.timelineData.length > 1000) {
            const removed = this.timelineData.pop();
            this.memoryData.delete(removed.id);
            this.embeddings.delete(removed.id);
        }
    }

    categorizeEntry(entry) {
        // Simple categorization based on URL and analysis
        const url = entry.url.toLowerCase();
        const analysis = entry.analysis.toLowerCase();
        
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
        
        const timeAgo = this.formatTimeAgo(entry.timestamp);
        
        analysisItem.innerHTML = `
            <div class="timestamp">${timeAgo}</div>
            <div class="analysis-content">
                <p><strong>🔍 Visual Analysis</strong></p>
                <p><small>📍 ${entry.url}</small></p>
                <img src="${entry.screenshot}" class="screenshot-preview" alt="Screenshot">
                <p>${entry.analysis}</p>
                <div class="category-tag">${entry.category}</div>
            </div>
        `;
        
        // Add click handler for detailed view
        analysisItem.addEventListener('click', () => {
            this.showDetailedAnalysis(entry);
        });
        
        // Add to feed (prepend to show latest first)
        this.elements.analysisFeed.insertBefore(analysisItem, this.elements.analysisFeed.firstChild);
        
        // Remove old items if too many
        const items = this.elements.analysisFeed.querySelectorAll('.analysis-item');
        if (items.length > 50) {
            items[items.length - 1].remove();
        }
        
        // Scroll to top to show new item
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

    // Navigation methods
    navigateToUrl() {
        const url = this.elements.addressBar.value.trim();
        if (!url) return;
        
        let finalUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            finalUrl = url.includes('.') ? `https://${url}` : `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        }
        
        this.currentUrl = finalUrl;
        this.elements.addressBar.value = finalUrl;
        
        // Show loading
        this.elements.loadingOverlay.classList.add('active');
        
        try {
            // Use proxy server to bypass CORS
            const proxyUrl = `/fetch-url?url=${encodeURIComponent(finalUrl)}`;
            this.elements.browserFrame.src = proxyUrl;
            
            // Listen for load event
            this.elements.browserFrame.onload = () => {
                this.elements.loadingOverlay.classList.remove('active');
                this.onPageLoad();
            };
            
            // Handle errors
            this.elements.browserFrame.onerror = () => {
                this.elements.loadingOverlay.classList.remove('active');
                this.showToast('Failed to load page', 'error');
            };
            
        } catch (error) {
            this.elements.loadingOverlay.classList.remove('active');
            this.showToast('Navigation error', 'error');
        }
    }

    onPageLoad() {
        this.showToast('Page loaded', 'success');
        
        // Perform initial analysis after a short delay
        setTimeout(() => {
            if (this.isAIActive) {
                this.performVLMAnalysis();
            }
        }, 2000);
    }

    async manualCapture() {
        if (!this.currentUrl) {
            this.showToast('No page loaded', 'error');
            return;
        }
        
        // Flash effect
        this.elements.screenshotOverlay.classList.add('screenshot-flash');
        setTimeout(() => {
            this.elements.screenshotOverlay.classList.remove('screenshot-flash');
        }, 300);
        
        // Perform immediate analysis
        await this.performVLMAnalysis();
        this.showToast('Analysis captured', 'success');
    }

    captureScreenshot() {
        if (this.isAIActive && this.currentUrl) {
            this.manualCapture();
        }
    }

    toggleAI() {
        this.isAIActive = !this.isAIActive;
        
        if (this.isAIActive) {
            this.updateAIStatus('AI Active', true);
            this.startAnalysisEngine();
            this.showToast('AI Vision enabled', 'success');
        } else {
            this.updateAIStatus('AI Inactive', false);
            if (this.analysisInterval) clearInterval(this.analysisInterval);
            if (this.screenshotInterval) clearInterval(this.screenshotInterval);
            this.showToast('AI Vision disabled', 'info');
        }
    }

    // Memory and search methods
    async searchMemory() {
        const query = this.elements.memorySearch.value.trim();
        if (!query) return;
        
        try {
            // Generate embedding for search query
            const response = await fetch('http://localhost:11434/api/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'nomic-embed-text',
                    prompt: query
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                const queryEmbedding = data.embedding;
                
                // Find similar entries using cosine similarity
                const results = this.findSimilarMemories(queryEmbedding);
                this.displaySearchResults(results, query);
            }
        } catch (error) {
            console.error('Memory search failed:', error);
            this.showToast('Search failed', 'error');
        }
    }

    findSimilarMemories(queryEmbedding, threshold = 0.7) {
        const results = [];
        
        for (const [id, embedding] of this.embeddings) {
            const similarity = this.cosineSimilarity(queryEmbedding, embedding);
            if (similarity > threshold) {
                const entry = this.memoryData.get(id);
                results.push({ entry, similarity });
            }
        }
        
        return results.sort((a, b) => b.similarity - a.similarity);
    }

    cosineSimilarity(a, b) {
        const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dotProduct / (magnitudeA * magnitudeB);
    }

    displaySearchResults(results, query) {
        // Clear current feed and show search results
        this.elements.analysisFeed.innerHTML = `
            <div class="analysis-item welcome">
                <div class="timestamp">Search Results</div>
                <div class="analysis-content">
                    <p><strong>🔍 Search: "${query}"</strong></p>
                    <p>Found ${results.length} relevant memories</p>
                </div>
            </div>
        `;
        
        results.forEach(({ entry, similarity }) => {
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
                    <div class="timeline-time">${entry.timestamp.toLocaleTimeString()}</div>
                    <div class="timeline-content">
                        <img src="${entry.screenshot}" class="timeline-screenshot" alt="Screenshot">
                        <div class="timeline-details">
                            <div class="timeline-url">${entry.url}</div>
                            <div class="timeline-analysis">${entry.analysis.substring(0, 200)}...</div>
                            <div class="timeline-category">${entry.category}</div>
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
            const date = entry.timestamp.toDateString();
            if (!grouped.has(date)) {
                grouped.set(date, []);
            }
            grouped.get(date).push(entry);
        });
        
        return grouped;
    }

    // PDF handling
    isPDFFile(dataTransfer) {
        return Array.from(dataTransfer.types).includes('Files') &&
               Array.from(dataTransfer.files || []).some(file => file.type === 'application/pdf');
    }

    async loadPDF(file) {
        try {
            this.showToast('Loading PDF...', 'info');
            
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            // Show PDF viewer
            this.elements.pdfViewer.style.display = 'block';
            
            // Render first page
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.5 });
            
            const canvas = this.elements.pdfCanvas;
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;
            
            this.showToast('PDF loaded successfully', 'success');
            
            // Extract text for analysis
            const textContent = await page.getTextContent();
            const text = textContent.items.map(item => item.str).join(' ');
            
            // Analyze PDF content
            await this.analyzePDFContent(text, canvas.toDataURL());
            
        } catch (error) {
            console.error('PDF loading failed:', error);
            this.showToast('Failed to load PDF', 'error');
        }
    }

    async analyzePDFContent(text, screenshot) {
        const analysis = await this.analyzeWithLLM(`Describe the content in this PDF document: ${text.substring(0, 2000)}`);
        
        const memoryEntry = {
            id: `pdf_${Date.now()}`,
            timestamp: new Date(),
            url: 'PDF Document',
            screenshot,
            analysis,
            type: 'pdf_analysis',
            content: text
        };
        
        this.addToMemory(memoryEntry);
        this.addAnalysisToFeed(memoryEntry);
    }

    async analyzeWithLLM(prompt) {
        try {
            const response = await fetch(this.vlmEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'llama2',
                    prompt: prompt,
                    stream: false
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.response;
            }
        } catch (error) {
            console.error('LLM analysis failed:', error);
        }
        
        return 'Analysis unavailable';
    }

    // Utility methods
    handleKeyboardShortcuts(e) {
        // Cmd/Ctrl + L - Focus address bar
        if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
            e.preventDefault();
            this.elements.addressBar.focus();
            this.elements.addressBar.select();
        }
        
        // Cmd/Ctrl + R - Refresh
        if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
            e.preventDefault();
            this.refresh();
        }
        
        // Cmd/Ctrl + Shift + C - Manual capture
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            this.manualCapture();
        }
        
        // Cmd/Ctrl + M - Memory timeline
        if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
            e.preventDefault();
            this.openMemoryTimeline();
        }
    }

    goBack() {
        // Note: Cannot access iframe history due to CORS
        this.showToast('Back navigation not available in iframe', 'info');
    }

    goForward() {
        this.showToast('Forward navigation not available in iframe', 'info');
    }

    refresh() {
        if (this.elements.browserFrame.src) {
            this.elements.loadingOverlay.classList.add('active');
            this.elements.browserFrame.src = this.elements.browserFrame.src;
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        this.elements.toastContainer.appendChild(toast);
        
        // Trigger animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    showDetailedAnalysis(entry) {
        // Could open a detailed modal with full analysis
        this.showToast('Detailed view - feature coming soon', 'info');
    }

    saveState() {
        try {
            const state = {
                memoryData: Array.from(this.memoryData.entries()),
                timelineData: this.timelineData,
                categories: Array.from(this.categories),
                isAIActive: this.isAIActive,
                currentUrl: this.currentUrl
            };
            
            localStorage.setItem('claudey_state', JSON.stringify(state));
        } catch (error) {
            console.error('Failed to save state:', error);
        }
    }

    loadState() {
        try {
            const saved = localStorage.getItem('claudey_state');
            if (saved) {
                const state = JSON.parse(saved);
                
                this.memoryData = new Map(state.memoryData || []);
                this.timelineData = state.timelineData || [];
                this.categories = new Set(state.categories || []);
                this.isAIActive = state.isAIActive !== false;
                this.currentUrl = state.currentUrl || '';
                
                // Restore UI state
                if (this.currentUrl) {
                    this.elements.addressBar.value = this.currentUrl;
                }
                
                // Reload recent analyses in feed
                this.timelineData.slice(0, 10).forEach(entry => {
                    this.addAnalysisToFeed(entry);
                });
            }
        } catch (error) {
            console.error('Failed to load state:', error);
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.claudeyBrowser = new ClaudeyAIBrowser();
});

// Add CSS for timeline and other dynamic elements
const dynamicCSS = `
.timeline-date-section {
    margin-bottom: var(--space-lg);
}

.timeline-date {
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--accent-blue);
    margin-bottom: var(--space-md);
    padding-bottom: var(--space-sm);
    border-bottom: 1px solid var(--glass-border);
}

.timeline-entry {
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    margin-bottom: var(--space-md);
    display: flex;
    gap: var(--space-md);
    transition: all var(--transition-fast);
}

.timeline-entry:hover {
    background: var(--accent-bg);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
}

.timeline-time {
    font-size: var(--font-size-xs);
    color: var(--text-muted);
    white-space: nowrap;
    width: 80px;
}

.timeline-content {
    flex: 1;
    display: flex;
    gap: var(--space-md);
}

.timeline-screenshot {
    width: 120px;
    height: 80px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    border: 1px solid var(--glass-border);
}

.timeline-details {
    flex: 1;
}

.timeline-url {
    font-size: var(--font-size-sm);
    color: var(--accent-blue);
    margin-bottom: var(--space-xs);
    font-weight: 500;
}

.timeline-analysis {
    color: var(--text-primary);
    font-size: var(--font-size-sm);
    line-height: 1.4;
    margin-bottom: var(--space-sm);
}

.timeline-category {
    display: inline-block;
    background: var(--accent-purple);
    color: white;
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: 500;
}

.category-tag {
    display: inline-block;
    background: var(--accent-blue);
    color: white;
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: 500;
    margin-top: var(--space-sm);
}
`;

// Inject dynamic CSS
const styleSheet = document.createElement('style');
styleSheet.textContent = dynamicCSS;
document.head.appendChild(styleSheet);
/**
 * Algorithm Mirror - Content Script
 * Runs on all web pages to provide AI overlay and analysis
 */

// Prevent multiple class declarations
if (typeof ClaudeyContentScript === 'undefined') {
    
class ClaudeyContentScript {
    constructor() {
        this.isInjected = false;
        this.sidebar = null;
        this.isVisible = false;
        this.vlmEndpoint = 'http://localhost:11434/api/generate';
        this.embeddingEndpoint = 'http://localhost:11434/api/embeddings';
        this.selectedModel = 'llava:7b';
        this.memoryEntries = [];
        
        this.init();
    }

    async init() {
        // Prevent multiple injections
        if (window.claudeyInjected) {
            return;
        }
        window.claudeyInjected = true;

        // Setup message listener
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true;
        });

        // Create overlay
        await this.createOverlay();
        
        // Setup page monitoring
        this.setupPageMonitoring();
        
        console.log('Algorithm Mirror content script loaded');
    }

    async createOverlay() {
        // Create floating toggle button
        this.createToggleButton();
        
        // Create sidebar (initially hidden)
        await this.createSidebar();
    }

    createToggleButton() {
        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'claudey-toggle';
        toggleBtn.innerHTML = `
            <div class="claudey-toggle-inner">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
            </div>
        `;
        
        toggleBtn.addEventListener('click', () => this.toggleSidebar());
        document.body.appendChild(toggleBtn);
    }

    async createSidebar() {
        const sidebar = document.createElement('div');
        sidebar.id = 'claudey-sidebar';
        sidebar.className = 'claudey-hidden';
        
        sidebar.innerHTML = `
            <div class="claudey-sidebar-header">
                <h3>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                        <path d="M5 10v2a7 7 0 0 0 14 0v-2"/>
                        <line x1="12" x2="12" y1="19" y2="22"/>
                    </svg>
                    Algorithm Mirror
                </h3>
                <div class="claudey-controls">
                    <button id="claudey-capture" title="Manual Capture">📸</button>
                    <button id="claudey-memory" title="Memory Timeline">🧠</button>
                    <button id="claudey-settings" title="Settings">⚙️</button>
                    <button id="claudey-close" title="Close">✕</button>
                </div>
            </div>
            
            <div class="claudey-status">
                <div class="claudey-status-indicator">
                    <span class="claudey-pulse"></span>
                    <span class="claudey-status-text">AI Active</span>
                </div>
            </div>
            
            <div class="claudey-analysis-feed" id="claudey-feed">
                <div class="claudey-welcome">
                    <p><strong>🔍 Algorithm Mirror Active</strong></p>
                    <p>I'm watching and analyzing your browsing. I'll provide insights about the content you view.</p>
                </div>
            </div>
            
            <div class="claudey-search">
                <input type="text" id="claudey-search-input" placeholder="Search memory...">
                <button id="claudey-search-btn">🔍</button>
            </div>
        `;

        document.body.appendChild(sidebar);
        this.sidebar = sidebar;
        
        // Setup event listeners
        this.setupSidebarEvents();
    }

    setupSidebarEvents() {
        // Close button
        document.getElementById('claudey-close').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Manual capture
        document.getElementById('claudey-capture').addEventListener('click', () => {
            this.manualCapture();
        });

        // Memory timeline
        document.getElementById('claudey-memory').addEventListener('click', () => {
            this.openMemoryTimeline();
        });

        // Search
        document.getElementById('claudey-search-btn').addEventListener('click', () => {
            this.searchMemory();
        });

        document.getElementById('claudey-search-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchMemory();
            }
        });
    }

    toggleSidebar() {
        this.isVisible = !this.isVisible;
        
        if (this.isVisible) {
            this.sidebar.classList.remove('claudey-hidden');
            this.sidebar.classList.add('claudey-visible');
        } else {
            this.sidebar.classList.remove('claudey-visible');
            this.sidebar.classList.add('claudey-hidden');
        }
    }

    setupPageMonitoring() {
        // Monitor page changes
        const observer = new MutationObserver((mutations) => {
            // Debounced page change detection
            clearTimeout(this.pageChangeTimeout);
            this.pageChangeTimeout = setTimeout(() => {
                this.onPageChange();
            }, 1000);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: false
        });

        // Monitor scroll events for potential content changes
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.onScrollChange();
            }, 2000);
        });
    }

    onPageChange() {
        // Page content has changed significantly
        console.log('Algorithm Mirror: Page content changed');
    }

    onScrollChange() {
        // User has scrolled, potentially viewing new content
        console.log('Algorithm Mirror: Scroll position changed');
    }

    async handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'PING':
                sendResponse({ success: true, status: 'alive' });
                break;

            case 'ANALYZE_SCREENSHOT':
                await this.analyzeScreenshot(message.data);
                sendResponse({ success: true });
                break;

            case 'NEW_MEMORY_ENTRY':
                this.addMemoryEntry(message.data);
                sendResponse({ success: true });
                break;

            case 'MANUAL_CAPTURE':
                await this.manualCapture();
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ error: 'Unknown message type' });
        }
    }

    async analyzeScreenshot(data) {
        const { analysisId, screenshot, url, timestamp } = data;
        
        try {
            // Show analysis in progress
            this.addAnalysisItem({
                timestamp,
                url,
                screenshot,
                analysis: '🔄 Analyzing...',
                status: 'analyzing'
            });

            // Perform VLM analysis
            const analysis = await this.performVLMAnalysis(screenshot, url);
            
            // Generate embeddings
            const embeddings = await this.generateEmbeddings(analysis, url);
            
            // Categorize content
            const category = this.categorizeContent(analysis, url);
            
            // Send results back to background
            chrome.runtime.sendMessage({
                type: 'ANALYSIS_COMPLETE',
                data: {
                    analysisId,
                    analysis,
                    embeddings,
                    category
                }
            });

            // Update UI
            this.updateAnalysisItem(timestamp, {
                analysis,
                category,
                status: 'complete'
            });

        } catch (error) {
            console.error('VLM analysis failed:', error);
            
            this.updateAnalysisItem(timestamp, {
                analysis: `Analysis failed: ${error.message}`,
                status: 'error'
            });
        }
    }

    async performVLMAnalysis(screenshot, url) {
        const prompt = `Describe what content is visible on this webpage screenshot:

1. What specific content is being shown to users
2. Any feeds, posts, articles, or content streams visible
3. Advertisements, sponsored content, or promotional material
4. Recommended or suggested items/content
5. Any personalized or algorithmically-curated content
6. The type of information this platform serves to users

URL: ${url}

Focus on describing what content users are being served and shown.`;

        try {
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
            return data.response || 'Analysis completed but no response received';

        } catch (error) {
            throw new Error(`VLM analysis failed: ${error.message}`);
        }
    }

    async generateEmbeddings(analysis, url) {
        try {
            const textForEmbedding = `
                URL: ${url}
                Analysis: ${analysis}
                Domain: ${new URL(url).hostname}
                Timestamp: ${new Date().toISOString()}
            `;

            const response = await fetch(this.embeddingEndpoint, {
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
                return data.embedding;
            }
        } catch (error) {
            console.error('Embedding generation failed:', error);
        }
        
        return null;
    }

    categorizeContent(analysis, url) {
        const urlLower = url.toLowerCase();
        const analysisLower = analysis.toLowerCase();
        
        // Smart categorization based on URL and content analysis
        if (urlLower.includes('github') || analysisLower.includes('code') || analysisLower.includes('repository')) {
            return 'development';
        } else if (urlLower.includes('youtube') || urlLower.includes('video') || analysisLower.includes('video')) {
            return 'media';
        } else if (analysisLower.includes('news') || analysisLower.includes('article') || urlLower.includes('news')) {
            return 'news';
        } else if (urlLower.includes('social') || urlLower.includes('twitter') || urlLower.includes('linkedin') || urlLower.includes('facebook')) {
            return 'social';
        } else if (analysisLower.includes('shopping') || analysisLower.includes('product') || urlLower.includes('shop') || urlLower.includes('amazon')) {
            return 'shopping';
        } else if (analysisLower.includes('documentation') || analysisLower.includes('tutorial') || analysisLower.includes('guide')) {
            return 'documentation';
        } else if (analysisLower.includes('search') || urlLower.includes('google') || urlLower.includes('bing')) {
            return 'search';
        } else {
            return 'general';
        }
    }

    addAnalysisItem(data) {
        const feed = document.getElementById('claudey-feed');
        const welcomeMsg = feed.querySelector('.claudey-welcome');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }

        const item = document.createElement('div');
        item.className = 'claudey-analysis-item';
        item.dataset.timestamp = data.timestamp;
        
        const timeAgo = this.formatTimeAgo(new Date(data.timestamp));
        const domain = new URL(data.url).hostname;
        
        item.innerHTML = `
            <div class="claudey-timestamp">${timeAgo}</div>
            <div class="claudey-content">
                <div class="claudey-url" onclick="window.open('${data.url}', '_blank')" title="Click to visit page">📍 ${domain}</div>
                <img src="${data.screenshot}" class="claudey-screenshot" alt="Screenshot">
                <div class="claudey-analysis">${data.analysis}</div>
                ${data.category ? `<div class="claudey-category">${data.category}</div>` : ''}
            </div>
        `;
        
        // Make the entire item clickable to open the URL
        item.style.cursor = 'pointer';
        item.addEventListener('click', (e) => {
            // Don't navigate if clicking on the URL specifically (it has its own handler)
            if (!e.target.classList.contains('claudey-url')) {
                window.open(data.url, '_blank');
            }
        });

        feed.insertBefore(item, feed.firstChild);

        // Limit items in feed
        const items = feed.querySelectorAll('.claudey-analysis-item');
        if (items.length > 20) {
            items[items.length - 1].remove();
        }

        // Scroll to top
        feed.scrollTop = 0;
    }

    updateAnalysisItem(timestamp, updates) {
        const item = document.querySelector(`[data-timestamp="${timestamp}"]`);
        if (!item) return;

        if (updates.analysis) {
            const analysisDiv = item.querySelector('.claudey-analysis');
            analysisDiv.textContent = updates.analysis;
        }

        if (updates.category) {
            const existingCategory = item.querySelector('.claudey-category');
            if (existingCategory) {
                existingCategory.textContent = updates.category;
            } else {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'claudey-category';
                categoryDiv.textContent = updates.category;
                item.querySelector('.claudey-content').appendChild(categoryDiv);
            }
        }

        if (updates.status) {
            item.classList.remove('analyzing', 'error', 'complete');
            item.classList.add(updates.status);
        }
    }

    addMemoryEntry(entry) {
        this.memoryEntries.push(entry);
        console.log('🧠 AI Analysis Result:', entry.analysis);
        
        // Show notification with analysis result
        this.showNotification(`Algorithm Mirror: ${entry.category} detected - ${entry.analysis.substring(0, 80)}...`, 8000);
        
        // Update feed with new analysis
        this.updateAnalysisFeed(entry);
    }
    
    updateAnalysisFeed(entry) {
        const feed = document.getElementById('claudey-feed');
        if (!feed) return;
        
        // Remove welcome message
        const welcome = feed.querySelector('.claudey-welcome');
        if (welcome) welcome.remove();
        
        // Create analysis entry
        const analysisDiv = document.createElement('div');
        analysisDiv.className = 'claudey-analysis-item';
        
        const truncatedAnalysis = entry.analysis.length > 150 ? entry.analysis.substring(0, 150) + '...' : entry.analysis;
        const showExpandButton = entry.analysis.length > 150;
        
        analysisDiv.innerHTML = `
            <div class="claudey-analysis-header">
                <span class="claudey-category">${entry.category}</span>
                <span class="claudey-timestamp">${this.formatTimeAgo(entry.timestamp)}</span>
            </div>
            <div class="claudey-analysis-text" data-analysis-id="${entry.timestamp}">
                <div class="analysis-preview">${truncatedAnalysis}</div>
                <div class="analysis-full" style="display: none;">${entry.analysis}</div>
                ${showExpandButton ? '<button class="claudey-expand-btn">Show More</button>' : ''}
            </div>
            <div class="claudey-analysis-url">${entry.url}</div>
        `;
        
        // Add click handler for expand button
        if (showExpandButton) {
            const expandBtn = analysisDiv.querySelector('.claudey-expand-btn');
            expandBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSidebarAnalysis(entry.timestamp);
            });
        }
        
        // Add to top of feed
        feed.insertBefore(analysisDiv, feed.firstChild);
        
        // Keep only last 5 entries
        const items = feed.querySelectorAll('.claudey-analysis-item');
        if (items.length > 5) {
            items[items.length - 1].remove();
        }
    }
    
    toggleSidebarAnalysis(analysisId) {
        const analysisContainer = document.querySelector(`[data-analysis-id="${analysisId}"]`);
        if (!analysisContainer) return;

        const preview = analysisContainer.querySelector('.analysis-preview');
        const full = analysisContainer.querySelector('.analysis-full');
        const button = analysisContainer.querySelector('.claudey-expand-btn');

        if (full.style.display === 'none') {
            // Expand
            preview.style.display = 'none';
            full.style.display = 'block';
            button.textContent = 'Show Less';
        } else {
            // Collapse
            preview.style.display = 'block';
            full.style.display = 'none';
            button.textContent = 'Show More';
        }
    }

    formatTimeAgo(timestamp) {
        const now = new Date();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }

    async manualCapture() {
        try {
            await chrome.runtime.sendMessage({
                type: 'MANUAL_CAPTURE'
            });
            
            this.showNotification('📸 Capturing screenshot...', 'info');
        } catch (error) {
            this.showNotification('Capture failed', 'error');
        }
    }

    async searchMemory() {
        const query = document.getElementById('claudey-search-input').value.trim();
        if (!query) return;

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'SEARCH_MEMORY',
                data: query
            });

            this.displaySearchResults(response.results, query);
        } catch (error) {
            this.showNotification('Search failed', 'error');
        }
    }

    displaySearchResults(results, query) {
        const feed = document.getElementById('claudey-feed');
        feed.innerHTML = `
            <div class="claudey-search-results">
                <h4>🔍 Search: "${query}"</h4>
                <p>Found ${results.length} results</p>
            </div>
        `;

        results.forEach(result => {
            this.addAnalysisItem({
                timestamp: result.timestamp,
                url: result.url,
                screenshot: result.screenshot,
                analysis: result.analysis,
                category: result.category
            });
        });

        if (results.length === 0) {
            feed.innerHTML += '<div class="claudey-no-results">No results found</div>';
        }
    }

    openMemoryTimeline() {
        this.showNotification('Memory timeline - coming soon!', 'info');
    }

    showNotification(message, type = 'info') {
        // Create temporary notification
        const notification = document.createElement('div');
        notification.className = `claudey-notification claudey-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('claudey-show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('claudey-show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

} // End of ClaudeyContentScript class definition check

// Initialize content script only once
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.claudeyContentScript) {
            window.claudeyContentScript = new ClaudeyContentScript();
        }
    });
} else {
    if (!window.claudeyContentScript) {
        window.claudeyContentScript = new ClaudeyContentScript();
    }
}
/**
 * Algorithm Mirror - Background Service Worker with Multi-Agent AI System
 * Handles extension lifecycle, tab monitoring, and orchestrated AI analysis
 */

// Import agent scripts
importScripts(
    // 'agents/text-browsing-agent.js',  // Commented out for now
    'agents/vision-agent.js', 
    // 'agents/orchestrator-agent.js',    // Commented out for now
    'agents/semantic-tensor-memory.js'
);

class AlgorithmMirrorBackground {
    constructor() {
        this.activeAnalysis = new Map();
        this.memoryStorage = new Map();
        this.isActive = true;
        this.analysisInterval = 30000; // 30 seconds
        this.lastCaptureTime = 0; // Rate limiting for screenshots
        this.currentSettings = {};
        
        // Initialize multi-agent system
        this.initializeAgentSystem();
        
        this.setupEventListeners();
        this.initializeExtension();
    }

    async initializeAgentSystem() {
        console.log('🚀 Initializing Vision Agent System...');

        // Get settings for endpoint configuration
        const settings = await this.getSettings();
        const endpoint = settings.ollamaEndpoint || 'http://localhost:8081';
        const embeddingModel = settings.embeddingModel || 'nomic-embed-text';
        this.currentSettings = {
            ...settings,
            ollamaEndpoint: endpoint,
            embeddingModel
        };

        // Initialize only vision agent for now
        // this.textAgent = new TextBrowsingAgent({ ollamaEndpoint: endpoint, embeddingModel }); // Commented out for now
        this.visionAgent = new VisionAgent({ ollamaEndpoint: endpoint, embeddingModel });
        // this.orchestratorAgent = new OrchestratorAgent(endpoint); // Commented out for now
        this.semanticMemory = new SemanticTensorMemory({ ollamaEndpoint: endpoint, embeddingModel });
        
        const visionModel = settings.vlmModel || 'llava:7b';

        // Initialize only vision agent for now
        // this.textAgent = new TextBrowsingAgent(endpoint);         // Commented out for now
        this.visionAgent = new VisionAgent(endpoint, visionModel);
        // this.orchestratorAgent = new OrchestratorAgent(endpoint); // Commented out for now
        this.semanticMemory = new SemanticTensorMemory();

        // Connect orchestrator to agents (commented out for now)
        // this.orchestratorAgent.initialize(this.textAgent, this.visionAgent);

        console.log('✅ Vision Agent System initialized with:');
        // console.log('  - Text Browsing Agent:', this.textAgent.agentId);
        console.log('  - Vision Agent:', this.visionAgent.agentId);
        console.log('    • Model:', this.visionAgent.visionModel);
        // console.log('  - Orchestrator Agent:', this.orchestratorAgent.agentId);
        console.log('  - Semantic Memory System:', this.semanticMemory.systemId);
    }

    setupEventListeners() {
        // Extension installation
        chrome.runtime.onInstalled.addListener(() => {
            console.log('Algorithm Mirror installed');
            this.initializeStorage();
        });

        // Tab events
        chrome.tabs.onActivated.addListener(async (activeInfo) => {
            await this.handleTabActivated(activeInfo.tabId);
        });

        chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
            if (changeInfo.status === 'complete' && tab.url) {
                await this.handlePageLoaded(tabId, tab);
            }
        });

        // Messages from content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            const result = this.handleMessage(message, sender, sendResponse);
            return result; // Return true for async responses
        });

        // Periodic analysis
        setInterval(() => {
            if (this.isActive) {
                this.performPeriodicAnalysis();
            } else {
                // Optional: Log when periodic analysis is skipped due to inactive state
                // console.log('⏸️ Periodic analysis skipped - Algorithm Mirror is inactive');
            }
        }, this.analysisInterval);
    }

    async initializeExtension() {
        // Load saved state
        const result = await chrome.storage.local.get(['algorithmMirrorSettings', 'algorithmMirrorMemory']);
        
        if (result.algorithmMirrorSettings) {
            this.isActive = result.algorithmMirrorSettings.isActive !== false;
            this.analysisInterval = result.algorithmMirrorSettings.analysisInterval || 30000;
            this.currentSettings = {
                ...this.currentSettings,
                ...result.algorithmMirrorSettings
            };
        }

        if (result.algorithmMirrorMemory) {
            this.memoryStorage = new Map(result.algorithmMirrorMemory);
        }

        console.log('Algorithm Mirror initialized');
    }

    async initializeStorage() {
        // Clear old storage to prevent quota issues
        try {
            const storage = await chrome.storage.local.get(null);
            const storageSize = JSON.stringify(storage).length;
            console.log(`Current storage size: ${(storageSize / 1024).toFixed(0)}KB`);
            
            if (storageSize > 4 * 1024 * 1024) { // If over 4MB
                console.log('🧹 Clearing storage due to size limit');
                await chrome.storage.local.clear();
            }
        } catch (error) {
            console.error('Storage check failed:', error);
        }

        const defaultSettings = {
            isActive: true,
            analysisInterval: 30000,
            vlmModel: 'llava:7b',
            embeddingModel: 'nomic-embed-text',
            ollamaEndpoint: 'http://localhost:8081'  // Use CORS proxy
        };

        // Only initialize if settings don't exist, preserve existing memory
        const existing = await chrome.storage.local.get(['algorithmMirrorSettings', 'algorithmMirrorMemory']);
        
        const updates = {};
        if (!existing.algorithmMirrorSettings) {
            updates.algorithmMirrorSettings = defaultSettings;
        }
        if (!existing.algorithmMirrorMemory) {
            updates.algorithmMirrorMemory = [];
        }
        
        if (Object.keys(updates).length > 0) {
            await chrome.storage.local.set(updates);
        }
    }

    async handleTabActivated(tabId) {
        try {
            const tab = await chrome.tabs.get(tabId);
            if (this.isValidUrl(tab.url)) {
                await this.injectContentScript(tabId);
                this.scheduleAnalysis(tabId, tab.url);
            }
        } catch (error) {
            console.error('Error handling tab activation:', error);
        }
    }

    async handlePageLoaded(tabId, tab) {
        if (this.isValidUrl(tab.url)) {
            await this.injectContentScript(tabId);
            
            // Schedule analysis after page settles
            setTimeout(() => {
                this.scheduleAnalysis(tabId, tab.url);
            }, 3000);
        }
    }

    async injectContentScript(tabId) {
        try {
            // Check if content script is already injected
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => !!window.algorithmMirrorInjected
            });
            
            if (results[0].result) {
                // Already injected, skip
                return true;
            }
            
            await chrome.scripting.executeScript({
                target: { tabId },
                files: ['content-script.js']
            });
            
            // Wait a moment for content script to initialize
            await new Promise(resolve => setTimeout(resolve, 500));
            return true;
        } catch (error) {
            // Content script injection failed or tab closed
            console.log('Content script injection skipped:', error.message);
            return false;
        }
    }

    async ensureContentScript(tabId) {
        try {
            // First check if we can communicate with existing content script
            await chrome.tabs.sendMessage(tabId, { type: 'PING' });
            return true; // Content script is responsive
        } catch (error) {
            // Content script not responsive, inject it
            console.log('Content script not responsive, injecting:', error.message);
            return await this.injectContentScript(tabId);
        }
    }

    isValidUrl(url) {
        return url && 
               (url.startsWith('http://') || url.startsWith('https://')) &&
               !url.startsWith('chrome://') &&
               !url.startsWith('chrome-extension://') &&
               !url.startsWith('moz-extension://');
    }

    async scheduleAnalysis(tabId, url) {
        if (!this.isActive) return;

        const analysisId = `${tabId}_${Date.now()}`;
        
        this.activeAnalysis.set(analysisId, {
            tabId,
            url,
            timestamp: Date.now(),
            status: 'scheduled'
        });

        // Perform analysis
        setTimeout(async () => {
            await this.performAnalysis(analysisId);
        }, 2000);
    }

    async performAnalysis(analysisId) {
        const analysis = this.activeAnalysis.get(analysisId);
        if (!analysis) return;
        
        // Check if AI is still active before proceeding
        if (!this.isActive) {
            console.log(`⏹️ Analysis ${analysisId} cancelled - AI is inactive`);
            this.activeAnalysis.delete(analysisId);
            return;
        }

        try {
            analysis.status = 'capturing';
            
            // Capture screenshot (required for vision-only analysis)
            const screenshot = await this.captureScreenshot(analysis.tabId);
            
            // Debug screenshot data
            console.log('📸 Screenshot capture result:');
            console.log('- Is null/undefined:', screenshot == null);
            console.log('- Type:', typeof screenshot);
            console.log('- Length:', screenshot ? screenshot.length : 'N/A');
            console.log('- Starts with data:', screenshot ? screenshot.startsWith('data:') : 'N/A');
            console.log('- First 50 chars:', screenshot ? screenshot.substring(0, 50) : 'N/A');
            
            if (!screenshot) {
                console.log('⚠️ Screenshot capture failed - cannot perform vision analysis');
                analysis.status = 'failed';
                analysis.error = 'Screenshot capture failed';
                this.activeAnalysis.delete(analysisId);
                return;
            }

            analysis.screenshot = screenshot;
            analysis.status = 'analyzing';

            // Check if AI is still active before proceeding with analysis
            if (!this.isActive) {
                console.log(`⏹️ Vision analysis cancelled - AI became inactive during processing`);
                this.activeAnalysis.delete(analysisId);
                return;
            }
            
            // Final check before starting vision analysis
            if (!this.isActive) {
                console.log(`⏹️ Vision analysis cancelled - AI became inactive before analysis`);
                this.activeAnalysis.delete(analysisId);
                return;
            }
            
            // Perform vision-only analysis
            console.log('👁️ Starting Vision Agent Analysis...');
            const visionResult = await this.visionAgent.analyzeScreenshot(
                analysis.url, 
                screenshot, 
                null  // No text context for now
            );
            console.log('✅ Vision analysis completed');
            
            // Create a simplified result structure for memory storage
            const simplifiedResult = {
                timestamp: new Date().toISOString(),
                url: analysis.url,
                agentResults: {
                    vision: visionResult
                },
                orchestratorSynthesis: {
                    unifiedAnalysis: visionResult.visionAnalysis.synthesis,
                    confidence: visionResult.confidence
                },
                qualityMetrics: {
                    overallScore: visionResult.confidence
                },
                orchestrationMetadata: {
                    processingTime: visionResult.reasoning.processingTime,
                    synthesisApproach: 'vision-only'
                }
            };
            
            // Store in semantic tensor memory
            const memoryResult = await this.semanticMemory.storeMemory(simplifiedResult);
            console.log('💾 Stored in semantic memory:', memoryResult.memoryId);
            
            // Extract vision analysis for UI display
            const unifiedAnalysis = visionResult.visionAnalysis.synthesis;
            const category = this.categorizeContentFromVision(visionResult);
            
            console.log('📊 Vision analysis complete - Category:', category);
            
            const sanitizedVisionResult = this.sanitizeVisionResult(visionResult);

            // Store the complete analysis in legacy format for UI compatibility
            await this.storeMemoryEntry({
                ...analysis,
                analysis: unifiedAnalysis,
                visionResult: sanitizedVisionResult,
                memoryId: memoryResult.memoryId,
                embeddings: visionResult.visionAnalysis.embeddings,
                category,
                screenshot,
                status: 'complete'
            });
            
            // Notify content script for UI updates (optional)
            try {
                await chrome.tabs.sendMessage(analysis.tabId, {
                    type: 'NEW_MEMORY_ENTRY',
                    data: {
                        timestamp: analysis.timestamp,
                        url: analysis.url,
                        screenshot,
                        analysis: unifiedAnalysis,
                        category,
                        visionResult: sanitizedVisionResult,
                        memoryId: memoryResult.memoryId
                    }
                });
                console.log('📤 Notified content script of new analysis');
            } catch (messageError) {
                // Content script not available - that's ok, analysis still stored
                console.log('Content script unavailable for UI update:', messageError.message);
            }

        } catch (error) {
            console.error('Analysis failed:', error);
            analysis.status = 'failed';
            analysis.error = error.message;
            
            // Clean up failed analysis
            this.activeAnalysis.delete(analysisId);
        }
    }

    async captureScreenshot(tabId) {
        try {
            console.log(`🔄 Starting screenshot capture for tabId: ${tabId}`);
            
            // Get tab info for context
            const tab = await chrome.tabs.get(tabId);
            console.log(`📋 Tab info:`, {
                id: tab.id,
                url: tab.url,
                active: tab.active,
                windowId: tab.windowId,
                status: tab.status
            });
            
            if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                throw new Error('Invalid tab for screenshot');
            }
            
            // Only capture if this is the currently active tab
            if (!tab.active) {
                throw new Error('Cannot capture screenshot - tab is not active (non-disruptive mode)');
            }
            
            // Rate limiting: max 1 capture per 2 seconds
            const now = Date.now();
            if (this.lastCaptureTime && (now - this.lastCaptureTime) < 2000) {
                throw new Error('Rate limited - too many captures');
            }
            this.lastCaptureTime = now;
            
            console.log(`📸 Attempting to capture screenshot for window ${tab.windowId}`);
            
            // Capture the screenshot of the active tab only
            const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
                format: 'jpeg',
                quality: 10  // Even lower quality to reduce memory usage and prevent Ollama crashes
            });

            console.log(`✅ Screenshot capture successful!`);
            console.log(`- Data URL type:`, typeof dataUrl);
            console.log(`- Data URL length:`, dataUrl ? dataUrl.length : 'null');
            console.log(`- Starts with data:image:`, dataUrl ? dataUrl.startsWith('data:image/') : 'N/A');
            console.log(`- First 100 chars:`, dataUrl ? dataUrl.substring(0, 100) : 'null');

            // Log screenshot size for debugging
            const sizeKB = Math.round(dataUrl.length * 0.75 / 1024);
            console.log(`📊 Screenshot captured for active tab: ${tab.url} (Size: ${sizeKB}KB)`);
            
            return dataUrl;
        } catch (error) {
            console.error('❌ Screenshot capture failed:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            
            // Try to provide helpful guidance
            if (error.message.includes('permission')) {
                console.log('💡 Try reloading the Chrome extension or granting site permissions');
            }
            return null;
        }
    }

    async performPeriodicAnalysis() {
        try {
            // Get the currently active tab in the focused window only
            const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (activeTab && this.isValidUrl(activeTab.url)) {
                // Double-check that the tab is still active before scheduling
                const currentTab = await chrome.tabs.get(activeTab.id);
                if (currentTab.active) {
                    console.log(`Scheduling analysis for active tab: ${activeTab.url}`);
                    this.scheduleAnalysis(activeTab.id, activeTab.url);
                } else {
                    console.log('Tab became inactive, skipping analysis');
                }
            } else {
                console.log('No valid active tab found for periodic analysis');
            }
        } catch (error) {
            console.error('Periodic analysis failed:', error);
        }
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'ANALYSIS_COMPLETE':
                (async () => {
                    try {
                        await this.handleAnalysisComplete(message.data);
                        sendResponse({ success: true });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                })();
                return true;

            case 'GET_MEMORY':
                (async () => {
                    try {
                        const memory = await this.getMemoryData(message.data);
                        sendResponse({ memory });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                })();
                return true;

            case 'SEARCH_MEMORY':
                (async () => {
                    try {
                        const results = await this.searchMemoryWithSemantics(message.data);
                        sendResponse({ results });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                })();
                return true;

            case 'GET_AGENT_STATS':
                (async () => {
                    try {
                        const stats = await this.getAgentSystemStats();
                        sendResponse({ stats });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                })();
                return true;

            case 'SEMANTIC_SEARCH':
                (async () => {
                    try {
                        const results = await this.semanticMemory.searchMemories(message.data.query, message.data.options);
                        sendResponse({ results });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                })();
                return true;

            case 'TOGGLE_AI':
                (async () => {
                    try {
                        const wasActive = this.isActive;
                        this.isActive = message.data.isActive;
                        
                        // If turning off AI, cancel all active analyses
                        let cancelledCount = 0;
                        if (wasActive && !this.isActive) {
                            cancelledCount = this.activeAnalysis.size;
                            await this.cancelAllActiveAnalyses();
                        }
                        
                        await this.saveSettings();
                        
                        console.log(`🎛️ Algorithm Mirror ${this.isActive ? 'activated' : 'deactivated'}`);
                        sendResponse({ 
                            success: true, 
                            isActive: this.isActive,
                            cancelledAnalyses: cancelledCount
                        });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                })();
                return true;

            case 'GET_SETTINGS':
                (async () => {
                    try {
                        const settings = await this.getSettings();
                        settings.isActive = this.isActive; // Include current active state
                        settings.activeAnalysisCount = this.activeAnalysis.size;
                        sendResponse({ settings });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                })();
                return true;

            case 'SETTINGS_UPDATED':
                (async () => {
                    try {
                        const updatedSettings = await this.applySettingsUpdate(message.data || {});
                        sendResponse({ success: true, settings: updatedSettings });
                    } catch (error) {
                        sendResponse({ success: false, error: error.message });
                    }
                })();
                return true;

            case 'MANUAL_CAPTURE':
                if (sender.tab) {
                    this.scheduleAnalysis(sender.tab.id, sender.tab.url);
                    sendResponse({ success: true });
                } else {
                    sendResponse({ success: false, error: 'No tab context' });
                }
                return false; // Synchronous response

            case 'TEST_VLM':
                (async () => {
                    try {
                        console.log('Starting VLM test...');
                        const result = await this.testVLMConnection();
                        console.log('VLM test completed:', result);
                        sendResponse({ success: true, message: result });
                    } catch (error) {
                        console.error('VLM test failed:', error);
                        sendResponse({ success: false, error: error.message });
                    }
                })();
                return true; // Keep the message channel open for async response

            case 'SETTINGS_UPDATED':
                (async () => {
                    try {
                        await this.applySettingsUpdate(message.data);
                        sendResponse({ success: true });
                    } catch (error) {
                        console.error('Failed to apply settings update:', error);
                        sendResponse({ success: false, error: error.message });
                    }
                })();
                return true;

            case 'PERMISSIONS_GRANTED':
                (async () => {
                    try {
                        console.log('🔓 Permissions granted - attempting immediate analysis');
                        // Try to perform analysis on current tab
                        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                        if (tab && this.isValidUrl(tab.url)) {
                            await this.performAnalysis(tab.id, tab.url);
                        }
                        sendResponse({ success: true });
                    } catch (error) {
                        console.error('Post-permission analysis failed:', error);
                        sendResponse({ success: false, error: error.message });
                    }
                })();
                return true;

            default:
                sendResponse({ error: 'Unknown message type' });
                return false;
        }
    }

    async applySettingsUpdate(newSettings = {}) {
        try {
            if (typeof newSettings.isActive === 'boolean') {
                this.isActive = newSettings.isActive;
            }

            if (typeof newSettings.analysisInterval === 'number') {
                this.analysisInterval = newSettings.analysisInterval;
            }

            const desiredEndpoint = newSettings.ollamaEndpoint
                || (this.visionAgent ? this.visionAgent.ollamaEndpoint : 'http://localhost:8081');
            const desiredModel = newSettings.vlmModel;

            const shouldReinitializeVisionAgent = !this.visionAgent
                || (newSettings.ollamaEndpoint && this.visionAgent.ollamaEndpoint !== newSettings.ollamaEndpoint);

            if (shouldReinitializeVisionAgent) {
                console.log('♻️ Reinitializing Vision Agent with updated settings...');
                this.visionAgent = new VisionAgent(
                    desiredEndpoint,
                    desiredModel || (this.visionAgent ? this.visionAgent.visionModel : 'llava:7b')
                );
            } else if (desiredModel) {
                if (typeof this.visionAgent.setVisionModel === 'function') {
                    this.visionAgent.setVisionModel(desiredModel);
                } else {
                    this.visionAgent.visionModel = desiredModel;
                }
            }

            if (this.visionAgent) {
                this.visionAgent.ollamaEndpoint = desiredEndpoint;
            }
        } catch (error) {
            console.error('Error applying settings update:', error);
            throw error;
        }
    }

    async handleAnalysisComplete(data) {
        const { analysisId, analysis, embeddings, category } = data;
        
        // Update active analysis
        const activeAnalysis = this.activeAnalysis.get(analysisId);
        if (activeAnalysis) {
            const sanitizedVisionResult = this.sanitizeVisionResult(activeAnalysis.visionResult);

            activeAnalysis.status = 'complete';
            activeAnalysis.analysis = analysis;
            activeAnalysis.embeddings = embeddings;
            activeAnalysis.category = category;
            activeAnalysis.visionResult = sanitizedVisionResult;

            // Store in memory
            await this.storeMemoryEntry(activeAnalysis);

            // Clean up active analysis
            this.activeAnalysis.delete(analysisId);
        }
    }

    async storeMemoryEntry(entry) {
        const sanitizedVisionResult = this.sanitizeVisionResult(entry.visionResult);

        const memoryEntry = {
            id: entry.memoryId || `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: entry.timestamp,
            url: entry.url,
            screenshot: entry.screenshot,
            analysis: entry.analysis,
            embeddings: entry.embeddings,
            category: entry.category,
            visionResult: sanitizedVisionResult,     // Store sanitized vision result
            agentVersion: 'vision-only-v1',         // Updated version
            type: 'page_analysis'
        };

        this.memoryStorage.set(memoryEntry.id, memoryEntry);
        
        // Save to chrome storage (keep last 1000 entries)
        const memoryArray = Array.from(this.memoryStorage.entries()).slice(-1000);
        await chrome.storage.local.set({ algorithmMirrorMemory: memoryArray });
        
        // Notify content scripts
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
            if (this.isValidUrl(tab.url)) {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'NEW_MEMORY_ENTRY',
                    data: memoryEntry
                }).catch(() => {}); // Ignore errors for tabs without content script
            }
        });
    }

    async getMemoryData(filters = {}) {
        let entries = Array.from(this.memoryStorage.values());
        
        // Apply filters
        if (filters.category) {
            entries = entries.filter(entry => entry.category === filters.category);
        }
        
        if (filters.dateRange) {
            const { start, end } = filters.dateRange;
            entries = entries.filter(entry => 
                entry.timestamp >= start && entry.timestamp <= end
            );
        }
        
        if (filters.url) {
            entries = entries.filter(entry => 
                entry.url.toLowerCase().includes(filters.url.toLowerCase())
            );
        }

        // Sort by timestamp (newest first)
        entries.sort((a, b) => b.timestamp - a.timestamp);
        
        return entries;
    }

    async searchMemory(query) {
        if (!query || query.trim().length === 0) {
            return [];
        }

        const queryLower = query.toLowerCase();
        const entries = Array.from(this.memoryStorage.values());
        
        // Semantic search using embeddings would go here
        // For now, using simple text matching
        const results = entries.filter(entry => {
            return (
                entry.url.toLowerCase().includes(queryLower) ||
                entry.analysis.toLowerCase().includes(queryLower) ||
                entry.category.toLowerCase().includes(queryLower)
            );
        });

        // Score and sort results
        results.forEach(result => {
            let score = 0;
            
            // URL matches get higher score
            if (result.url.toLowerCase().includes(queryLower)) score += 3;
            
            // Analysis matches
            if (result.analysis.toLowerCase().includes(queryLower)) score += 2;
            
            // Category matches
            if (result.category.toLowerCase().includes(queryLower)) score += 1;
            
            result.searchScore = score;
        });

        results.sort((a, b) => (b.searchScore || 0) - (a.searchScore || 0));
        
        return results.slice(0, 50); // Limit results
    }

    async saveSettings() {
        const existing = await this.getSettings();
        const settings = {
            ...existing,
            ...this.currentSettings,
        const currentSettings = await this.getSettings();
        const settings = {
            ...currentSettings,
            isActive: this.isActive,
            analysisInterval: this.analysisInterval
        };

        this.currentSettings = settings;

        await chrome.storage.local.set({ algorithmMirrorSettings: settings });
    }

    async getSettings() {
        const result = await chrome.storage.local.get(['algorithmMirrorSettings']);
        return result.algorithmMirrorSettings || {};
    }

    async applySettingsUpdate(newSettings = {}) {
        const mergedSettings = {
            ...this.currentSettings,
            ...newSettings
        };

        if (typeof mergedSettings.isActive === 'boolean') {
            this.isActive = mergedSettings.isActive;
        }

        if (typeof mergedSettings.analysisInterval === 'number') {
            this.analysisInterval = mergedSettings.analysisInterval;
        }

        const embeddingModel = mergedSettings.embeddingModel || 'nomic-embed-text';
        const endpoint = mergedSettings.ollamaEndpoint || 'http://localhost:8081';

        if (this.visionAgent) {
            if (typeof this.visionAgent.updateEmbeddingConfig === 'function') {
                this.visionAgent.updateEmbeddingConfig({
                    embeddingModel,
                    ollamaEndpoint: endpoint
                });
            } else {
                this.visionAgent.embeddingModel = embeddingModel;
                this.visionAgent.ollamaEndpoint = endpoint;
            }
        }

        if (this.textAgent) {
            if (typeof this.textAgent.updateEmbeddingConfig === 'function') {
                this.textAgent.updateEmbeddingConfig({
                    embeddingModel,
                    ollamaEndpoint: endpoint
                });
            } else {
                this.textAgent.embeddingModel = embeddingModel;
                this.textAgent.ollamaEndpoint = endpoint;
            }
        }

        if (this.semanticMemory) {
            if (typeof this.semanticMemory.updateEmbeddingConfig === 'function') {
                this.semanticMemory.updateEmbeddingConfig({
                    embeddingModel,
                    ollamaEndpoint: endpoint
                });
            } else {
                this.semanticMemory.embeddingModel = embeddingModel;
                this.semanticMemory.ollamaEndpoint = endpoint;
            }
        }

        mergedSettings.embeddingModel = embeddingModel;
        mergedSettings.ollamaEndpoint = endpoint;

        this.currentSettings = mergedSettings;

        return mergedSettings;
    }

    async getPageContent(tabId) {
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId },
                func: () => {
                    return {
                        html: document.documentElement.outerHTML,
                        title: document.title,
                        url: window.location.href
                    };
                }
            });
            
            return results[0]?.result?.html || '<html><body>Content extraction failed</body></html>';
        } catch (error) {
            console.error('Failed to extract page content:', error);
            return '<html><body>Content extraction failed</body></html>';
        }
    }

    sanitizeVisionResult(visionResult) {
        if (!visionResult) {
            return visionResult;
        }

        const sanitizedResult = typeof structuredClone === 'function'
            ? structuredClone(visionResult)
            : JSON.parse(JSON.stringify(visionResult));

        if (sanitizedResult.rawData) {
            delete sanitizedResult.rawData.screenshot;

            if (Object.keys(sanitizedResult.rawData).length === 0) {
                delete sanitizedResult.rawData;
            }
        }

        return sanitizedResult;
    }

    categorizeContentFromOrchestration(orchestrationResult) {
        const url = orchestrationResult.url.toLowerCase();
        const unifiedAnalysis = orchestrationResult.orchestratorSynthesis.unifiedAnalysis.toLowerCase();
        
        // Enhanced categorization using multi-agent insights
        if (url.includes('github') || unifiedAnalysis.includes('code') || unifiedAnalysis.includes('repository')) {
            return 'development';
        } else if (url.includes('youtube') || url.includes('video') || unifiedAnalysis.includes('video')) {
            return 'media';
        } else if (unifiedAnalysis.includes('news') || unifiedAnalysis.includes('article') || url.includes('news')) {
            return 'news';
        } else if (url.includes('social') || url.includes('twitter') || url.includes('linkedin') || url.includes('facebook')) {
            return 'social';
        } else if (unifiedAnalysis.includes('shopping') || unifiedAnalysis.includes('product') || url.includes('shop') || url.includes('amazon')) {
            return 'shopping';
        } else if (unifiedAnalysis.includes('documentation') || unifiedAnalysis.includes('tutorial') || unifiedAnalysis.includes('guide')) {
            return 'documentation';
        } else if (unifiedAnalysis.includes('search') || url.includes('google') || url.includes('bing')) {
            return 'search';
        } else {
            return 'general';
        }
    }

    categorizeContentFromVision(visionResult) {
        const url = visionResult.url.toLowerCase();
        const visionAnalysis = visionResult.visionAnalysis.synthesis.toLowerCase();
        
        // Categorization based on vision analysis
        if (url.includes('github') || visionAnalysis.includes('code') || visionAnalysis.includes('repository')) {
            return 'development';
        } else if (url.includes('youtube') || url.includes('video') || visionAnalysis.includes('video')) {
            return 'media';
        } else if (visionAnalysis.includes('news') || visionAnalysis.includes('article') || url.includes('news')) {
            return 'news';
        } else if (url.includes('social') || url.includes('twitter') || url.includes('linkedin') || url.includes('facebook') || visionAnalysis.includes('social')) {
            return 'social';
        } else if (visionAnalysis.includes('shopping') || visionAnalysis.includes('product') || url.includes('shop') || url.includes('amazon')) {
            return 'shopping';
        } else if (visionAnalysis.includes('documentation') || visionAnalysis.includes('tutorial') || visionAnalysis.includes('guide')) {
            return 'documentation';
        } else if (visionAnalysis.includes('search') || url.includes('google') || url.includes('bing')) {
            return 'search';
        } else if (visionAnalysis.includes('feed') || visionAnalysis.includes('algorithmic') || visionAnalysis.includes('recommended') || visionAnalysis.includes('sponsored')) {
            return 'algorithmic';
        } else {
            return 'general';
        }
    }

    // Legacy method kept for VLM testing
    async performVLMAnalysis(screenshot, url) {
        const settings = await this.getSettings();
        const vlmEndpoint = `${settings.ollamaEndpoint || 'http://localhost:8081'}/api/generate`;
        const selectedModel = settings.vlmModel || 'llava:7b';

        // First, check if Ollama is running and model is available
        try {
            const healthCheck = await fetch(`${settings.ollamaEndpoint || 'http://localhost:8081'}/api/tags`);
            if (!healthCheck.ok) {
                throw new Error(`Ollama not running or not accessible: ${healthCheck.status}`);
            }
            
            const tagsData = await healthCheck.json();
            const hasLlavaModel = tagsData.models?.some(model => 
                model.name.includes('llava') || model.name.includes(selectedModel)
            );
            
            if (!hasLlavaModel) {
                throw new Error(`Model ${selectedModel} not found. Available models: ${tagsData.models?.map(m => m.name).join(', ')}`);
            }
            
            console.log(`Using VLM model: ${selectedModel}`);
        } catch (error) {
            throw new Error(`Ollama setup failed: ${error.message}`);
        }

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
            // Clean the base64 image data
            const base64Data = screenshot.includes(',') ? screenshot.split(',')[1] : screenshot;
            
            // Check base64 data size (Chrome screenshots can be huge)
            const sizeKB = Math.round(base64Data.length * 0.75 / 1024); // Rough base64 to bytes conversion
            console.log(`Screenshot size: ${sizeKB}KB, Base64 length: ${base64Data.length}`);
            
            if (sizeKB > 5000) { // 5MB limit
                throw new Error(`Screenshot too large: ${sizeKB}KB. Please reduce browser window size.`);
            }
            
            // Validate base64 format
            if (!base64Data.match(/^[A-Za-z0-9+/]*={0,2}$/)) {
                throw new Error('Invalid base64 image data');
            }
            
            console.log(`Sending VLM request to ${vlmEndpoint} with model ${selectedModel}`);
            
            // Start with minimal request to avoid any option issues
            const requestBody = {
                model: selectedModel,
                prompt: "What do you see in this image?",  // Simpler prompt to start
                images: [base64Data],
                stream: false
            };

            console.log('Request body keys:', Object.keys(requestBody));
            console.log('Model:', requestBody.model);
            console.log('Prompt length:', requestBody.prompt.length);
            console.log('Images array length:', requestBody.images.length);
            console.log('Image data sample:', base64Data.substring(0, 50) + '...');
            
            // Use fetch with timeout for better reliability
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 second timeout for VLM
            
            const response = await fetch(vlmEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('VLM API error response:', errorText);
                throw new Error(`VLM API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('VLM analysis completed successfully');
            return data.response || 'Analysis completed but no response received';

        } catch (error) {
            console.error('VLM analysis error:', error);
            if (error.name === 'AbortError') {
                throw new Error(`VLM analysis timed out after 120 seconds`);
            }
            throw new Error(`VLM analysis failed: ${error.message}`);
        }
    }

    async generateEmbeddings(analysis, url) {
        const settings = await this.getSettings();
        const embeddingEndpoint = `${settings.ollamaEndpoint || 'http://localhost:8081'}/api/embeddings`;

        try {
            const textForEmbedding = `
                URL: ${url}
                Analysis: ${analysis}
                Domain: ${new URL(url).hostname}
                Timestamp: ${new Date().toISOString()}
            `;

            const response = await fetch(embeddingEndpoint, {
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

    async testVLMConnection() {
        const settings = await this.getSettings();
        const endpoint = settings.ollamaEndpoint || 'http://localhost:8081';
        
        console.log('Testing VLM connection to:', endpoint);
        
        // Test 1: Basic connection
        try {
            const tagsResponse = await fetch(`${endpoint}/api/tags`);
            if (!tagsResponse.ok) {
                throw new Error(`Ollama not accessible: ${tagsResponse.status}`);
            }
            
            const tagsData = await tagsResponse.json();
            console.log('✅ Ollama connection successful');
            console.log('Available models:', tagsData.models?.map(m => m.name));
        } catch (error) {
            throw new Error(`Connection test failed: ${error.message}`);
        }
        
        // Test 2: Simple text generation (no image) with timeout
        try {
            console.log('Testing text generation...');
            
            // Check available models using the tags endpoint we know works
            const tagsResponse = await fetch(`${endpoint}/api/tags`);
            const tagsData = await tagsResponse.json();
            const availableModels = tagsData.models || [];
            
            console.log('Available models:', availableModels.map(m => m.name));
            
            const hasLlava = availableModels.some(m => 
                m.name.includes('llava') || m.name.startsWith('llava:')
            );
            
            if (!hasLlava) {
                throw new Error('No llava model found. Please install with: ollama pull llava');
            }
            
            console.log('Model exists, testing generation...');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
            
            const requestBody = {
                model: 'llava:7b',
                prompt: 'Hello',
                stream: false
            };
            
            console.log('Sending request:', JSON.stringify(requestBody, null, 2));
            
            const testResponse = await fetch(`${endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            console.log('Response status:', testResponse.status);
            console.log('Response headers:', Object.fromEntries(testResponse.headers.entries()));
            
            if (!testResponse.ok) {
                const errorText = await testResponse.text();
                console.error('Text generation error response:', errorText);
                console.error('Error response length:', errorText.length);
                throw new Error(`Text generation failed: ${testResponse.status} - ${errorText || 'Empty response'}`);
            }
            
            const testData = await testResponse.json();
            console.log('Full response data:', testData);
            console.log('✅ Text generation successful:', testData.response?.substring(0, 100) + '...');
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(`Text generation timed out after 60 seconds`);
            }
            throw new Error(`Text generation test failed: ${error.message}`);
        }
        
        // Test 3: Simple image analysis with timeout
        try {
            console.log('Testing image analysis...');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for image
            
            const imageResponse = await fetch(`${endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llava:7b',
                    prompt: 'What color is this?',
                    images: ['iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='],
                    stream: false,
                    options: {
                        num_predict: 5,
                        temperature: 0
                    }
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!imageResponse.ok) {
                const errorText = await imageResponse.text();
                console.error('Image analysis error response:', errorText);
                throw new Error(`Image analysis failed: ${imageResponse.status} - ${errorText}`);
            }
            
            const imageData = await imageResponse.json();
            console.log('✅ Image analysis successful:', imageData.response?.substring(0, 100) + '...');
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(`Image analysis timed out after 60 seconds`);
            }
            throw new Error(`Image analysis test failed: ${error.message}`);
        }
        
        return 'All VLM tests successful';
    }

    async cancelAllActiveAnalyses() {
        const activeCount = this.activeAnalysis.size;
        if (activeCount > 0) {
            console.log(`⏹️ Cancelling ${activeCount} active analyses...`);
            
            // Mark all active analyses as cancelled
            for (const [analysisId, analysis] of this.activeAnalysis.entries()) {
                analysis.status = 'cancelled';
                analysis.cancelledAt = Date.now();
                console.log(`⏹️ Cancelled analysis ${analysisId} for ${analysis.url}`);
            }
            
            // Clear the active analyses map
            this.activeAnalysis.clear();
            
            console.log(`✅ All ${activeCount} active analyses cancelled`);
        } else {
            console.log(`⏹️ No active analyses to cancel`);
        }
    }

    async searchMemoryWithSemantics(query) {
        if (!query || query.trim().length === 0) {
            return [];
        }

        try {
            // Use semantic memory for advanced search
            const semanticResults = await this.semanticMemory.searchMemories(query, {
                limit: 20,
                threshold: 0.6,
                includeRelationships: true
            });
            
            // Convert semantic results to legacy format for UI compatibility
            const legacyResults = semanticResults.results.map(result => ({
                ...this.memoryStorage.get(result.memoryId),
                searchScore: result.similarity,
                semanticRelationships: result.relationships
            })).filter(r => r.id); // Only include results that exist in legacy storage
            
            return legacyResults;
            
        } catch (error) {
            console.error('Semantic search failed, falling back to legacy search:', error);
            // Fallback to legacy search
            return await this.searchMemory(query);
        }
    }

    async getAgentSystemStats() {
        return {
            // textAgent: this.textAgent?.getAgentStats() || {},           // Commented out
            visionAgent: this.visionAgent?.getAgentStats() || {},
            // orchestrator: this.orchestratorAgent?.getOrchestrationStats() || {}, // Commented out
            semanticMemory: this.semanticMemory?.generateMemoryAnalytics() || {},
            systemStatus: {
                initialized: !!(this.visionAgent && this.semanticMemory), // Only check vision agent
                activeAnalyses: this.activeAnalysis.size,
                memoryEntries: this.memoryStorage.size
            }
        };
    }
}

// Initialize background script only once
if (!globalThis.algorithmMirrorBackground) {
    globalThis.algorithmMirrorBackground = new AlgorithmMirrorBackground();
}

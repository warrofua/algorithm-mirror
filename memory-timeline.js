/**
 * Algorithm Mirror - Memory Timeline Script
 * Displays and manages the browsing memory timeline
 */

class MemoryTimeline {
    constructor() {
        this.memories = [];
        this.filteredMemories = [];
        this.isLoading = true;
        
        this.init();
    }

    async init() {
        await this.loadMemories();
        this.setupEventListeners();
        this.render();
    }

    async loadMemories() {
        try {
            // Get memories from extension storage
            const response = await chrome.runtime.sendMessage({
                type: 'GET_MEMORY'
            });

            if (response && response.memory) {
                this.memories = response.memory.sort((a, b) => b.timestamp - a.timestamp);
                this.filteredMemories = [...this.memories];
            }

            this.isLoading = false;
            this.updateStats();
        } catch (error) {
            console.error('Failed to load memories:', error);
            this.isLoading = false;
        }
    }

    setupEventListeners() {
        // Search input
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterMemories();
        });

        // Category filter
        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            this.filterMemories();
        });

        // Time filter
        document.getElementById('timeFilter').addEventListener('change', (e) => {
            this.filterMemories();
        });

        // Listen for new memories
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'NEW_MEMORY_ENTRY') {
                this.addNewMemory(message.data);
            }
        });
    }

    filterMemories() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const categoryFilter = document.getElementById('categoryFilter').value;
        const timeFilter = document.getElementById('timeFilter').value;

        this.filteredMemories = this.memories.filter(memory => {
            // Search filter
            const matchesSearch = !searchTerm || 
                memory.url.toLowerCase().includes(searchTerm) ||
                memory.analysis.toLowerCase().includes(searchTerm) ||
                memory.category.toLowerCase().includes(searchTerm);

            // Category filter
            const matchesCategory = !categoryFilter || memory.category === categoryFilter;

            // Time filter
            let matchesTime = true;
            if (timeFilter) {
                const now = new Date();
                const memoryDate = new Date(memory.timestamp);
                
                switch (timeFilter) {
                    case 'today':
                        matchesTime = memoryDate.toDateString() === now.toDateString();
                        break;
                    case 'week':
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        matchesTime = memoryDate >= weekAgo;
                        break;
                    case 'month':
                        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        matchesTime = memoryDate >= monthAgo;
                        break;
                }
            }

            return matchesSearch && matchesCategory && matchesTime;
        });

        this.render();
    }

    addNewMemory(memory) {
        this.memories.unshift(memory);
        this.filterMemories();
        this.updateStats();
    }

    updateStats() {
        const totalMemories = this.memories.length;
        const uniquePages = new Set(this.memories.map(m => m.url)).size;
        const uniqueCategories = new Set(this.memories.map(m => m.category)).size;

        document.getElementById('totalMemories').textContent = totalMemories;
        document.getElementById('totalPages').textContent = uniquePages;
        document.getElementById('totalCategories').textContent = uniqueCategories;
    }

    render() {
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        const noResults = document.getElementById('noResults');
        const timeline = document.getElementById('timeline');

        // Hide all states first
        loadingState.style.display = 'none';
        emptyState.style.display = 'none';
        noResults.style.display = 'none';
        timeline.style.display = 'none';

        if (this.isLoading) {
            loadingState.style.display = 'block';
            return;
        }

        if (this.memories.length === 0) {
            emptyState.style.display = 'block';
            return;
        }

        if (this.filteredMemories.length === 0) {
            noResults.style.display = 'block';
            return;
        }

        // Render timeline
        timeline.style.display = 'block';
        timeline.innerHTML = this.filteredMemories.map(memory => this.renderMemoryItem(memory)).join('');

        // Add click handlers for timeline items
        timeline.querySelectorAll('.timeline-content').forEach((item, index) => {
            item.addEventListener('click', () => {
                this.openMemory(this.filteredMemories[index]);
            });
        });

        // Add click handlers for expand buttons
        timeline.querySelectorAll('.expand-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const memoryId = button.getAttribute('data-memory-id');
                this.toggleAnalysis(memoryId);
            });
        });
    }

    renderMemoryItem(memory) {
        const date = new Date(memory.timestamp);
        const timeAgo = this.formatTimeAgo(date);
        const fullTime = date.toLocaleString();
        const domain = new URL(memory.url).hostname;
        
        // Check if this is a multi-agent analysis
        const isMultiAgent = memory.agentVersion === 'multi-agent-v1' && memory.orchestrationResult;
        
        // Build agent info display
        let agentInfo = '';
        if (isMultiAgent) {
            const orchestration = memory.orchestrationResult;
            const confidence = (orchestration.orchestratorSynthesis.confidence * 100).toFixed(0);
            const agentAgreement = (orchestration.orchestratorSynthesis.agentAgreement * 100).toFixed(0);
            agentInfo = `
                <div class="agent-info">
                    <span class="agent-badge">🤖 Multi-Agent</span>
                    <span class="confidence-badge">Confidence: ${confidence}%</span>
                    <span class="agreement-badge">Agreement: ${agentAgreement}%</span>
                </div>
            `;
        }

        return `
            <div class="timeline-item">
                <div class="timeline-marker ${isMultiAgent ? 'multi-agent' : ''}"></div>
                <div class="timeline-content" data-memory-id="${memory.id}">
                    <div class="timeline-header">
                        <div>
                            <div class="timeline-url">${domain}</div>
                            <div class="timeline-domain">${memory.url.length > 60 ? memory.url.substring(0, 60) + '...' : memory.url}</div>
                            ${agentInfo}
                        </div>
                        <div class="timeline-time" title="${fullTime}">${timeAgo}</div>
                    </div>
                    <div class="timeline-body">
                        <img src="${memory.screenshot}" alt="Screenshot" class="timeline-screenshot" loading="lazy">
                        <div class="timeline-analysis" data-memory-id="${memory.id}">
                            <div class="analysis-preview">${this.truncateAnalysis(memory.analysis)}</div>
                            <div class="analysis-full" style="display: none;">
                                ${memory.analysis}
                                ${isMultiAgent ? this.renderAgentDetails(memory.orchestrationResult) : ''}
                            </div>
                            ${memory.analysis.length > 200 ? '<button class="expand-btn" data-memory-id="' + memory.id + '">Show More</button>' : ''}
                        </div>
                    </div>
                    <div class="timeline-footer">
                        <div class="timeline-category">${memory.category}</div>
                        <div class="timeline-actions">
                            <button class="action-btn primary" onclick="event.stopPropagation(); memoryTimeline.openUrl('${memory.url}')" title="Visit Page">🌐</button>
                            <button class="action-btn" onclick="event.stopPropagation(); memoryTimeline.shareMemory('${memory.id}')" title="Share">📤</button>
                            ${isMultiAgent ? '<button class="action-btn" onclick="event.stopPropagation(); memoryTimeline.showAgentDetails(\'' + memory.id + '\')" title="Agent Details">🤖</button>' : ''}
                            <button class="action-btn" onclick="event.stopPropagation(); memoryTimeline.deleteMemory('${memory.id}')" title="Delete">🗑️</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    truncateAnalysis(analysis) {
        if (analysis.length <= 200) return analysis;
        return analysis.substring(0, 200) + '...';
    }

    toggleAnalysis(memoryId) {
        const analysisContainer = document.querySelector(`.timeline-analysis[data-memory-id="${memoryId}"]`);
        if (!analysisContainer) return;

        const preview = analysisContainer.querySelector('.analysis-preview');
        const full = analysisContainer.querySelector('.analysis-full');
        const button = analysisContainer.querySelector('.expand-btn');

        if (!preview || !full || !button) return;

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

    formatTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    }

    openMemory(memory) {
        // Show confirmation and navigate to the URL
        const domain = new URL(memory.url).hostname;
        const timeAgo = this.formatTimeAgo(new Date(memory.timestamp));
        
        if (confirm(`Visit ${domain} from ${timeAgo}?\n\n${memory.url}`)) {
            this.openUrl(memory.url);
        }
    }

    openUrl(url) {
        chrome.tabs.create({ url: url });
    }

    async shareMemory(memoryId) {
        const memory = this.memories.find(m => m.id === memoryId);
        if (!memory) return;

        try {
            await navigator.clipboard.writeText(`${memory.url}\n\n${memory.analysis}`);
            this.showNotification('Memory copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy memory:', error);
            this.showNotification('Failed to copy memory');
        }
    }

    async deleteMemory(memoryId) {
        if (!confirm('Delete this memory?')) return;

        try {
            // Remove from local array
            this.memories = this.memories.filter(m => m.id !== memoryId);
            this.filteredMemories = this.filteredMemories.filter(m => m.id !== memoryId);

            // Update storage
            await chrome.runtime.sendMessage({
                type: 'DELETE_MEMORY',
                data: memoryId
            });

            this.updateStats();
            this.render();
            this.showNotification('Memory deleted');
        } catch (error) {
            console.error('Failed to delete memory:', error);
            this.showNotification('Failed to delete memory');
        }
    }

    renderAgentDetails(orchestrationResult) {
        const textAgent = orchestrationResult.agentResults.text;
        const visionAgent = orchestrationResult.agentResults.vision;
        const processingTime = orchestrationResult.orchestrationMetadata.processingTime;
        const qualityMetrics = orchestrationResult.qualityMetrics;

        return `
            <div class="agent-details">
                <h4>🤖 Multi-Agent Analysis Details</h4>
                
                <div class="agent-section">
                    <h5>📝 Text Analysis Agent</h5>
                    ${textAgent && !textAgent.error ? `
                        <div class="agent-result">
                            <p><strong>Content Type:</strong> ${textAgent.textAnalysis?.metadata?.contentType || 'general'}</p>
                            <p><strong>Page Type:</strong> ${textAgent.textAnalysis?.metadata?.pageType || 'page'}</p>
                            <p><strong>Word Count:</strong> ${textAgent.rawContent?.extracted?.metrics?.wordCount || 'N/A'}</p>
                            <p><strong>Confidence:</strong> ${(textAgent.confidence * 100).toFixed(0)}%</p>
                        </div>
                    ` : `<p class="agent-error">❌ Text analysis failed: ${textAgent?.errorMessage || 'Unknown error'}</p>`}
                </div>

                <div class="agent-section">
                    <h5>👁️ Vision Analysis Agent</h5>
                    ${visionAgent && !visionAgent.error ? `
                        <div class="agent-result">
                            <p><strong>Analysis Types:</strong> ${visionAgent.visionAnalysis?.individualAnalyses?.map(a => a.type).join(', ') || 'N/A'}</p>
                            <p><strong>Spatial Features:</strong> Layout: ${visionAgent.visionAnalysis?.spatialData?.layout ? 'Detected' : 'Not detected'}</p>
                            <p><strong>Visual Features:</strong> ${visionAgent.visionAnalysis?.visualFeatures?.designStyle || 'standard'} design</p>
                            <p><strong>Confidence:</strong> ${(visionAgent.confidence * 100).toFixed(0)}%</p>
                        </div>
                    ` : `<p class="agent-error">❌ Vision analysis failed: ${visionAgent?.errorMessage || 'Unknown error'}</p>`}
                </div>

                <div class="agent-section">
                    <h5>🎭 Orchestrator Synthesis</h5>
                    <div class="orchestrator-metrics">
                        <p><strong>Processing Time:</strong> ${(processingTime / 1000).toFixed(1)}s</p>
                        <p><strong>Overall Quality:</strong> ${(qualityMetrics.overallScore * 100).toFixed(0)}%</p>
                        <p><strong>Agent Agreement:</strong> ${(orchestrationResult.orchestratorSynthesis.agentAgreement * 100).toFixed(0)}%</p>
                        <p><strong>Synthesis Approach:</strong> ${orchestrationResult.orchestrationMetadata.synthesisApproach}</p>
                        ${orchestrationResult.orchestrationMetadata.conflictsResolved > 0 ? 
                            `<p><strong>Conflicts Resolved:</strong> ${orchestrationResult.orchestrationMetadata.conflictsResolved}</p>` : ''
                        }
                    </div>
                </div>
            </div>
        `;
    }

    showAgentDetails(memoryId) {
        const memory = this.memories.find(m => m.id === memoryId);
        if (!memory || !memory.orchestrationResult) {
            this.showNotification('No agent details available for this memory');
            return;
        }

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 24px;
            border-radius: 8px;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            margin: 20px;
        `;
        
        content.innerHTML = `
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 16px;">
                <h3>🤖 Multi-Agent Analysis Details</h3>
                <button id="closeModal" style="background: none; border: none; font-size: 24px; cursor: pointer; margin-left: auto;">&times;</button>
            </div>
            <div style="margin-bottom: 16px;">
                <strong>URL:</strong> ${memory.url}<br>
                <strong>Analyzed:</strong> ${new Date(memory.timestamp).toLocaleString()}
            </div>
            ${this.renderAgentDetails(memory.orchestrationResult)}
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Close handlers
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        content.querySelector('#closeModal').addEventListener('click', () => modal.remove());
        
        // ESC key handler
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    showNotification(message) {
        // Simple notification - could be enhanced
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            font-size: 14px;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize timeline when page loads
let memoryTimeline;
document.addEventListener('DOMContentLoaded', () => {
    memoryTimeline = new MemoryTimeline();
});
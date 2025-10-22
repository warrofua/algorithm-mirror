/**
 * Semantic Tensor Memory System
 * Advanced memory storage with multi-modal embeddings, semantic search, and relationship discovery
 */

class SemanticTensorMemory {
    constructor(maxMemories = 100) {
        this.maxMemories = maxMemories;
        this.memoryStore = new Map();
        this.embeddingIndex = new Map();
        this.conceptClusters = new Map();
        this.temporalIndex = new Map();
        this.relationshipGraph = new Map();
        this.conversationHistory = [];
        this.systemId = `tensor-memory-${Date.now()}`;
        
        // Initialize indices
        this.initializeIndices();
    }

    initializeIndices() {
        // Temporal buckets for time-based queries
        this.temporalBuckets = {
            hour: new Map(),
            day: new Map(),
            week: new Map(),
            month: new Map()
        };
        
        // Semantic categories
        this.semanticCategories = new Map();
        
        // Domain clusters
        this.domainClusters = new Map();
        
        console.log(`🧠 Semantic Tensor Memory ${this.systemId} initialized`);
    }

    /**
     * Store orchestration result in semantic memory
     */
    async storeMemory(orchestrationResult) {
        const memoryId = `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            // Create comprehensive memory entry
            const memoryEntry = this.createMemoryEntry(memoryId, orchestrationResult);
            
            // Store in main memory
            this.memoryStore.set(memoryId, memoryEntry);
            
            // Index embeddings
            await this.indexEmbeddings(memoryId, memoryEntry);
            
            // Update temporal indices
            this.updateTemporalIndices(memoryId, memoryEntry);
            
            // Update semantic categories
            this.updateSemanticCategories(memoryId, memoryEntry);
            
            // Update domain clusters
            this.updateDomainClusters(memoryId, memoryEntry);
            
            // Discover relationships
            await this.discoverRelationships(memoryId, memoryEntry);
            
            // Update concept clusters
            await this.updateConceptClusters(memoryId, memoryEntry);
            
            // Maintain memory limits
            this.maintainMemoryLimits();
            
            console.log(`💾 Stored memory ${memoryId} for ${orchestrationResult.url}`);
            
            return {
                memoryId,
                stored: true,
                relationships: this.relationshipGraph.get(memoryId)?.length || 0,
                clusters: this.getMemoryClusters(memoryId).length
            };
            
        } catch (error) {
            console.error(`❌ Failed to store memory:`, error);
            return {
                memoryId: null,
                stored: false,
                error: error.message
            };
        }
    }

    createMemoryEntry(memoryId, orchestrationResult) {
        const textSummary = orchestrationResult.agentResults.text?.textAnalysis?.summary?.substring(0, 200);
        const textSummaryWithEllipsis = textSummary ? `${textSummary}...` : '';
        const visionSynthesis = orchestrationResult.agentResults.vision?.visionAnalysis?.synthesis?.substring(0, 200);
        const visionSynthesisWithEllipsis = visionSynthesis ? `${visionSynthesis}...` : '';
        const orchestratorAnalysis = orchestrationResult.orchestratorSynthesis?.unifiedAnalysis?.substring(0, 200);
        const orchestratorAnalysisWithEllipsis = orchestratorAnalysis ? `${orchestratorAnalysis}...` : '';

        const entry = {
            // Core metadata
            memoryId,
            timestamp: orchestrationResult.timestamp,
            url: orchestrationResult.url,
            domain: this.extractDomain(orchestrationResult.url),
            
            // Agent outputs (summary only to save space)
            agentOutputs: {
                text: {
                    summary: textSummaryWithEllipsis,
                    confidence: orchestrationResult.agentResults.text?.confidence || 0
                },
                vision: {
                    synthesis: visionSynthesisWithEllipsis,
                    confidence: orchestrationResult.agentResults.vision?.confidence || 0
                },
                orchestrator: {
                    unifiedAnalysis: orchestratorAnalysisWithEllipsis,
                    confidence: orchestrationResult.orchestratorSynthesis?.confidence || 0
                }
            },
            
            // Embeddings tensor (removed to save space)
            embeddingsTensor: {
                unified: null, // Embeddings removed to save storage space
                text: null,
                vision: null,
                dimension: 0
            },
            
            // Semantic features
            semanticFeatures: {
                contentType: this.extractContentType(orchestrationResult),
                pageType: this.extractPageType(orchestrationResult),
                topics: this.extractTopics(orchestrationResult),
                categories: this.extractCategories(orchestrationResult),
                quality: orchestrationResult.qualityMetrics.overallScore,
                confidence: orchestrationResult.orchestratorSynthesis.confidence
            },
            
            // Spatial and visual features (simplified)
            spatialFeatures: {},
            visualFeatures: {},
            
            // Temporal features
            temporalFeatures: {
                hour: new Date(orchestrationResult.timestamp).getHours(),
                dayOfWeek: new Date(orchestrationResult.timestamp).getDay(),
                month: new Date(orchestrationResult.timestamp).getMonth(),
                season: this.getSeason(new Date(orchestrationResult.timestamp))
            },
            
            // Analysis provenance (for auditability)
            provenance: {
                agentVersions: {
                    text: orchestrationResult.agentResults.text?.agentId || null,
                    vision: orchestrationResult.agentResults.vision?.agentId || null,
                    orchestrator: orchestrationResult.agentId
                },
                processingTime: orchestrationResult.orchestrationMetadata.processingTime,
                synthesisApproach: orchestrationResult.orchestrationMetadata.synthesisApproach,
                qualityMetrics: orchestrationResult.qualityMetrics,
                agentAgreement: orchestrationResult.orchestratorSynthesis.agentAgreement
            },
            
            // Conversation traces (for auditability)
            conversationTrace: {
                textReasoning: orchestrationResult.agentResults.text?.reasoning || {},
                visionReasoning: orchestrationResult.agentResults.vision?.reasoning || {},
                orchestrationReasoning: orchestrationResult.orchestratorSynthesis.decisionRationale
            }
        };
        
        return entry;
    }

    /**
     * Index embeddings for similarity search
     */
    async indexEmbeddings(memoryId, memoryEntry) {
        const embeddings = memoryEntry.embeddingsTensor;
        
        // Index unified embeddings
        if (embeddings.unified) {
            this.embeddingIndex.set(memoryId, {
                unified: embeddings.unified,
                text: embeddings.text,
                vision: embeddings.vision,
                dimension: embeddings.dimension
            });
        }
        
        // Create embedding buckets for faster search
        const bucketKey = this.calculateEmbeddingBucket(embeddings.unified);
        if (!this.embeddingBuckets) this.embeddingBuckets = new Map();
        
        if (!this.embeddingBuckets.has(bucketKey)) {
            this.embeddingBuckets.set(bucketKey, new Set());
        }
        this.embeddingBuckets.get(bucketKey).add(memoryId);
    }

    calculateEmbeddingBucket(embedding) {
        if (!embedding || !Array.isArray(embedding)) return 'default';
        
        // Simple hash-based bucketing for faster similarity search
        const sum = embedding.reduce((acc, val) => acc + val, 0);
        const bucket = Math.floor(sum * 100) % 100;
        return bucket.toString();
    }

    updateTemporalIndices(memoryId, memoryEntry) {
        const timestamp = memoryEntry.timestamp;
        const date = new Date(timestamp);
        
        // Hour bucket
        const hourKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
        this.addToTemporalBucket('hour', hourKey, memoryId);
        
        // Day bucket
        const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        this.addToTemporalBucket('day', dayKey, memoryId);
        
        // Week bucket
        const weekKey = `${date.getFullYear()}-${this.getWeekNumber(date)}`;
        this.addToTemporalBucket('week', weekKey, memoryId);
        
        // Month bucket
        const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
        this.addToTemporalBucket('month', monthKey, memoryId);
    }

    addToTemporalBucket(bucketType, key, memoryId) {
        if (!this.temporalBuckets[bucketType].has(key)) {
            this.temporalBuckets[bucketType].set(key, new Set());
        }
        this.temporalBuckets[bucketType].get(key).add(memoryId);
    }

    updateSemanticCategories(memoryId, memoryEntry) {
        const categories = memoryEntry.semanticFeatures.categories;
        
        categories.forEach(category => {
            if (!this.semanticCategories.has(category)) {
                this.semanticCategories.set(category, new Set());
            }
            this.semanticCategories.get(category).add(memoryId);
        });
    }

    updateDomainClusters(memoryId, memoryEntry) {
        const domain = memoryEntry.domain;
        
        if (!this.domainClusters.has(domain)) {
            this.domainClusters.set(domain, new Set());
        }
        this.domainClusters.get(domain).add(memoryId);
    }

    /**
     * Discover relationships between memories
     */
    async discoverRelationships(memoryId, memoryEntry) {
        const relationships = [];
        
        // Domain relationships
        const domainRelated = this.findDomainRelatedMemories(memoryEntry.domain, memoryId);
        relationships.push(...domainRelated.map(id => ({ type: 'domain-related', targetId: id, strength: 0.7 })));
        
        // Semantic relationships
        const semanticRelated = await this.findSemanticallySimilarMemories(memoryEntry, memoryId);
        relationships.push(...semanticRelated);
        
        // Temporal relationships
        const temporalRelated = this.findTemporallyRelatedMemories(memoryEntry.timestamp, memoryId);
        relationships.push(...temporalRelated.map(id => ({ type: 'temporal-related', targetId: id, strength: 0.5 })));
        
        // Visual similarity relationships
        if (memoryEntry.embeddingsTensor.vision) {
            const visuallyRelated = await this.findVisuallySimilarMemories(memoryEntry, memoryId);
            relationships.push(...visuallyRelated);
        }
        
        this.relationshipGraph.set(memoryId, relationships);
        
        // Update reverse relationships
        relationships.forEach(rel => {
            if (!this.relationshipGraph.has(rel.targetId)) {
                this.relationshipGraph.set(rel.targetId, []);
            }
            this.relationshipGraph.get(rel.targetId).push({
                type: rel.type + '-reverse',
                targetId: memoryId,
                strength: rel.strength
            });
        });
    }

    findDomainRelatedMemories(domain, excludeId) {
        const domainMemories = this.domainClusters.get(domain) || new Set();
        return Array.from(domainMemories).filter(id => id !== excludeId).slice(0, 5);
    }

    async findSemanticallySimilarMemories(memoryEntry, excludeId) {
        const similarities = [];
        const targetEmbedding = memoryEntry.embeddingsTensor.unified;
        
        if (!targetEmbedding) return similarities;
        
        // Search through embedding index
        for (const [memoryId, embeddings] of this.embeddingIndex.entries()) {
            if (memoryId === excludeId) continue;
            
            if (embeddings.unified) {
                const similarity = this.calculateCosineSimilarity(targetEmbedding, embeddings.unified);
                
                if (similarity > 0.7) {
                    similarities.push({
                        type: 'semantic-similar',
                        targetId: memoryId,
                        strength: similarity
                    });
                }
            }
        }
        
        return similarities.sort((a, b) => b.strength - a.strength).slice(0, 5);
    }

    findTemporallyRelatedMemories(timestamp, excludeId) {
        const related = [];
        const date = new Date(timestamp);
        
        // Find memories from same day
        const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        const sameDay = this.temporalBuckets.day.get(dayKey) || new Set();
        
        Array.from(sameDay).forEach(id => {
            if (id !== excludeId) related.push(id);
        });
        
        return related.slice(0, 3);
    }

    async findVisuallySimilarMemories(memoryEntry, excludeId) {
        const similarities = [];
        const targetVisionEmbedding = memoryEntry.embeddingsTensor.vision;
        
        if (!targetVisionEmbedding) return similarities;
        
        for (const [memoryId, embeddings] of this.embeddingIndex.entries()) {
            if (memoryId === excludeId) continue;
            
            if (embeddings.vision) {
                const similarity = this.calculateCosineSimilarity(targetVisionEmbedding, embeddings.vision);
                
                if (similarity > 0.8) {
                    similarities.push({
                        type: 'visual-similar',
                        targetId: memoryId,
                        strength: similarity
                    });
                }
            }
        }
        
        return similarities.sort((a, b) => b.strength - a.strength).slice(0, 3);
    }

    /**
     * Update concept clusters using embedding analysis
     */
    async updateConceptClusters(memoryId, memoryEntry) {
        const embedding = memoryEntry.embeddingsTensor.unified;
        if (!embedding) return;
        
        // Find or create concept cluster
        const clusterId = await this.findOrCreateConceptCluster(embedding, memoryEntry.semanticFeatures);
        
        // Add memory to cluster
        if (!this.conceptClusters.has(clusterId)) {
            this.conceptClusters.set(clusterId, {
                id: clusterId,
                centroid: [...embedding],
                members: new Set(),
                concept: this.inferConceptFromFeatures(memoryEntry.semanticFeatures),
                lastUpdated: Date.now()
            });
        }
        
        const cluster = this.conceptClusters.get(clusterId);
        cluster.members.add(memoryId);
        
        // Update centroid
        this.updateClusterCentroid(clusterId);
    }

    async findOrCreateConceptCluster(embedding, semanticFeatures) {
        const threshold = 0.85;
        
        // Check existing clusters
        for (const [clusterId, cluster] of this.conceptClusters.entries()) {
            const similarity = this.calculateCosineSimilarity(embedding, cluster.centroid);
            if (similarity > threshold) {
                return clusterId;
            }
        }
        
        // Create new cluster
        return `cluster-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    updateClusterCentroid(clusterId) {
        const cluster = this.conceptClusters.get(clusterId);
        if (!cluster || cluster.members.size === 0) return;
        
        const embeddings = [];
        cluster.members.forEach(memoryId => {
            const memoryEmbedding = this.embeddingIndex.get(memoryId)?.unified;
            if (memoryEmbedding) embeddings.push(memoryEmbedding);
        });
        
        if (embeddings.length === 0) return;
        
        // Calculate average (centroid)
        const dimension = embeddings[0].length;
        const centroid = new Array(dimension).fill(0);
        
        embeddings.forEach(embedding => {
            embedding.forEach((value, index) => {
                centroid[index] += value;
            });
        });
        
        centroid.forEach((value, index) => {
            centroid[index] = value / embeddings.length;
        });
        
        cluster.centroid = centroid;
        cluster.lastUpdated = Date.now();
    }

    /**
     * Semantic search capabilities
     */
    async searchMemories(query, options = {}) {
        const {
            limit = 10,
            threshold = 0.7,
            includeRelationships = true,
            temporalFilter = null,
            domainFilter = null,
            categoryFilter = null
        } = options;
        
        console.log(`🔍 Searching memories for: "${query}"`);
        
        try {
            // Generate query embedding
            const queryEmbedding = await this.generateQueryEmbedding(query);
            
            // Find similar memories
            const similarities = this.findSimilarMemories(queryEmbedding, threshold);
            
            // Apply filters
            let filteredResults = this.applyFilters(similarities, {
                temporalFilter,
                domainFilter,
                categoryFilter
            });
            
            // Rank and limit results
            filteredResults = filteredResults
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);
            
            // Enhance with relationships if requested
            if (includeRelationships) {
                filteredResults = this.enhanceWithRelationships(filteredResults);
            }
            
            return {
                query,
                results: filteredResults,
                totalFound: filteredResults.length,
                searchMetrics: {
                    queryEmbeddingGenerated: !!queryEmbedding,
                    memoryStoreSize: this.memoryStore.size,
                    averageSimilarity: filteredResults.reduce((sum, r) => sum + r.similarity, 0) / filteredResults.length
                }
            };
            
        } catch (error) {
            console.error(`❌ Search failed:`, error);
            return {
                query,
                results: [],
                totalFound: 0,
                error: error.message
            };
        }
    }

    async generateQueryEmbedding(query) {
        try {
            const response = await fetch('http://localhost:8081/api/embeddings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'nomic-embed-text',
                    prompt: query
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.embedding;
            }
        } catch (error) {
            console.error('Query embedding generation failed:', error);
        }
        
        return null;
    }

    findSimilarMemories(queryEmbedding, threshold) {
        if (!queryEmbedding) return [];
        
        const similarities = [];
        
        for (const [memoryId, embeddings] of this.embeddingIndex.entries()) {
            if (embeddings.unified) {
                const similarity = this.calculateCosineSimilarity(queryEmbedding, embeddings.unified);
                
                if (similarity >= threshold) {
                    const memory = this.memoryStore.get(memoryId);
                    similarities.push({
                        memoryId,
                        similarity,
                        memory: memory,
                        url: memory.url,
                        timestamp: memory.timestamp,
                        summary: this.generateMemorySummary(memory)
                    });
                }
            }
        }
        
        return similarities;
    }

    applyFilters(results, filters) {
        let filtered = results;
        
        // Domain filter
        if (filters.domainFilter) {
            filtered = filtered.filter(r => r.memory.domain === filters.domainFilter);
        }
        
        // Category filter
        if (filters.categoryFilter) {
            filtered = filtered.filter(r => 
                r.memory.semanticFeatures.categories.includes(filters.categoryFilter)
            );
        }
        
        // Temporal filter
        if (filters.temporalFilter) {
            const { start, end } = filters.temporalFilter;
            filtered = filtered.filter(r => 
                r.memory.timestamp >= start && r.memory.timestamp <= end
            );
        }
        
        return filtered;
    }

    enhanceWithRelationships(results) {
        return results.map(result => {
            const relationships = this.relationshipGraph.get(result.memoryId) || [];
            const relatedMemories = relationships.map(rel => ({
                type: rel.type,
                strength: rel.strength,
                memory: this.memoryStore.get(rel.targetId)
            })).filter(rel => rel.memory);
            
            return {
                ...result,
                relationships: relatedMemories
            };
        });
    }

    generateMemorySummary(memory) {
        const textSummary = memory.agentOutputs.text?.textAnalysis?.summary?.substring(0, 150) || '';
        const visionSummary = memory.agentOutputs.vision?.visionAnalysis?.synthesis?.substring(0, 150) || '';
        const unifiedSummary = memory.agentOutputs.orchestrator?.unifiedAnalysis?.substring(0, 200) || '';
        
        if (unifiedSummary) return unifiedSummary + '...';
        if (textSummary && visionSummary) return `${textSummary}... | ${visionSummary}...`;
        return textSummary || visionSummary || 'No summary available';
    }

    /**
     * Analytics and insights
     */
    generateMemoryAnalytics() {
        const analytics = {
            overview: {
                totalMemories: this.memoryStore.size,
                totalClusters: this.conceptClusters.size,
                totalRelationships: Array.from(this.relationshipGraph.values()).reduce((sum, rels) => sum + rels.length, 0),
                averageConfidence: this.calculateAverageConfidence(),
                memoryDistribution: this.getMemoryDistribution()
            },
            temporal: {
                memoriesThisHour: this.getMemoriesInTimeRange('hour'),
                memoriesToday: this.getMemoriesInTimeRange('day'),
                memoriesThisWeek: this.getMemoriesInTimeRange('week'),
                memoriesThisMonth: this.getMemoriesInTimeRange('month')
            },
            semantic: {
                topCategories: this.getTopCategories(),
                topDomains: this.getTopDomains(),
                conceptClusters: this.getConceptClusterSummary()
            },
            quality: {
                highQualityMemories: this.getHighQualityMemoriesCount(),
                averageProcessingTime: this.getAverageProcessingTime(),
                agentSuccessRates: this.getAgentSuccessRates()
            }
        };
        
        return analytics;
    }

    calculateAverageConfidence() {
        const confidences = Array.from(this.memoryStore.values())
            .map(m => m.semanticFeatures.confidence)
            .filter(c => c > 0);
        
        return confidences.length > 0 ? 
            confidences.reduce((sum, c) => sum + c, 0) / confidences.length : 0;
    }

    getMemoryDistribution() {
        const distribution = {};
        
        Array.from(this.memoryStore.values()).forEach(memory => {
            const contentType = memory.semanticFeatures.contentType;
            distribution[contentType] = (distribution[contentType] || 0) + 1;
        });
        
        return distribution;
    }

    getMemoriesInTimeRange(range) {
        const now = new Date();
        let key;
        
        switch (range) {
            case 'hour':
                key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
                break;
            case 'day':
                key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
                break;
            case 'week':
                key = `${now.getFullYear()}-${this.getWeekNumber(now)}`;
                break;
            case 'month':
                key = `${now.getFullYear()}-${now.getMonth()}`;
                break;
            default:
                return 0;
        }
        
        return this.temporalBuckets[range].get(key)?.size || 0;
    }

    getTopCategories() {
        const categoryCount = new Map();
        
        this.semanticCategories.forEach((memories, category) => {
            categoryCount.set(category, memories.size);
        });
        
        return Array.from(categoryCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([category, count]) => ({ category, count }));
    }

    getTopDomains() {
        const domainCount = new Map();
        
        this.domainClusters.forEach((memories, domain) => {
            domainCount.set(domain, memories.size);
        });
        
        return Array.from(domainCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([domain, count]) => ({ domain, count }));
    }

    getConceptClusterSummary() {
        return Array.from(this.conceptClusters.values()).map(cluster => ({
            id: cluster.id,
            concept: cluster.concept,
            memberCount: cluster.members.size,
            lastUpdated: cluster.lastUpdated
        }));
    }

    /**
     * Utility methods
     */
    calculateCosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        
        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator === 0 ? 0 : dotProduct / denominator;
    }

    extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return 'unknown';
        }
    }

    extractContentType(orchestrationResult) {
        const textMetadata = orchestrationResult.agentResults.text?.textAnalysis?.metadata;
        return textMetadata?.contentType || 'general';
    }

    extractPageType(orchestrationResult) {
        const textMetadata = orchestrationResult.agentResults.text?.textAnalysis?.metadata;
        return textMetadata?.pageType || 'page';
    }

    extractTopics(orchestrationResult) {
        const topics = [];
        
        // From text analysis
        const textSummary = orchestrationResult.agentResults.text?.textAnalysis?.summary || '';
        topics.push(...this.extractTopicsFromText(textSummary));
        
        // From vision analysis
        const visionSynthesis = orchestrationResult.agentResults.vision?.visionAnalysis?.synthesis || '';
        topics.push(...this.extractTopicsFromText(visionSynthesis));
        
        return [...new Set(topics)].slice(0, 10);
    }

    extractTopicsFromText(text) {
        const commonWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
        
        return text.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3 && !commonWords.has(word))
            .slice(0, 5);
    }

    extractCategories(orchestrationResult) {
        const categories = [];
        
        // From text analysis
        const textMetadata = orchestrationResult.agentResults.text?.textAnalysis?.metadata;
        if (textMetadata?.contentType) categories.push(textMetadata.contentType);
        if (textMetadata?.pageType) categories.push(textMetadata.pageType);
        
        // From vision analysis
        const visualFeatures = orchestrationResult.agentResults.vision?.visionAnalysis?.visualFeatures;
        if (visualFeatures?.designStyle) categories.push(visualFeatures.designStyle);
        if (visualFeatures?.userExperience) categories.push(visualFeatures.userExperience);
        
        return [...new Set(categories)];
    }

    getSeason(date) {
        const month = date.getMonth();
        if (month >= 2 && month <= 4) return 'spring';
        if (month >= 5 && month <= 7) return 'summer';
        if (month >= 8 && month <= 10) return 'fall';
        return 'winter';
    }

    getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }

    inferConceptFromFeatures(semanticFeatures) {
        const topics = semanticFeatures.topics.slice(0, 3);
        const contentType = semanticFeatures.contentType;
        return `${contentType}: ${topics.join(', ')}`;
    }

    maintainMemoryLimits() {
        if (this.memoryStore.size <= this.maxMemories) return;
        
        // Remove oldest memories
        const sortedMemories = Array.from(this.memoryStore.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        const toRemove = sortedMemories.slice(0, this.memoryStore.size - this.maxMemories);
        
        toRemove.forEach(([memoryId]) => {
            this.removeMemory(memoryId);
        });
        
        console.log(`🧹 Removed ${toRemove.length} old memories to maintain limit`);
    }

    removeMemory(memoryId) {
        // Remove from main store
        this.memoryStore.delete(memoryId);
        
        // Remove from embedding index
        this.embeddingIndex.delete(memoryId);
        
        // Remove from relationships
        this.relationshipGraph.delete(memoryId);
        
        // Remove references from other relationships
        this.relationshipGraph.forEach(relationships => {
            const index = relationships.findIndex(rel => rel.targetId === memoryId);
            if (index !== -1) relationships.splice(index, 1);
        });
        
        // Remove from clusters
        this.conceptClusters.forEach(cluster => {
            cluster.members.delete(memoryId);
        });
        
        // Remove from temporal indices
        Object.values(this.temporalBuckets).forEach(bucket => {
            bucket.forEach(memories => {
                memories.delete(memoryId);
            });
        });
        
        // Remove from semantic categories
        this.semanticCategories.forEach(memories => {
            memories.delete(memoryId);
        });
        
        // Remove from domain clusters
        this.domainClusters.forEach(memories => {
            memories.delete(memoryId);
        });
    }

    getHighQualityMemoriesCount() {
        return Array.from(this.memoryStore.values())
            .filter(m => m.semanticFeatures.quality > 0.8).length;
    }

    getAverageProcessingTime() {
        const times = Array.from(this.memoryStore.values())
            .map(m => m.provenance.processingTime)
            .filter(t => t > 0);
        
        return times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0;
    }

    getAgentSuccessRates() {
        const textSuccesses = Array.from(this.memoryStore.values()).filter(m => 
            m.agentOutputs.text && !m.agentOutputs.text.error).length;
        const visionSuccesses = Array.from(this.memoryStore.values()).filter(m => 
            m.agentOutputs.vision && !m.agentOutputs.vision.error).length;
        
        const total = this.memoryStore.size;
        
        return {
            text: total > 0 ? textSuccesses / total : 0,
            vision: total > 0 ? visionSuccesses / total : 0
        };
    }

    getMemoryClusters(memoryId) {
        const clusters = [];
        this.conceptClusters.forEach((cluster, clusterId) => {
            if (cluster.members.has(memoryId)) {
                clusters.push({
                    id: clusterId,
                    concept: cluster.concept,
                    memberCount: cluster.members.size
                });
            }
        });
        return clusters;
    }

    // Export methods for persistence
    exportMemoryState() {
        return {
            memories: Array.from(this.memoryStore.entries()),
            embeddings: Array.from(this.embeddingIndex.entries()),
            clusters: Array.from(this.conceptClusters.entries()),
            relationships: Array.from(this.relationshipGraph.entries()),
            systemId: this.systemId,
            exportTimestamp: Date.now()
        };
    }

    importMemoryState(state) {
        this.memoryStore = new Map(state.memories);
        this.embeddingIndex = new Map(state.embeddings);
        this.conceptClusters = new Map(state.clusters);
        this.relationshipGraph = new Map(state.relationships);
        
        // Rebuild indices
        this.rebuildIndices();
        
        console.log(`📥 Imported ${this.memoryStore.size} memories from ${state.exportTimestamp}`);
    }

    rebuildIndices() {
        // Clear existing indices
        this.temporalBuckets = { hour: new Map(), day: new Map(), week: new Map(), month: new Map() };
        this.semanticCategories = new Map();
        this.domainClusters = new Map();
        
        // Rebuild from stored memories
        this.memoryStore.forEach((memory, memoryId) => {
            this.updateTemporalIndices(memoryId, memory);
            this.updateSemanticCategories(memoryId, memory);
            this.updateDomainClusters(memoryId, memory);
        });
    }

    /**
     * Get recent memories for testing
     */
    async getRecentMemories(limit = 10) {
        const memories = Array.from(this.memoryStore.values())
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
        
        return memories;
    }
}

// Export for use in Chrome extension background script
if (typeof globalThis !== 'undefined') {
    globalThis.SemanticTensorMemory = SemanticTensorMemory;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SemanticTensorMemory;
}
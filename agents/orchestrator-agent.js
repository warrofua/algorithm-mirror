/**
 * Orchestrator Agent
 * Coordinates text and vision agents, synthesizes insights, and manages multi-agent workflows
 */

class OrchestratorAgent {
    constructor(ollamaEndpoint = 'http://localhost:8081') {
        this.ollamaEndpoint = ollamaEndpoint;
        this.synthesizerModel = 'llama3.1:8b';
        this.embeddingModel = 'nomic-embed-text';
        this.agentId = `orchestrator-${Date.now()}`;
        this.conversationHistory = [];
        this.agentRegistry = new Map();
        this.activeAnalyses = new Map();
    }

    /**
     * Initialize orchestrator with agents
     */
    initialize(textAgent, visionAgent) {
        this.textAgent = textAgent;
        this.visionAgent = visionAgent;
        
        // Register agents
        this.agentRegistry.set('text', textAgent);
        this.agentRegistry.set('vision', visionAgent);
        
        console.log(`🎯 Orchestrator ${this.agentId} initialized with ${this.agentRegistry.size} agents`);
    }

    /**
     * Main orchestration entry point
     */
    async orchestrateAnalysis(url, htmlContent, screenshot) {
        const orchestrationId = `orchestration-${Date.now()}`;
        console.log(`🎭 Orchestrator starting multi-agent analysis for: ${url}`);
        
        try {
            // Start analysis tracking
            this.activeAnalyses.set(orchestrationId, {
                url,
                startTime: Date.now(),
                status: 'running',
                agents: ['text', 'vision']
            });
            
            // Phase 1: Parallel Agent Execution
            const agentResults = await this.executeAgentsInParallel(url, htmlContent, screenshot);
            
            // Phase 2: Quality Assessment
            const qualityAssessment = this.assessAgentOutputQuality(agentResults);
            
            // Phase 3: Conflict Resolution
            const resolvedInsights = await this.resolveAgentConflicts(agentResults, qualityAssessment);
            
            // Phase 4: Synthesis with error handling
            let unifiedAnalysis = '';
            try {
                unifiedAnalysis = await this.synthesizeAgentOutputs(resolvedInsights, url);
            } catch (error) {
                console.error('Synthesis failed, using fallback:', error);
                unifiedAnalysis = this.generateFallbackSynthesis(resolvedInsights);
            }
            
            // Phase 5: Generate Combined Embeddings with error handling
            let combinedEmbeddings = { unified: null, model: null, dimension: 0, components: {} };
            try {
                combinedEmbeddings = await this.generateCombinedEmbeddings(unifiedAnalysis, agentResults);
            } catch (error) {
                console.error('Combined embedding generation failed:', error);
            }
            
            // Create orchestration result
            const orchestrationResult = {
                orchestrationId,
                agentId: this.agentId,
                agentType: 'orchestrator',
                timestamp: Date.now(),
                url,
                
                // Agent outputs
                agentResults: {
                    text: agentResults.text,
                    vision: agentResults.vision
                },
                
                // Orchestrator outputs
                orchestratorSynthesis: {
                    unifiedAnalysis: unifiedAnalysis,
                    embeddings: combinedEmbeddings.unified,
                    agentAgreement: this.calculateAgentAgreement(agentResults),
                    decisionRationale: this.generateDecisionRationale(agentResults, qualityAssessment),
                    confidence: this.calculateOverallConfidence(agentResults, qualityAssessment)
                },
                
                // Quality metrics
                qualityMetrics: {
                    textQuality: qualityAssessment.text,
                    visionQuality: qualityAssessment.vision,
                    synthesisQuality: qualityAssessment.synthesis,
                    overallScore: qualityAssessment.overall
                },
                
                // Orchestration metadata
                orchestrationMetadata: {
                    processingTime: Date.now() - parseInt(orchestrationId.split('-')[1]),
                    agentCount: this.agentRegistry.size,
                    successfulAgents: Object.values(agentResults).filter(r => !r.error).length,
                    conflictsResolved: resolvedInsights.conflictsCount || 0,
                    synthesisApproach: this.determineSynthesisApproach(agentResults)
                }
            };
            
            // Complete analysis tracking
            this.activeAnalyses.set(orchestrationId, {
                ...this.activeAnalyses.get(orchestrationId),
                status: 'completed',
                endTime: Date.now(),
                result: orchestrationResult
            });
            
            // Log orchestration conversation
            this.logOrchestrationConversation(orchestrationResult);
            
            return orchestrationResult;
            
        } catch (error) {
            console.error(`❌ Orchestration failed:`, error);
            
            // Update analysis tracking
            this.activeAnalyses.set(orchestrationId, {
                ...this.activeAnalyses.get(orchestrationId),
                status: 'failed',
                error: error.message
            });
            
            return this.createErrorOrchestration(orchestrationId, url, error);
        }
    }

    /**
     * Execute text and vision agents in parallel
     */
    async executeAgentsInParallel(url, htmlContent, screenshot) {
        console.log(`🚀 Executing agents in parallel for ${url}`);
        
        const agentPromises = [];
        
        // Text agent analysis
        if (this.textAgent) {
            agentPromises.push(
                this.textAgent.analyzePageContent(url, htmlContent, screenshot)
                    .then(result => ({ type: 'text', result }))
                    .catch(error => ({ type: 'text', error: error.message }))
            );
        }
        
        // Vision agent analysis (only if screenshot is available)
        if (this.visionAgent && screenshot && typeof screenshot === 'string' && screenshot.length > 0) {
            agentPromises.push(
                this.visionAgent.analyzeScreenshot(url, screenshot, htmlContent?.substring(0, 500))
                    .then(result => ({ type: 'vision', result }))
                    .catch(error => ({ type: 'vision', error: error.message }))
            );
        } else {
            console.log('⚠️ Skipping vision analysis - no valid screenshot available');
        }
        
        // Wait for all agents to complete
        const results = await Promise.allSettled(agentPromises);
        
        // Process results
        const agentResults = {};
        results.forEach(result => {
            if (result.status === 'fulfilled') {
                const { type, result: agentResult, error } = result.value;
                agentResults[type] = error ? { error: true, message: error } : agentResult;
            } else {
                // Handle promise rejection
                console.error(`Agent execution failed:`, result.reason);
            }
        });
        
        return agentResults;
    }

    /**
     * Assess quality of agent outputs
     */
    assessAgentOutputQuality(agentResults) {
        const assessment = {
            text: this.assessTextQuality(agentResults.text),
            vision: this.assessVisionQuality(agentResults.vision),
            overall: 0
        };
        
        // Calculate overall quality
        const validAssessments = Object.values(assessment).filter(score => score > 0);
        assessment.overall = validAssessments.length > 0 ? 
            validAssessments.reduce((sum, score) => sum + score, 0) / validAssessments.length : 0;
            
        // Assess synthesis potential
        assessment.synthesis = this.assessSynthesisPotential(agentResults);
        
        return assessment;
    }

    assessTextQuality(textResult) {
        if (!textResult || textResult.error) return 0;
        
        let score = 0.5; // Base score
        
        // Check content richness
        if (textResult.textAnalysis?.summary?.length > 100) score += 0.2;
        if (textResult.rawContent?.extracted?.headings?.length > 0) score += 0.1;
        if (textResult.rawContent?.extracted?.paragraphs?.length > 2) score += 0.1;
        if (textResult.textAnalysis?.embeddings) score += 0.1;
        
        // Check confidence
        if (textResult.confidence > 0.7) score += 0.1;
        else if (textResult.confidence < 0.3) score -= 0.2;
        
        return Math.max(0, Math.min(1, score));
    }

    assessVisionQuality(visionResult) {
        if (!visionResult || visionResult.error) return 0;
        
        let score = 0.5; // Base score
        
        // Check analysis completeness
        const analyses = visionResult.visionAnalysis?.individualAnalyses || [];
        score += (analyses.filter(a => !a.error).length / 4) * 0.3; // 4 analysis types
        
        // Check synthesis quality
        if (visionResult.visionAnalysis?.synthesis?.length > 200) score += 0.1;
        if (visionResult.visionAnalysis?.spatialData) score += 0.1;
        if (visionResult.visionAnalysis?.embeddings) score += 0.1;
        
        // Check confidence
        if (visionResult.confidence > 0.7) score += 0.1;
        else if (visionResult.confidence < 0.3) score -= 0.2;
        
        return Math.max(0, Math.min(1, score));
    }

    assessSynthesisPotential(agentResults) {
        let potential = 0;
        
        // Check if both agents succeeded
        const textSuccess = agentResults.text && !agentResults.text.error;
        const visionSuccess = agentResults.vision && !agentResults.vision.error;
        
        if (textSuccess && visionSuccess) potential += 0.5;
        else if (textSuccess || visionSuccess) potential += 0.3;
        
        // Check complementary information
        if (textSuccess && visionSuccess) {
            potential += this.assessComplementarity(agentResults.text, agentResults.vision);
        }
        
        return Math.max(0, Math.min(1, potential));
    }

    assessComplementarity(textResult, visionResult) {
        let complementarity = 0;
        
        const textSummary = textResult.textAnalysis?.summary?.toLowerCase() || '';
        const visionSynthesis = visionResult.visionAnalysis?.synthesis?.toLowerCase() || '';
        
        // Look for complementary insights
        if (textSummary.includes('form') && visionSynthesis.includes('form')) complementarity += 0.1;
        if (textSummary.includes('navigation') && visionSynthesis.includes('navigation')) complementarity += 0.1;
        if (textSummary.includes('content') && visionSynthesis.includes('content')) complementarity += 0.1;
        
        // Look for unique insights
        const textTopics = this.extractTopics(textSummary);
        const visionTopics = this.extractTopics(visionSynthesis);
        const uniqueInsights = new Set([...textTopics, ...visionTopics]).size;
        
        if (uniqueInsights > 5) complementarity += 0.2;
        
        return Math.max(0, Math.min(0.5, complementarity));
    }

    extractTopics(text) {
        const commonWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
        
        return text.split(/\s+/)
            .filter(word => word.length > 3 && !commonWords.has(word.toLowerCase()))
            .slice(0, 10);
    }

    /**
     * Resolve conflicts between agent outputs
     */
    async resolveAgentConflicts(agentResults, qualityAssessment) {
        const conflicts = this.identifyConflicts(agentResults);
        
        if (conflicts.length === 0) {
            return {
                resolvedResults: agentResults,
                conflictsCount: 0,
                resolutionStrategy: 'no-conflicts'
            };
        }
        
        console.log(`🔧 Resolving ${conflicts.length} agent conflicts`);
        
        const resolutionStrategy = this.determineResolutionStrategy(conflicts, qualityAssessment);
        const resolvedResults = await this.applyResolutionStrategy(agentResults, conflicts, resolutionStrategy);
        
        return {
            resolvedResults,
            conflictsCount: conflicts.length,
            resolutionStrategy,
            conflicts
        };
    }

    identifyConflicts(agentResults) {
        const conflicts = [];
        
        if (!agentResults.text || !agentResults.vision || 
            agentResults.text.error || agentResults.vision.error) {
            return conflicts; // Can't identify conflicts without both results
        }
        
        const textContent = agentResults.text.textAnalysis?.summary?.toLowerCase() || '';
        const visionContent = agentResults.vision.visionAnalysis?.synthesis?.toLowerCase() || '';
        
        // Check for contradictory assessments
        if (textContent.includes('professional') && visionContent.includes('poor quality')) {
            conflicts.push({
                type: 'quality-assessment',
                textView: 'professional',
                visionView: 'poor quality',
                severity: 'medium'
            });
        }
        
        if (textContent.includes('simple') && visionContent.includes('complex')) {
            conflicts.push({
                type: 'complexity-assessment',
                textView: 'simple',
                visionView: 'complex',
                severity: 'low'
            });
        }
        
        // Check confidence discrepancy
        const confidenceDiff = Math.abs(agentResults.text.confidence - agentResults.vision.confidence);
        if (confidenceDiff > 0.4) {
            conflicts.push({
                type: 'confidence-discrepancy',
                textConfidence: agentResults.text.confidence,
                visionConfidence: agentResults.vision.confidence,
                severity: 'high'
            });
        }
        
        return conflicts;
    }

    determineResolutionStrategy(conflicts, qualityAssessment) {
        const highSeverityConflicts = conflicts.filter(c => c.severity === 'high').length;
        
        if (highSeverityConflicts > 0) {
            // Use higher quality agent for resolution
            return qualityAssessment.text > qualityAssessment.vision ? 'trust-text' : 'trust-vision';
        }
        
        // For low-medium conflicts, synthesize
        return 'synthesize-differences';
    }

    async applyResolutionStrategy(agentResults, conflicts, strategy) {
        switch (strategy) {
            case 'trust-text':
                return {
                    ...agentResults,
                    resolutionNote: 'Conflicts resolved by prioritizing text analysis due to higher quality'
                };
                
            case 'trust-vision':
                return {
                    ...agentResults,
                    resolutionNote: 'Conflicts resolved by prioritizing vision analysis due to higher quality'
                };
                
            case 'synthesize-differences':
                return {
                    ...agentResults,
                    resolutionNote: 'Conflicts noted and preserved for synthesis',
                    conflictSynthesis: await this.synthesizeConflicts(conflicts, agentResults)
                };
                
            default:
                return agentResults;
        }
    }

    async synthesizeConflicts(conflicts, agentResults) {
        const conflictSummary = conflicts.map(c => 
            `${c.type}: Text sees "${c.textView || 'unknown'}", Vision sees "${c.visionView || 'unknown'}"`
        ).join('; ');
        
        return `Agent perspective differences: ${conflictSummary}. These differences provide complementary viewpoints for a fuller understanding.`;
    }

    /**
     * Synthesize agent outputs into unified analysis
     */
    async synthesizeAgentOutputs(resolvedInsights, url) {
        const { resolvedResults } = resolvedInsights;
        
        console.log(`🔬 Synthesizing agent outputs for unified analysis`);
        
        // Prepare synthesis input
        const synthesisInput = this.prepareSynthesisInput(resolvedResults, resolvedInsights);
        
        // Generate unified analysis using LLM
        const unifiedAnalysis = await this.generateUnifiedAnalysis(synthesisInput, url);
        
        return unifiedAnalysis;
    }

    prepareSynthesisInput(agentResults, insights) {
        let input = '';
        
        // Add text analysis
        if (agentResults.text && !agentResults.text.error) {
            input += `TEXT ANALYSIS:\n${agentResults.text.textAnalysis?.summary || 'No text summary available'}\n\n`;
            
            if (agentResults.text.textAnalysis?.metadata) {
                input += `Text Metadata: ${JSON.stringify(agentResults.text.textAnalysis.metadata, null, 2)}\n\n`;
            }
        }
        
        // Add vision analysis
        if (agentResults.vision && !agentResults.vision.error) {
            input += `VISION ANALYSIS:\n${agentResults.vision.visionAnalysis?.synthesis || 'No vision synthesis available'}\n\n`;
            
            if (agentResults.vision.visionAnalysis?.spatialData) {
                input += `Spatial Features: ${JSON.stringify(agentResults.vision.visionAnalysis.spatialData, null, 2)}\n\n`;
            }
        }
        
        // Add conflict resolution notes
        if (insights.resolutionStrategy !== 'no-conflicts') {
            input += `CONFLICT RESOLUTION:\n${insights.resolutionStrategy}\n`;
            if (insights.conflicts) {
                input += `Conflicts: ${insights.conflicts.map(c => c.type).join(', ')}\n\n`;
            }
        }
        
        return input;
    }

    async generateUnifiedAnalysis(synthesisInput, url) {
        const prompt = `You are analyzing content being served to users by online platforms and algorithms.

URL: ${url}

Agent Observations:
${synthesisInput}

Synthesize the observations to describe:
1. What specific content is being displayed to users on this page
2. Any algorithmic feeds, recommendations, or personalized content
3. Advertisements, sponsored posts, or promotional content visible
4. Content that appears to be targeted or customized to users
5. The type of information/content being served by this platform
6. Any evidence of ML algorithms curating or selecting content

Focus on what content users are being shown and how it might be algorithmically determined or personalized.`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes
            
            const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    model: this.synthesizerModel,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.4,
                        num_predict: 600
                    }
                })
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Synthesis failed: ${response.status}`);
            }

            const data = await response.json();
            return data.response || this.generateFallbackSynthesis(synthesisInput);
            
        } catch (error) {
            console.error('Unified analysis generation failed:', error);
            return this.generateFallbackSynthesis(synthesisInput);
        }
    }

    generateFallbackSynthesis(resolvedInsights) {
        let synthesis = 'Unified Analysis (Fallback):\n\n';
        
        // Handle different input structures
        const results = resolvedInsights?.resolvedResults || resolvedInsights || {};
        
        try {
            if (results.text && !results.text.error) {
                const textSummary = results.text.textAnalysis?.summary || results.text.summary || 'No text summary available';
                synthesis += `Text Analysis: ${textSummary.substring(0, 200)}...\n\n`;
            } else {
                synthesis += `Text Analysis: Failed or unavailable\n\n`;
            }
            
            if (results.vision && !results.vision.error) {
                const visionSummary = results.vision.visionAnalysis?.synthesis || results.vision.synthesis || 'No vision synthesis available';
                synthesis += `Vision Analysis: ${visionSummary.substring(0, 200)}...\n\n`;
            } else {
                synthesis += `Vision Analysis: Failed or unavailable\n\n`;
            }
        } catch (error) {
            console.error('Error in fallback synthesis:', error);
            synthesis += 'Analysis data unavailable due to processing errors.\n\n';
        }
        
        synthesis += 'Note: This is a basic synthesis due to LLM unavailability.';
        return synthesis;
    }

    /**
     * Generate combined embeddings
     */
    async generateCombinedEmbeddings(unifiedAnalysis, agentResults) {
        const combinedText = `
            Unified Analysis: ${unifiedAnalysis}
            Text Summary: ${agentResults.text?.textAnalysis?.summary || ''}
            Vision Summary: ${agentResults.vision?.visionAnalysis?.synthesis || ''}
        `;

        try {
            const response = await fetch(`${this.ollamaEndpoint}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.embeddingModel,
                    prompt: combinedText
                })
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    unified: data.embedding,
                    model: this.embeddingModel,
                    dimension: data.embedding.length,
                    components: {
                        text: agentResults.text?.textAnalysis?.embeddings || null,
                        vision: agentResults.vision?.visionAnalysis?.embeddings || null
                    }
                };
            }
        } catch (error) {
            console.error('Combined embedding generation failed:', error);
        }
        
        return {
            unified: null,
            model: null,
            dimension: 0,
            components: {
                text: agentResults.text?.textAnalysis?.embeddings || null,
                vision: agentResults.vision?.visionAnalysis?.embeddings || null
            }
        };
    }

    calculateAgentAgreement(agentResults) {
        if (!agentResults.text || !agentResults.vision || 
            agentResults.text.error || agentResults.vision.error) {
            return 0;
        }
        
        const textConfidence = agentResults.text.confidence || 0;
        const visionConfidence = agentResults.vision.confidence || 0;
        
        // Agreement based on confidence similarity
        const confidenceAgreement = 1 - Math.abs(textConfidence - visionConfidence);
        
        // Semantic agreement (simplified)
        const semanticAgreement = this.calculateSemanticAgreement(
            agentResults.text.textAnalysis?.summary || '',
            agentResults.vision.visionAnalysis?.synthesis || ''
        );
        
        return (confidenceAgreement + semanticAgreement) / 2;
    }

    calculateSemanticAgreement(textSummary, visionSynthesis) {
        const textWords = new Set(textSummary.toLowerCase().split(/\s+/));
        const visionWords = new Set(visionSynthesis.toLowerCase().split(/\s+/));
        
        const commonWords = new Set([...textWords].filter(word => visionWords.has(word)));
        const totalWords = new Set([...textWords, ...visionWords]).size;
        
        return totalWords > 0 ? commonWords.size / totalWords : 0;
    }

    generateDecisionRationale(agentResults, qualityAssessment) {
        let rationale = `Orchestration Decision Rationale:\n`;
        
        // Agent performance
        rationale += `Text Agent: ${agentResults.text?.error ? 'Failed' : 'Succeeded'} (Quality: ${(qualityAssessment.text * 100).toFixed(0)}%)\n`;
        rationale += `Vision Agent: ${agentResults.vision?.error ? 'Failed' : 'Succeeded'} (Quality: ${(qualityAssessment.vision * 100).toFixed(0)}%)\n`;
        
        // Synthesis approach
        const approach = this.determineSynthesisApproach(agentResults);
        rationale += `Synthesis Approach: ${approach}\n`;
        
        // Confidence reasoning
        const overallConfidence = this.calculateOverallConfidence(agentResults, qualityAssessment);
        rationale += `Overall Confidence: ${(overallConfidence * 100).toFixed(0)}% based on agent performance and agreement\n`;
        
        return rationale;
    }

    calculateOverallConfidence(agentResults, qualityAssessment) {
        const weights = {
            text: qualityAssessment.text,
            vision: qualityAssessment.vision
        };
        
        let weightedConfidence = 0;
        let totalWeight = 0;
        
        if (agentResults.text && !agentResults.text.error) {
            weightedConfidence += (agentResults.text.confidence || 0) * weights.text;
            totalWeight += weights.text;
        }
        
        if (agentResults.vision && !agentResults.vision.error) {
            weightedConfidence += (agentResults.vision.confidence || 0) * weights.vision;
            totalWeight += weights.vision;
        }
        
        return totalWeight > 0 ? weightedConfidence / totalWeight : 0;
    }

    determineSynthesisApproach(agentResults) {
        const textSuccess = agentResults.text && !agentResults.text.error;
        const visionSuccess = agentResults.vision && !agentResults.vision.error;
        
        if (textSuccess && visionSuccess) return 'multi-modal-synthesis';
        if (textSuccess) return 'text-primary';
        if (visionSuccess) return 'vision-primary';
        return 'fallback';
    }

    logOrchestrationConversation(result) {
        this.conversationHistory.push({
            timestamp: Date.now(),
            type: 'orchestration',
            input: {
                url: result.url,
                agentsUsed: Object.keys(result.agentResults)
            },
            output: {
                synthesis: result.orchestratorSynthesis.unifiedAnalysis.substring(0, 200) + '...',
                confidence: result.orchestratorSynthesis.confidence,
                agentAgreement: result.orchestratorSynthesis.agentAgreement
            },
            metrics: result.qualityMetrics,
            metadata: result.orchestrationMetadata
        });
        
        // Keep last 100 conversations
        if (this.conversationHistory.length > 100) {
            this.conversationHistory = this.conversationHistory.slice(-100);
        }
    }

    createErrorOrchestration(orchestrationId, url, error) {
        return {
            orchestrationId,
            agentId: this.agentId,
            agentType: 'orchestrator',
            timestamp: Date.now(),
            url,
            error: true,
            errorMessage: error.message,
            agentResults: {},
            orchestratorSynthesis: {
                unifiedAnalysis: `Orchestration failed: ${error.message}`,
                embeddings: null,
                agentAgreement: 0,
                decisionRationale: `Error occurred: ${error.message}`,
                confidence: 0
            },
            qualityMetrics: {
                textQuality: 0,
                visionQuality: 0,
                synthesisQuality: 0,
                overallScore: 0
            }
        };
    }

    getOrchestrationStats() {
        const activeCount = Array.from(this.activeAnalyses.values()).filter(a => a.status === 'running').length;
        const completedCount = Array.from(this.activeAnalyses.values()).filter(a => a.status === 'completed').length;
        const failedCount = Array.from(this.activeAnalyses.values()).filter(a => a.status === 'failed').length;
        
        return {
            agentId: this.agentId,
            registeredAgents: Array.from(this.agentRegistry.keys()),
            conversationsCount: this.conversationHistory.length,
            activeAnalyses: activeCount,
            completedAnalyses: completedCount,
            failedAnalyses: failedCount,
            successRate: completedCount / (completedCount + failedCount) || 0,
            avgConfidence: this.conversationHistory.reduce((sum, c) => sum + (c.output.confidence || 0), 0) / this.conversationHistory.length || 0
        };
    }

    getActiveAnalyses() {
        return Array.from(this.activeAnalyses.values());
    }
}

// Export for use in Chrome extension background script
if (typeof globalThis !== 'undefined') {
    globalThis.OrchestratorAgent = OrchestratorAgent;
}
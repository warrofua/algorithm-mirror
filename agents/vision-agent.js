/**
 * Enhanced Vision Agent with Spatial Understanding
 * Analyzes screenshots using LLaVA with advanced visual interpretation
 */

class VisionAgent {
    constructor(config = {}) {
        if (typeof config === 'string') {
            config = { ollamaEndpoint: config };
        }

        const {
            ollamaEndpoint = 'http://localhost:8081',
            embeddingModel = 'nomic-embed-text'
        } = config;

        this.ollamaEndpoint = ollamaEndpoint;
        this.visionModel = 'llava:7b';
        this.embeddingModel = embeddingModel;
    constructor(ollamaEndpoint = 'http://localhost:8081', visionModel = 'llava:7b') {
        this.ollamaEndpoint = ollamaEndpoint;
        this.visionModel = visionModel;
        this.embeddingModel = 'nomic-embed-text';
        this.agentId = `vision-agent-${Date.now()}`;
        this.conversationHistory = [];
    }

    updateEmbeddingConfig({ ollamaEndpoint, embeddingModel } = {}) {
        if (ollamaEndpoint) {
            this.ollamaEndpoint = ollamaEndpoint;
        }
        if (embeddingModel) {
            this.embeddingModel = embeddingModel;
    setVisionModel(visionModel) {
        if (!visionModel || typeof visionModel !== 'string') {
            console.warn('VisionAgent: Invalid vision model provided, keeping existing model.');
            return;
        }

        const normalizedModel = visionModel.trim();
        if (!normalizedModel) {
            console.warn('VisionAgent: Empty vision model provided, keeping existing model.');
            return;
        }

        if (this.visionModel !== normalizedModel) {
            console.log(`🔁 Updating vision model from ${this.visionModel} to ${normalizedModel}`);
            this.visionModel = normalizedModel;
        }
    }

    /**
     * Main entry point for visual analysis
     */
    async analyzeScreenshot(url, screenshot, textContext = null) {
        const analysisId = `vision-analysis-${Date.now()}`;
        console.log(`👁️ Vision Agent ${this.agentId} analyzing screenshot for: ${url}`);
        
        try {
            // Pre-process screenshot
            const imageData = this.preprocessImage(screenshot);
            
            // Generate a single comprehensive analysis to avoid overwhelming Ollama
            console.log('🎯 Performing single comprehensive analysis to avoid overloading Ollama...');
            
            const comprehensiveAnalysis = await this.performComprehensiveAnalysis(imageData, url, textContext);
            const successfulAnalyses = [comprehensiveAnalysis].filter(a => !a.error);

            // Synthesize visual understanding
            const synthesizedAnalysis = this.synthesizeVisualAnalyses(successfulAnalyses);
            
            // Generate embeddings
            const embeddings = await this.generateVisualEmbeddings(synthesizedAnalysis, imageData);
            
            // Extract spatial features
            const spatialData = this.extractSpatialFeatures(synthesizedAnalysis);
            
            const visionAnalysis = {
                analysisId,
                agentId: this.agentId,
                agentType: 'vision-llava',
                timestamp: Date.now(),
                url,
                confidence: this.calculateVisualConfidence(successfulAnalyses),
                
                // Raw data
                rawData: {
                    screenshot: screenshot,
                    imageMetrics: imageData.metrics,
                    processingSteps: ['ui-analysis', 'content-analysis', 'accessibility-analysis', 'design-analysis']
                },
                
                // Analysis outputs
                visionAnalysis: {
                    synthesis: synthesizedAnalysis,
                    individualAnalyses: successfulAnalyses,
                    embeddings: embeddings.vision,
                    spatialData: spatialData,
                    visualFeatures: this.extractVisualFeatures(synthesizedAnalysis)
                },
                
                // Agent reasoning
                reasoning: {
                    model: this.visionModel,
                    analysisTypes: successfulAnalyses.map(a => a.type),
                    confidence: this.calculateVisualConfidence(successfulAnalyses),
                    processingTime: Date.now() - parseInt(analysisId.split('-')[2]),
                    imageQuality: this.assessImageQuality(imageData)
                }
            };
            
            // Log conversation
            this.logVisionConversation(visionAnalysis);
            
            return visionAnalysis;
            
        } catch (error) {
            console.error(`❌ Vision Agent analysis failed:`, error);
            return this.createErrorAnalysis(analysisId, url, error);
        }
    }

    /**
     * Preprocess image for analysis
     */
    preprocessImage(screenshot) {
        if (!screenshot) {
            throw new Error('Screenshot data is null or undefined');
        }
        
        if (typeof screenshot !== 'string') {
            throw new Error(`Screenshot data must be string, got: ${typeof screenshot}`);
        }
        
        if (screenshot.length === 0) {
            throw new Error('Screenshot data is empty string');
        }
        
        // Extract base64 data
        const base64Data = screenshot.includes(',') ? screenshot.split(',')[1] : screenshot;
        
        if (!base64Data || base64Data.length === 0) {
            throw new Error('No base64 data found in screenshot');
        }
        
        // Validate base64 format
        if (!base64Data.match(/^[A-Za-z0-9+/]*={0,2}$/)) {
            throw new Error('Invalid base64 format in screenshot data');
        }
        
        // Calculate image metrics
        const sizeKB = Math.round(base64Data.length * 0.75 / 1024);
        
        console.log(`📊 Screenshot preprocessed: ${sizeKB}KB, ${base64Data.length} chars`);
        
        return {
            base64: base64Data,
            dataUrl: screenshot,
            metrics: {
                sizeKB: sizeKB,
                base64Length: base64Data.length,
                format: 'jpeg',
                quality: 'medium'
            }
        };
    }

    /**
     * Comprehensive Analysis (combines all analysis types into one request)
     */
    async performComprehensiveAnalysis(imageData, url, textContext) {
        const contextInfo = textContext ? `\n\nText Context: ${textContext.slice(0, 500)}` : '';
        
        const prompt = `Analyze this webpage screenshot and describe exactly what content is visible:

URL: ${url}${contextInfo}

Please describe:
1. All visible text content (headlines, body text, labels, buttons, captions)
2. Images and their content/subject matter  
3. Interface elements and navigation
4. Any feeds, posts, articles, or content streams
5. Advertisements, sponsored content, or promotional material
6. Recommended items, suggestions, or personalized content
7. Any content that appears to be algorithmically curated or targeted
8. The overall type and purpose of this webpage
9. How the content is organized and presented to users

Focus on describing what specific content users are being served and shown on this page.`;

        return this.performVisionAnalysis('comprehensive-analysis', prompt, imageData);
    }

    /**
     * UI/UX Analysis
     */
    async performUIAnalysis(imageData, url) {
        const prompt = `Describe exactly what content is visible on this webpage screenshot:

URL: ${url}

List what you can see:
1. All visible text content (headlines, body text, labels, buttons)
2. Images and their apparent content/subject matter
3. Interface elements and their labels
4. Any feeds, posts, or algorithmic content visible
5. Advertisements or sponsored content
6. Recommended items, suggestions, or personalized content
7. Any content that appears to be algorithmically curated

Be factual and descriptive. Focus on what content is being served to users.`;

        return this.performVisionAnalysis('ui-analysis', prompt, imageData);
    }

    /**
     * Content Analysis
     */
    async performContentAnalysis(imageData, url, textContext) {
        const contextInfo = textContext ? `\n\nText Context: ${textContext.slice(0, 500)}` : '';
        
        const prompt = `Describe the specific content visible on this webpage screenshot:

URL: ${url}${contextInfo}

Describe what you see:
1. All readable text, headlines, and captions
2. What images show (people, products, scenes, etc.)
3. Any video content or media players visible
4. Lists, feeds, or streams of content
5. Advertisements and their content
6. Recommended or suggested items
7. Any personalized or targeted content
8. Content that appears to be algorithmically selected

Be specific about the actual content being displayed to users.`;

        return this.performVisionAnalysis('content-analysis', prompt, imageData);
    }

    /**
     * Accessibility Analysis
     */
    async performAccessibilityAnalysis(imageData, url) {
        const prompt = `Describe the visible content and how it's presented on this webpage:

URL: ${url}

Describe:
1. What text content is displayed and how prominent it is
2. What images show and their context
3. How content is organized and grouped
4. Which elements appear to be clickable or interactive
5. Any content that stands out or is emphasized
6. Content that appears to be personalized or recommended
7. Any algorithmic feeds or suggested content visible
8. The overall type and nature of content being served

Focus on describing what users are actually seeing on screen.`;

        return this.performVisionAnalysis('accessibility-analysis', prompt, imageData);
    }

    /**
     * Design Analysis
     */
    async performDesignAnalysis(imageData, url) {
        const prompt = `Describe what content and information is being presented on this webpage:

URL: ${url}

Describe:
1. The main content or information being displayed
2. What type of content this appears to be (news, social media, shopping, etc.)
3. Any feeds, timelines, or content streams visible
4. Specific posts, articles, or items shown
5. Any promotional, sponsored, or advertising content
6. Recommended or suggested content visible
7. Content that appears targeted or personalized
8. The overall purpose and content focus of this page

Be specific about what information and content users are being shown.`;

        return this.performVisionAnalysis('design-analysis', prompt, imageData);
    }

    /**
     * Core vision analysis using LLaVA
     */
    async performVisionAnalysis(analysisType, prompt, imageData) {
        try {
            console.log(`🔄 Starting ${analysisType} with LLaVA...`);
            console.log(`- Model: ${this.visionModel}`);
            console.log(`- Endpoint: ${this.ollamaEndpoint}/api/generate`);
            console.log(`- Image size: ${imageData.metrics.sizeKB}KB`);
            console.log(`- Prompt length: ${prompt.length} chars`);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                console.log(`⏰ ${analysisType} timeout after 3 minutes - aborting request`);
                controller.abort();
            }, 180000); // 3 minutes for vision
            
            const requestStart = Date.now();
            
            const requestBody = {
                model: this.visionModel,
                prompt: prompt,
                images: [imageData.base64],
                stream: false,
                options: {
                    temperature: 0.3,
                    num_predict: 400
                }
            };
            
            console.log(`📤 Sending ${analysisType} request to Ollama...`);
            
            const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(requestBody)
            });
            
            clearTimeout(timeoutId);
            const requestTime = Date.now() - requestStart;
            console.log(`⏱️ ${analysisType} request completed in ${(requestTime/1000).toFixed(1)}s`);

            console.log(`📥 ${analysisType} response status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ ${analysisType} HTTP error response:`, errorText);
                throw new Error(`Vision analysis failed: ${response.status} - ${errorText || 'No error message'}`);
            }

            const data = await response.json();
            console.log(`✅ ${analysisType} completed successfully`);
            console.log(`- Response length: ${data.response ? data.response.length : 'null'} chars`);
            console.log(`- Response preview: ${data.response ? data.response.substring(0, 100) + '...' : 'No response'}`);
            
            const analysis = data.response || `${analysisType} failed to generate response`;
            
            return {
                type: analysisType,
                analysis: analysis,
                confidence: this.calculateAnalysisConfidence(analysis),
                timestamp: Date.now()
            };
            
        } catch (error) {
            console.error(`❌ ${analysisType} failed:`, error);
            
            if (error.name === 'AbortError') {
                console.error(`💀 ${analysisType} was aborted due to timeout`);
            } else if (error.code === 'ECONNRESET' || error.message.includes('socket hang up')) {
                console.error(`🔌 ${analysisType} failed due to connection reset - Ollama may be overloaded`);
            } else if (error.message.includes('fetch')) {
                console.error(`🌐 ${analysisType} failed due to network error`);
            }
            
            return {
                type: analysisType,
                analysis: `${analysisType} failed: ${error.message}`,
                confidence: 0,
                error: true,
                errorType: error.name,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Synthesize multiple visual analyses
     */
    synthesizeVisualAnalyses(analyses) {
        const successful = analyses.filter(a => !a.error);
        
        if (successful.length === 0) {
            return 'All visual analysis components failed. Unable to provide visual interpretation.';
        }

        let synthesis = `Visual Analysis Summary:\n\n`;
        
        // Combine insights from different analysis types
        successful.forEach(analysis => {
            synthesis += `${analysis.type.toUpperCase()}:\n${analysis.analysis}\n\n`;
        });
        
        // Add synthesis conclusion
        synthesis += `VISUAL SYNTHESIS:\n`;
        synthesis += this.generateVisualSynthesis(successful);
        
        return synthesis;
    }

    generateVisualSynthesis(analyses) {
        let synthesis = '';
        
        // Extract common themes
        const commonThemes = this.extractCommonThemes(analyses);
        if (commonThemes.length > 0) {
            synthesis += `Key Visual Themes: ${commonThemes.join(', ')}\n`;
        }
        
        // Overall assessment
        const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;
        synthesis += `Visual Analysis Confidence: ${(avgConfidence * 100).toFixed(0)}%\n`;
        
        // Quality assessment
        const qualityIndicators = this.extractQualityIndicators(analyses);
        synthesis += `Design Quality: ${qualityIndicators.join(', ')}\n`;
        
        return synthesis;
    }

    extractCommonThemes(analyses) {
        const themes = [];
        const allText = analyses.map(a => a.analysis.toLowerCase()).join(' ');
        
        // Look for common design patterns
        if (allText.includes('modern') || allText.includes('clean')) themes.push('modern design');
        if (allText.includes('professional') || allText.includes('business')) themes.push('professional');
        if (allText.includes('colorful') || allText.includes('vibrant')) themes.push('vibrant');
        if (allText.includes('minimal') || allText.includes('simple')) themes.push('minimalist');
        if (allText.includes('complex') || allText.includes('dense')) themes.push('information-dense');
        
        return themes;
    }

    extractQualityIndicators(analyses) {
        const indicators = [];
        const allText = analyses.map(a => a.analysis.toLowerCase()).join(' ');
        
        if (allText.includes('high quality') || allText.includes('professional')) indicators.push('high quality');
        if (allText.includes('good contrast') || allText.includes('readable')) indicators.push('accessible');
        if (allText.includes('consistent') || allText.includes('coherent')) indicators.push('consistent');
        if (allText.includes('responsive') || allText.includes('mobile')) indicators.push('responsive');
        
        return indicators.length > 0 ? indicators : ['standard'];
    }

    /**
     * Extract spatial features from analysis
     */
    extractSpatialFeatures(synthesizedAnalysis) {
        const text = synthesizedAnalysis.toLowerCase();
        
        return {
            layout: {
                hasHeader: text.includes('header') || text.includes('top section'),
                hasNavigation: text.includes('navigation') || text.includes('menu'),
                hasSidebar: text.includes('sidebar') || text.includes('side panel'),
                hasFooter: text.includes('footer') || text.includes('bottom'),
                isMultiColumn: text.includes('column') || text.includes('grid')
            },
            visualHierarchy: {
                hasHeadings: text.includes('heading') || text.includes('title'),
                hasSubsections: text.includes('section') || text.includes('subsection'),
                usesWhitespace: text.includes('whitespace') || text.includes('spacing'),
                hasVisualFocus: text.includes('focal') || text.includes('emphasis')
            },
            interactivity: {
                hasButtons: text.includes('button') || text.includes('clickable'),
                hasForms: text.includes('form') || text.includes('input'),
                hasLinks: text.includes('link') || text.includes('hyperlink'),
                hasDropdowns: text.includes('dropdown') || text.includes('menu')
            },
            contentTypes: {
                hasImages: text.includes('image') || text.includes('photo'),
                hasText: text.includes('text') || text.includes('paragraph'),
                hasVideo: text.includes('video') || text.includes('media'),
                hasCharts: text.includes('chart') || text.includes('graph')
            }
        };
    }

    extractVisualFeatures(synthesizedAnalysis) {
        const text = synthesizedAnalysis.toLowerCase();
        
        return {
            colorScheme: this.detectColorScheme(text),
            designStyle: this.detectDesignStyle(text),
            contentDensity: this.detectContentDensity(text),
            userExperience: this.assessUserExperience(text),
            technicalQuality: this.assessTechnicalQuality(text)
        };
    }

    detectColorScheme(text) {
        if (text.includes('dark') && text.includes('theme')) return 'dark';
        if (text.includes('light') && text.includes('background')) return 'light';
        if (text.includes('colorful') || text.includes('vibrant')) return 'colorful';
        if (text.includes('monochrome') || text.includes('grayscale')) return 'monochrome';
        return 'mixed';
    }

    detectDesignStyle(text) {
        if (text.includes('minimal') || text.includes('clean')) return 'minimalist';
        if (text.includes('modern') || text.includes('contemporary')) return 'modern';
        if (text.includes('traditional') || text.includes('classic')) return 'traditional';
        if (text.includes('creative') || text.includes('artistic')) return 'creative';
        return 'standard';
    }

    detectContentDensity(text) {
        if (text.includes('dense') || text.includes('packed')) return 'high';
        if (text.includes('sparse') || text.includes('minimal')) return 'low';
        return 'medium';
    }

    assessUserExperience(text) {
        let score = 0;
        if (text.includes('intuitive') || text.includes('easy')) score += 2;
        if (text.includes('clear') || text.includes('organized')) score += 1;
        if (text.includes('accessible') || text.includes('readable')) score += 1;
        if (text.includes('confusing') || text.includes('cluttered')) score -= 2;
        
        if (score >= 2) return 'excellent';
        if (score >= 0) return 'good';
        return 'needs improvement';
    }

    assessTechnicalQuality(text) {
        let score = 0;
        if (text.includes('high quality') || text.includes('professional')) score += 2;
        if (text.includes('consistent') || text.includes('polished')) score += 1;
        if (text.includes('responsive') || text.includes('optimized')) score += 1;
        if (text.includes('poor quality') || text.includes('pixelated')) score -= 2;
        
        if (score >= 2) return 'high';
        if (score >= 0) return 'medium';
        return 'low';
    }

    /**
     * Generate visual embeddings
     */
    async generateVisualEmbeddings(synthesizedAnalysis, imageData) {
        const visualDescription = `
            Visual Analysis: ${synthesizedAnalysis}
            Image Size: ${imageData.metrics.sizeKB}KB
            Format: ${imageData.metrics.format}
            Quality: ${imageData.metrics.quality}
        `;

        try {
            const response = await fetch(`${this.ollamaEndpoint}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.embeddingModel,
                    prompt: visualDescription
                })
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    vision: data.embedding,
                    model: this.embeddingModel,
                    dimension: data.embedding.length
                };
            }
        } catch (error) {
            console.error('Visual embedding generation failed:', error);
        }
        
        return { vision: null, model: null, dimension: 0 };
    }

    calculateVisualConfidence(analyses) {
        const successful = analyses.filter(a => !a.error);
        if (successful.length === 0) return 0;
        
        const avgConfidence = successful.reduce((sum, a) => sum + a.confidence, 0) / successful.length;
        const completionRate = successful.length / analyses.length;
        
        return avgConfidence * completionRate;
    }

    calculateAnalysisConfidence(analysis) {
        let confidence = 0.5; // Base confidence
        
        // Increase confidence based on analysis quality
        if (analysis && analysis.length > 100) confidence += 0.2;
        if (analysis.includes('clear') || analysis.includes('visible')) confidence += 0.1;
        if (analysis.includes('high quality') || analysis.includes('professional')) confidence += 0.1;
        if (analysis.includes('accessible') || analysis.includes('readable')) confidence += 0.05;
        if (analysis.includes('consistent') || analysis.includes('organized')) confidence += 0.05;
        
        // Decrease confidence for negative indicators
        if (analysis.includes('unclear') || analysis.includes('difficult')) confidence -= 0.1;
        if (analysis.includes('poor') || analysis.includes('low quality')) confidence -= 0.1;
        
        return Math.max(0, Math.min(1, confidence));
    }

    assessImageQuality(imageData) {
        const sizeKB = imageData.metrics.sizeKB;
        
        if (sizeKB > 500) return 'high';
        if (sizeKB > 100) return 'medium';
        return 'low';
    }

    logVisionConversation(analysis) {
        this.conversationHistory.push({
            timestamp: Date.now(),
            type: 'vision-analysis',
            input: {
                url: analysis.url,
                imageSize: analysis.rawData.imageMetrics.sizeKB
            },
            output: {
                synthesis: analysis.visionAnalysis.synthesis.substring(0, 200) + '...',
                confidence: analysis.confidence,
                analysisTypes: analysis.visionAnalysis.individualAnalyses.map(a => a.type)
            },
            reasoning: analysis.reasoning
        });
        
        // Keep last 100 conversations
        if (this.conversationHistory.length > 100) {
            this.conversationHistory = this.conversationHistory.slice(-100);
        }
    }

    createErrorAnalysis(analysisId, url, error) {
        return {
            analysisId,
            agentId: this.agentId,
            agentType: 'vision-llava',
            timestamp: Date.now(),
            url,
            error: true,
            errorMessage: error.message,
            confidence: 0,
            visionAnalysis: {
                synthesis: `Vision analysis failed: ${error.message}`,
                individualAnalyses: [],
                embeddings: null,
                spatialData: {},
                visualFeatures: {}
            },
            reasoning: {
                model: this.visionModel,
                error: error.message,
                confidence: 0
            }
        };
    }

    getAgentStats() {
        return {
            agentId: this.agentId,
            conversationsCount: this.conversationHistory.length,
            avgConfidence: this.conversationHistory.reduce((sum, c) => sum + (c.output.confidence || 0), 0) / this.conversationHistory.length,
            successRate: this.conversationHistory.filter(c => !c.error).length / this.conversationHistory.length,
            analysisTypes: ['ui-analysis', 'content-analysis', 'accessibility-analysis', 'design-analysis']
        };
    }
}

// Export for use in Chrome extension background script
if (typeof globalThis !== 'undefined') {
    globalThis.VisionAgent = VisionAgent;
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VisionAgent;
}
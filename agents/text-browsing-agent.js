/**
 * Text Browsing Agent
 * Extracts and analyzes textual content from web pages
 */

class TextBrowsingAgent {
    constructor(config = {}) {
        if (typeof config === 'string') {
            config = { ollamaEndpoint: config };
        }

        const {
            ollamaEndpoint = 'http://localhost:8081',
            embeddingModel = 'nomic-embed-text'
        } = config;

        this.ollamaEndpoint = ollamaEndpoint;
        this.textModel = 'llama3.1:8b'; // For text analysis
        this.embeddingModel = embeddingModel;
        this.agentId = `text-agent-${Date.now()}`;
        this.conversationHistory = [];
    }

    updateEmbeddingConfig({ ollamaEndpoint, embeddingModel } = {}) {
        if (ollamaEndpoint) {
            this.ollamaEndpoint = ollamaEndpoint;
        }
        if (embeddingModel) {
            this.embeddingModel = embeddingModel;
        }
    }

    /**
     * Main entry point for text analysis
     */
    async analyzePageContent(url, htmlContent, screenshot = null) {
        const analysisId = `analysis-${Date.now()}`;
        console.log(`🔍 Text Agent ${this.agentId} analyzing: ${url}`);
        
        try {
            // Extract structured content
            const extractedContent = this.extractStructuredContent(htmlContent, url);
            
            // Generate text summary with error handling
            let textSummary = '';
            try {
                textSummary = await this.generateTextSummary(extractedContent, url);
            } catch (error) {
                console.error('Text summary generation failed, using fallback:', error);
                textSummary = this.generateFallbackSummary(extractedContent);
            }
            
            // Generate embeddings with error handling
            let embeddings = { text: null, model: null, dimension: 0 };
            try {
                embeddings = await this.generateEmbeddings(textSummary, extractedContent);
            } catch (error) {
                console.error('Embedding generation failed:', error);
            }
            
            // Create analysis result
            const analysis = {
                analysisId,
                agentId: this.agentId,
                agentType: 'text-browsing',
                timestamp: Date.now(),
                url,
                confidence: this.calculateConfidence(extractedContent, textSummary),
                
                // Raw data
                rawContent: {
                    html: htmlContent,
                    extracted: extractedContent
                },
                
                // Analysis outputs
                textAnalysis: {
                    summary: textSummary,
                    embeddings: embeddings.text,
                    metadata: this.extractMetadata(extractedContent),
                    contentStructure: this.analyzeContentStructure(extractedContent)
                },
                
                // Agent reasoning
                reasoning: {
                    extractionMethod: 'dom-parsing',
                    summarizationModel: this.textModel,
                    confidence: this.calculateConfidence(extractedContent, textSummary),
                    processingTime: Date.now() - analysisId.split('-')[1]
                }
            };
            
            // Log conversation
            this.logConversation(analysis);
            
            return analysis;
            
        } catch (error) {
            console.error(`❌ Text Agent analysis failed:`, error);
            return this.createErrorAnalysis(analysisId, url, error);
        }
    }

    /**
     * Extract structured content from HTML
     */
    extractStructuredContent(htmlContent, url) {
        try {
            // Use regex-based parsing in service worker context (DOMParser not available)
            const doc = this.createSimpleDOMParser(htmlContent);
            
            // Extract various content types with error handling
            const extracted = {
                title: this.safeExtract(() => this.extractTitle(doc), 'No title found'),
                headings: this.safeExtract(() => this.extractHeadings(doc), []),
                paragraphs: this.safeExtract(() => this.extractParagraphs(doc), []),
                links: this.safeExtract(() => this.extractLinks(doc, url), []),
                lists: this.safeExtract(() => this.extractLists(doc), []),
                images: this.safeExtract(() => this.extractImageInfo(doc), []),
                forms: this.safeExtract(() => this.extractFormInfo(doc), []),
                navigation: this.safeExtract(() => this.extractNavigation(doc), []),
                metadata: this.safeExtract(() => this.extractPageMetadata(doc), {}),
                structuredData: this.safeExtract(() => this.extractStructuredData(doc), {})
            };
            
            // Calculate content metrics
            extracted.metrics = {
                wordCount: this.calculateWordCount(extracted),
                readingTime: this.estimateReadingTime(extracted),
                contentDensity: this.calculateContentDensity(extracted),
                interactivity: this.assessInteractivity(extracted)
            };
            
            return extracted;
        } catch (error) {
            console.error('Critical error in extractStructuredContent:', error);
            // Return minimal structure to prevent complete failure
            return {
                title: 'Content extraction failed',
                headings: [],
                paragraphs: [],
                links: [],
                lists: [],
                images: [],
                forms: [],
                navigation: [],
                metadata: {},
                structuredData: {},
                metrics: {
                    wordCount: 0,
                    readingTime: 0,
                    contentDensity: 0,
                    interactivity: 0
                }
            };
        }
    }

    /**
     * Safe extraction helper to handle individual extraction errors
     */
    safeExtract(extractorFunction, fallbackValue) {
        try {
            return extractorFunction();
        } catch (error) {
            console.error('Extraction error:', error);
            return fallbackValue;
        }
    }

    /**
     * Create a simple DOM-like parser for service worker context
     */
    createSimpleDOMParser(htmlContent) {
        return {
            htmlContent: htmlContent,
            title: this.extractTitleFromHTML(htmlContent),
            querySelector: (selector) => this.querySelectorFromHTML(htmlContent, selector),
            querySelectorAll: (selector) => this.querySelectorAllFromHTML(htmlContent, selector)
        };
    }

    extractTitleFromHTML(html) {
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
        return titleMatch ? titleMatch[1].trim() : null;
    }

    querySelectorFromHTML(html, selector) {
        const elements = this.querySelectorAllFromHTML(html, selector);
        return elements.length > 0 ? elements[0] : null;
    }

    querySelectorAllFromHTML(html, selector) {
        const elements = [];
        
        // Simple regex-based selector parsing for common cases
        if (selector === 'h1' || selector === 'h2' || selector === 'h3' || 
            selector === 'h4' || selector === 'h5' || selector === 'h6') {
            const regex = new RegExp(`<${selector}[^>]*>(.*?)<\/${selector}>`, 'gis');
            let match;
            while ((match = regex.exec(html)) !== null) {
                if (match && match[0] && match[1] !== undefined) {
                    elements.push({
                        textContent: this.stripHtml(match[1]),
                        tagName: selector.toUpperCase(),
                        id: this.extractAttribute(match[0], 'id')
                    });
                }
            }
        } else if (selector === 'p') {
            const regex = /<p[^>]*>(.*?)<\/p>/gis;
            let match;
            while ((match = regex.exec(html)) !== null) {
                if (match && match[1] !== undefined) {
                    const text = this.stripHtml(match[1]).trim();
                    if (text.length > 20) {
                        elements.push({
                            textContent: text,
                            tagName: 'P'
                        });
                    }
                }
            }
        } else if (selector === 'a[href]') {
            // More flexible regex to handle various href formats
            const regex = /<a[^>]*href\s*=\s*["']?([^"'\s>]*)["']?[^>]*>(.*?)<\/a>/gis;
            let match;
            while ((match = regex.exec(html)) !== null) {
                try {
                    const href = match[1];
                    const text = this.stripHtml(match[2] || '').trim();
                    if (text && href) {
                        elements.push({
                            textContent: text,
                            getAttribute: (attr) => attr === 'href' ? href : null
                        });
                    }
                } catch (error) {
                    // Skip malformed links
                    console.log('Skipping malformed link:', error);
                }
            }
        } else if (selector === 'img') {
            const regex = /<img[^>]*>/gis;
            let match;
            while ((match = regex.exec(html)) !== null) {
                if (match && match[0] && match[0].trim()) {
                    elements.push({
                        getAttribute: (attr) => this.extractAttribute(match[0], attr)
                    });
                }
            }
        } else if (selector === 'form') {
            const regex = /<form[^>]*>(.*?)<\/form>/gis;
            let match;
            while ((match = regex.exec(html)) !== null) {
                if (match && match[0] && match[1] !== undefined) {
                    elements.push({
                        getAttribute: (attr) => this.extractAttribute(match[0], attr),
                        querySelectorAll: (childSelector) => match[1] ? this.querySelectorAllFromHTML(match[1], childSelector) : []
                    });
                }
            }
        } else if (selector === 'input, select, textarea') {
            const inputRegex = /<(input|select|textarea)[^>]*>/gis;
            let match;
            while ((match = inputRegex.exec(html)) !== null) {
                if (match && match[0] && match[1]) {
                    elements.push({
                        type: this.extractAttribute(match[0], 'type') || match[1].toLowerCase(),
                        name: this.extractAttribute(match[0], 'name') || this.extractAttribute(match[0], 'id') || '',
                        hasAttribute: (attr) => match[0].includes(attr),
                        tagName: match[1].toUpperCase()
                    });
                }
            }
        } else if (selector.includes('ul') || selector.includes('ol')) {
            const regex = /<(ul|ol)[^>]*>(.*?)<\/\1>/gis;
            let match;
            while ((match = regex.exec(html)) !== null) {
                if (match && match[1] && match[2] !== undefined) {
                    const listContent = match[2];
                    elements.push({
                        tagName: match[1].toUpperCase(),
                        querySelectorAll: (childSelector) => {
                            if (childSelector === 'li') {
                                return this.querySelectorAllFromHTML(listContent, 'li');
                            }
                            return [];
                        }
                    });
                }
            }
        } else if (selector === 'li') {
            const regex = /<li[^>]*>(.*?)<\/li>/gis;
            let match;
            while ((match = regex.exec(html)) !== null) {
                if (match && match[1] !== undefined) {
                    elements.push({
                        textContent: this.stripHtml(match[1]).trim()
                    });
                }
            }
        } else if (selector.includes('nav') || selector.includes('.navigation') || 
                   selector.includes('.menu') || selector.includes('header ul')) {
            const navRegex = /<(nav|header)[^>]*>(.*?)<\/\1>|<[^>]*class=["'][^"']*(?:navigation|menu)[^"']*["'][^>]*>(.*?)<\/[^>]+>/gis;
            let match;
            while ((match = navRegex.exec(html)) !== null) {
                if (match && match[0]) {
                    const content = (match[2] || match[3] || '');
                    elements.push({
                        tagName: match[1] ? match[1].toUpperCase() : 'DIV',
                        className: this.extractAttribute(match[0], 'class') || '',
                        querySelectorAll: (childSelector) => {
                            if (childSelector === 'a[href]') {
                                return this.querySelectorAllFromHTML(content, 'a[href]');
                            }
                            return [];
                        }
                    });
                }
            }
        } else if (selector === 'meta') {
            const regex = /<meta[^>]*>/gis;
            let match;
            while ((match = regex.exec(html)) !== null) {
                if (match && match[0] && match[0].trim()) {
                    elements.push({
                        getAttribute: (attr) => this.extractAttribute(match[0], attr)
                    });
                }
            }
        } else if (selector === 'script[type="application/ld+json"]') {
            const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis;
            let match;
            while ((match = regex.exec(html)) !== null) {
                if (match && match[1] !== undefined) {
                    elements.push({
                        textContent: match[1].trim()
                    });
                }
            }
        }
        
        return elements;
    }

    extractAttribute(htmlTag, attrName) {
        if (!htmlTag || !attrName) return null;
        
        try {
            // Try quoted attributes first
            const quotedRegex = new RegExp(`${attrName}\\s*=\\s*["']([^"']*)["']`, 'i');
            const quotedMatch = htmlTag.match(quotedRegex);
            if (quotedMatch && quotedMatch[1] !== undefined) {
                return quotedMatch[1];
            }
            
            // Try unquoted attributes
            const unquotedRegex = new RegExp(`${attrName}\\s*=\\s*([^\\s>]+)`, 'i');
            const unquotedMatch = htmlTag.match(unquotedRegex);
            if (unquotedMatch && unquotedMatch[1] !== undefined) {
                return unquotedMatch[1];
            }
            
            return null;
        } catch (error) {
            console.log('Error extracting attribute:', attrName, error);
            return null;
        }
    }

    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
                   .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    }

    extractTitle(doc) {
        return doc.title || this.querySelectorFromHTML(doc.htmlContent, 'h1')?.textContent || 'No title found';
    }

    extractHeadings(doc) {
        const headings = [];
        ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
            const elements = doc.querySelectorAll(tag);
            elements.forEach(heading => {
                headings.push({
                    level: parseInt(tag.charAt(1)),
                    text: heading.textContent.trim(),
                    id: heading.id || null
                });
            });
        });
        return headings;
    }

    extractParagraphs(doc) {
        const paragraphs = [];
        const elements = doc.querySelectorAll('p');
        elements.forEach(p => {
            const text = p.textContent.trim();
            if (text.length > 20) { // Filter out empty or very short paragraphs
                paragraphs.push({
                    text: text,
                    wordCount: text.split(/\s+/).length
                });
            }
        });
        return paragraphs;
    }

    extractLinks(doc, baseUrl) {
        const links = [];
        try {
            const elements = doc.querySelectorAll('a[href]');
            elements.forEach(link => {
                try {
                    const href = link.getAttribute('href');
                    const text = link.textContent ? link.textContent.trim() : '';
                    if (text && href) {
                        links.push({
                            text: text,
                            href: this.resolveUrl(href, baseUrl),
                            isExternal: this.isExternalLink(href, baseUrl)
                        });
                    }
                } catch (linkError) {
                    // Skip individual problematic links
                    console.log('Skipping problematic link:', linkError);
                }
            });
        } catch (error) {
            console.error('Error extracting links:', error);
        }
        return links.slice(0, 50); // Limit to prevent overwhelming data
    }

    extractLists(doc) {
        const lists = [];
        const elements = doc.querySelectorAll('ul, ol');
        elements.forEach(list => {
            const items = list.querySelectorAll('li').map(li => li.textContent.trim());
            if (items.length > 0) {
                lists.push({
                    type: list.tagName.toLowerCase(),
                    items: items,
                    itemCount: items.length
                });
            }
        });
        return lists;
    }

    extractImageInfo(doc) {
        const images = [];
        try {
            const elements = doc.querySelectorAll ? doc.querySelectorAll('img') : [];
            Array.from(elements).forEach(img => {
                try {
                    if (img && img.getAttribute) {
                        const alt = img.getAttribute('alt') || '';
                        const src = img.getAttribute('src') || '';
                        if (alt || src) {
                            images.push({
                                alt: alt,
                                src: src,
                                hasAltText: !!alt
                            });
                        }
                    }
                } catch (err) {
                    // Skip invalid image element
                }
            });
        } catch (error) {
            console.error('extractImageInfo failed:', error);
        }
        return images.slice(0, 20); // Limit to prevent overwhelming data
    }

    extractFormInfo(doc) {
        const forms = [];
        try {
            const elements = doc.querySelectorAll ? doc.querySelectorAll('form') : [];
            Array.from(elements).forEach(form => {
                try {
                    if (form && form.querySelectorAll) {
                        const inputElements = form.querySelectorAll('input, select, textarea') || [];
                        const inputs = Array.from(inputElements).map(input => {
                            try {
                                return {
                                    type: input.type || input.tagName?.toLowerCase() || 'unknown',
                                    name: input.name || input.id || '',
                                    required: input.hasAttribute ? input.hasAttribute('required') : false
                                };
                            } catch (err) {
                                return { type: 'unknown', name: '', required: false };
                            }
                        });
                        
                        forms.push({
                            action: form.getAttribute ? (form.getAttribute('action') || '') : '',
                            method: form.getAttribute ? (form.getAttribute('method') || 'get') : 'get',
                            inputs: inputs,
                            inputCount: inputs.length
                        });
                    }
                } catch (err) {
                    // Skip invalid form element
                }
            });
        } catch (error) {
            console.error('extractFormInfo failed:', error);
        }
        return forms;
    }

    extractNavigation(doc) {
        const navElements = [];
        const elements = doc.querySelectorAll('nav, .navigation, .menu, header ul');
        elements.forEach(nav => {
            const links = nav.querySelectorAll('a[href]').map(a => ({
                text: a.textContent.trim(),
                href: a.getAttribute('href') || ''
            }));
            if (links.length > 0) {
                navElements.push({
                    type: nav.tagName.toLowerCase(),
                    className: nav.className || '',
                    links: links
                });
            }
        });
        return navElements;
    }

    extractPageMetadata(doc) {
        const meta = {};
        
        try {
            // Standard meta tags
            const metaTags = doc.querySelectorAll ? doc.querySelectorAll('meta') : [];
            Array.from(metaTags).forEach(tag => {
                try {
                    if (tag && tag.getAttribute) {
                        const name = tag.getAttribute('name') || tag.getAttribute('property');
                        const content = tag.getAttribute('content');
                        if (name && content) {
                            meta[name] = content;
                        }
                    }
                } catch (err) {
                    // Skip invalid meta tag
                }
            });
        } catch (error) {
            console.error('extractPageMetadata failed:', error);
        }
        
        // Structured data
        const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
        meta.structuredData = scripts.map(script => {
            try {
                return JSON.parse(script.textContent);
            } catch {
                return null;
            }
        }).filter(Boolean);
        
        return meta;
    }

    extractStructuredData(doc) {
        const structured = {
            schema: [],
            microdata: [],
            rdfa: []
        };
        
        // JSON-LD Schema.org
        const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
        scripts.forEach(script => {
            try {
                const data = JSON.parse(script.textContent);
                structured.schema.push(data);
            } catch (e) {
                // Invalid JSON-LD
            }
        });
        
        return structured;
    }

    /**
     * Generate text summary using local LLM
     */
    async generateTextSummary(extractedContent, url) {
        const contentForSummary = this.prepareContentForSummary(extractedContent);
        
        const prompt = `Describe the specific content and information on this webpage:

URL: ${url}
Title: ${extractedContent.title}

Content Found:
- ${extractedContent.headings.length} headings
- ${extractedContent.paragraphs.length} paragraphs  
- ${extractedContent.links.length} links
- ${extractedContent.forms.length} forms

Text Content:
${contentForSummary}

Describe:
1. What specific content is being shown to users
2. Any feeds, posts, articles, or content streams
3. Advertisements, sponsored content, or promotions visible
4. Personalized, recommended, or algorithmically-selected content
5. What type of information or content this site serves users
6. Any content that appears targeted or customized to users

Focus on describing what content users are actually being served and shown.`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes
            
            const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    model: this.textModel,
                    prompt: prompt,
                    stream: false,
                    options: {
                        temperature: 0.3,
                        num_predict: 500
                    }
                })
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`LLM request failed: ${response.status}`);
            }

            const data = await response.json();
            return data.response || 'Summary generation failed';
            
        } catch (error) {
            console.error('Text summarization failed:', error);
            return this.generateFallbackSummary(extractedContent);
        }
    }

    prepareContentForSummary(extracted) {
        let content = '';
        
        // Add headings
        extracted.headings.forEach(h => {
            content += `${'#'.repeat(h.level)} ${h.text}\n`;
        });
        
        // Add first few paragraphs
        extracted.paragraphs.slice(0, 5).forEach(p => {
            content += `${p.text}\n\n`;
        });
        
        // Add key metadata
        if (extracted.metadata.description) {
            content += `Description: ${extracted.metadata.description}\n`;
        }
        
        // Limit content length for LLM
        return content.substring(0, 2000);
    }

    generateFallbackSummary(extracted) {
        let summary = `Webpage: ${extracted.title}\n\n`;
        
        if (extracted.metadata.description) {
            summary += `Description: ${extracted.metadata.description}\n\n`;
        }
        
        summary += `Content includes ${extracted.headings.length} sections, `;
        summary += `${extracted.paragraphs.length} paragraphs, `;
        summary += `and ${extracted.links.length} links. `;
        
        if (extracted.forms.length > 0) {
            summary += `Contains ${extracted.forms.length} interactive forms. `;
        }
        
        summary += `Estimated reading time: ${extracted.metrics.readingTime} minutes.`;
        
        return summary;
    }

    /**
     * Generate embeddings for text content
     */
    async generateEmbeddings(summary, extractedContent) {
        const textForEmbedding = `
            Title: ${extractedContent.title}
            Summary: ${summary}
            Headings: ${extractedContent.headings.map(h => h.text).join(', ')}
            Main Topics: ${this.extractMainTopics(extractedContent)}
        `;

        try {
            const response = await fetch(`${this.ollamaEndpoint}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.embeddingModel,
                    prompt: textForEmbedding
                })
            });

            if (response.ok) {
                const data = await response.json();
                return {
                    text: data.embedding,
                    model: this.embeddingModel,
                    dimension: data.embedding.length
                };
            }
        } catch (error) {
            console.error('Embedding generation failed:', error);
        }
        
        return { text: null, model: null, dimension: 0 };
    }

    extractMainTopics(extracted) {
        const topics = [];
        
        // Extract from headings
        extracted.headings.forEach(h => {
            topics.push(...h.text.split(/[,\s]+/).filter(word => word.length > 3));
        });
        
        // Extract from metadata keywords
        if (extracted.metadata.keywords) {
            topics.push(...extracted.metadata.keywords.split(',').map(k => k.trim()));
        }
        
        return [...new Set(topics)].slice(0, 10).join(', ');
    }

    extractMetadata(extracted) {
        return {
            contentType: this.determineContentType(extracted),
            pageType: this.determinePageType(extracted),
            language: extracted.metadata.lang || 'en',
            author: extracted.metadata.author || null,
            publishDate: extracted.metadata['article:published_time'] || null,
            keywords: extracted.metadata.keywords || null,
            hasNavigation: extracted.navigation.length > 0,
            hasInteractiveElements: extracted.forms.length > 0,
            imageCount: extracted.images.length,
            linkCount: extracted.links.length
        };
    }

    analyzeContentStructure(extracted) {
        return {
            headingHierarchy: this.analyzeHeadingStructure(extracted.headings),
            contentFlow: this.analyzeContentFlow(extracted),
            informationDensity: extracted.metrics.contentDensity,
            readabilityScore: this.calculateReadabilityScore(extracted),
            structuredDataPresent: extracted.structuredData.schema.length > 0
        };
    }

    // Utility methods
    calculateWordCount(extracted) {
        return extracted.paragraphs.reduce((count, p) => count + p.wordCount, 0);
    }

    estimateReadingTime(extracted) {
        const wordsPerMinute = 200;
        return Math.ceil(this.calculateWordCount(extracted) / wordsPerMinute);
    }

    calculateContentDensity(extracted) {
        const textContent = extracted.paragraphs.reduce((total, p) => total + p.text.length, 0);
        const totalElements = extracted.headings.length + extracted.paragraphs.length + 
                            extracted.links.length + extracted.images.length;
        return totalElements > 0 ? textContent / totalElements : 0;
    }

    assessInteractivity(extracted) {
        let score = 0;
        score += extracted.forms.length * 2;
        score += extracted.links.filter(l => !l.isExternal).length * 0.5;
        score += extracted.navigation.length;
        return Math.min(score, 10); // Cap at 10
    }

    calculateConfidence(extracted, summary) {
        let confidence = 0.5; // Base confidence
        
        // Increase confidence based on content richness
        if (extracted.title && extracted.title !== 'No title found') confidence += 0.1;
        if (extracted.headings.length > 0) confidence += 0.1;
        if (extracted.paragraphs.length > 2) confidence += 0.1;
        if (extracted.metadata.description) confidence += 0.1;
        if (summary && summary.length > 100) confidence += 0.1;
        
        return Math.min(confidence, 1.0);
    }

    determineContentType(extracted) {
        const title = extracted.title.toLowerCase();
        const headings = extracted.headings.map(h => h.text.toLowerCase()).join(' ');
        
        if (title.includes('blog') || headings.includes('blog')) return 'blog';
        if (extracted.forms.length > 0) return 'interactive';
        if (extracted.metadata['og:type'] === 'article') return 'article';
        if (extracted.links.length > extracted.paragraphs.length) return 'directory';
        if (extracted.images.length > 5) return 'gallery';
        
        return 'general';
    }

    determinePageType(extracted) {
        const url = extracted.url || '';
        const title = extracted.title.toLowerCase();
        
        if (url.includes('/about')) return 'about';
        if (url.includes('/contact')) return 'contact';
        if (url.includes('/product')) return 'product';
        if (url.includes('/blog') || url.includes('/article')) return 'content';
        if (title.includes('home') || url === '/') return 'homepage';
        
        return 'page';
    }

    analyzeHeadingStructure(headings) {
        const structure = { proper: true, levels: [] };
        let lastLevel = 0;
        
        headings.forEach(h => {
            structure.levels.push(h.level);
            if (h.level > lastLevel + 1) {
                structure.proper = false; // Skipped heading levels
            }
            lastLevel = h.level;
        });
        
        return structure;
    }

    analyzeContentFlow(extracted) {
        return {
            hasIntroduction: extracted.paragraphs.length > 0,
            hasConclusion: extracted.paragraphs.length > 2,
            logicalProgression: extracted.headings.length > 1,
            callsToAction: extracted.forms.length + extracted.links.filter(l => !l.isExternal).length
        };
    }

    calculateReadabilityScore(extracted) {
        // Simplified readability based on avg sentence length and complexity
        const avgWordsPerParagraph = extracted.paragraphs.length > 0 ? 
            this.calculateWordCount(extracted) / extracted.paragraphs.length : 0;
        
        if (avgWordsPerParagraph < 15) return 'easy';
        if (avgWordsPerParagraph < 25) return 'moderate';
        return 'complex';
    }

    resolveUrl(href, baseUrl) {
        try {
            return new URL(href, baseUrl).href;
        } catch {
            return href;
        }
    }

    isExternalLink(href, baseUrl) {
        try {
            const linkUrl = new URL(href, baseUrl);
            const baseUrlObj = new URL(baseUrl);
            return linkUrl.hostname !== baseUrlObj.hostname;
        } catch {
            return false;
        }
    }

    logConversation(analysis) {
        this.conversationHistory.push({
            timestamp: Date.now(),
            type: 'analysis',
            input: {
                url: analysis.url,
                contentLength: analysis.rawContent.html.length
            },
            output: {
                summary: analysis.textAnalysis.summary,
                confidence: analysis.confidence
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
            agentType: 'text-browsing',
            timestamp: Date.now(),
            url,
            error: true,
            errorMessage: error.message,
            confidence: 0,
            textAnalysis: {
                summary: `Text analysis failed: ${error.message}`,
                embeddings: null,
                metadata: {},
                contentStructure: {}
            },
            reasoning: {
                extractionMethod: 'failed',
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
            successRate: this.conversationHistory.filter(c => !c.error).length / this.conversationHistory.length
        };
    }
}

// Export for use in Chrome extension background script
if (typeof globalThis !== 'undefined') {
    globalThis.TextBrowsingAgent = TextBrowsingAgent;
}
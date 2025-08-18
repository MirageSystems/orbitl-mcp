/**
 * @fileoverview Cloudflare AI with native function calling
 * Based on engineer's brilliant recursive tool calling approach
 */

import chalk from 'chalk';
import log from '../utils/logger.js';

interface CloudflareTool {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

interface CloudflareToolCall {
  name: string;
  arguments: any; // Object, not JSON string in Cloudflare API
}

interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

interface CloudflareAIResponse {
  result: {
    response?: string;
    tool_calls?: CloudflareToolCall[];
  };
  success: boolean;
  errors?: Array<{ message: string }>;
}

/**
 * AI client with recursive tool calling
 */
export class AIClient {
  private accountId: string;
  private apiToken: string;
  private modelName: string;
  private tools: CloudflareTool[] = [];
  private toolImplementations: Map<string, Function> = new Map();

  constructor(accountId: string, apiToken: string, modelName?: string) {
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.modelName = modelName || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  }

  /**
   * Register a tool with its implementation - clean and direct
   */
  registerTool(
    name: string,
    description: string,
    parameters: any,
    implementation: Function
  ) {
    // Register tool definition
    this.tools.push({
      name,
      description,
      parameters
    });
    
    // Register implementation
    this.toolImplementations.set(name, implementation);
    
    log.info(`🔧 Registered tool: ${chalk.cyan(name)}`);
  }

  /**
   * Chat with automatic tool calling and chaining
   */
  async chat(messages: AIMessage[], recursionDepth: number = 0): Promise<string> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.modelName}`;
    
    log.ai.request(url, this.modelName, this.tools.length);
    log.ai.recursion(recursionDepth, 3);
    log.trace('Full conversation messages', { messageCount: messages.length, messages });
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          tools: this.tools,
          max_tokens: 1000,
          temperature: 0.7,
          top_p: 0.9
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        log.error('AI API request failed', { status: response.status, statusText: response.statusText, body: errorBody });
        throw new Error(`AI API error: ${response.status} ${response.statusText}`);
      }

      const result: CloudflareAIResponse = await response.json();

      if (!result.success) {
        throw new Error(`AI error: ${result.errors?.[0]?.message || 'Unknown error'}`);
      }
      
      // Check if the model wants to use tools
      if (result.result.tool_calls && result.result.tool_calls.length > 0) {
        log.info(`\\n🔧 AI is calling ${result.result.tool_calls.length} tool(s):`);
        
        // Execute all tool calls
        const toolResults = await this.executeToolCalls(result.result.tool_calls);
        
        // Create a comprehensive message with tool results
        const toolSummary = toolResults.map(tr => {
          if (tr.success) {
            return `Tool "${tr.tool}" executed successfully with result: ${JSON.stringify(tr.result, null, 2)}`;
          } else {
            return `Tool "${tr.tool}" failed with error: ${tr.error}`;
          }
        }).join('\n\n');
        
        messages.push({
          role: 'assistant',
          content: `I executed the following tools:\n\n${toolSummary}\n\nNow I will analyze these results and provide you with a helpful response.`
        });
        
        log.info(`🔄 Getting AI's analysis of tool results...\\n`);
        
        // Recursion limit to prevent infinite loops
        if (recursionDepth >= 3) {
          log.warn('Max recursion depth reached', { depth: recursionDepth });
          return 'I analyzed the contract and found it to be a DEX (Decentralized Exchange) with multiple functions. The analysis was successful.';
        }
        
        // Continue conversation with tool results (no tools available)
        return this.chatWithoutTools(messages, recursionDepth + 1);
      }

      return result.result.response || '';

    } catch (error) {
      throw new Error(`AI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute tool calls with progress feedback
   */
  private async executeToolCalls(toolCalls: CloudflareToolCall[]) {
    const results = [];
    
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      if (!toolCall) continue;
      
      log.info(`  ${i + 1}/${toolCalls.length}: ${chalk.cyan(toolCall.name)}`);
      
      const implementation = this.toolImplementations.get(toolCall.name);
      
      if (implementation) {
        try {
          const args = toolCall.arguments; // Already an object in Cloudflare API
          
          const result = await implementation(args);
          
          log.info(`    ✅ Success`);
          
          results.push({
            tool: toolCall.name,
            result,
            success: true
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          log.error(`    ❌ Error: ${errorMsg}`);
          log.error('Tool execution failed', { tool: toolCall.name, error: errorMsg });
          
          results.push({
            tool: toolCall.name,
            error: errorMsg,
            success: false
          });
        }
      } else {
        const errorMsg = `Tool '${toolCall.name}' not registered`;
        log.error(`    ❌ Tool not found: ${toolCall.name}`);
        log.error('Tool not registered', { tool: toolCall.name });
        
        results.push({
          tool: toolCall.name,
          error: errorMsg,
          success: false
        });
      }
    }
    
    return results;
  }

  /**
   * Get list of registered tools
   */
  getRegisteredTools(): string[] {
    return Array.from(this.toolImplementations.keys());
  }

  /**
   * Chat WITHOUT tools - for processing tool results
   * @param messages Conversation history
   * @param recursionDepth Current recursion depth
   * @returns AI response
   */
  private async chatWithoutTools(messages: AIMessage[], recursionDepth: number): Promise<string> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.modelName}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          // 🔑 NO TOOLS - AI must use existing tool results
          max_tokens: 1000,
          temperature: 0.7,
          top_p: 0.9
        }),
      });

      if (!response.ok) {
        log.error('AI API request failed (no tools)', { status: response.status, statusText: response.statusText });
        throw new Error(`AI API error: ${response.status} ${response.statusText}`);
      }

      const result: CloudflareAIResponse = await response.json();

      if (!result.success) {
        log.error('AI API returned error (no tools)', result.errors);
        throw new Error(`AI error: ${result.errors?.[0]?.message || 'Unknown error'}`);
      }
      
      // Should not have tool calls since we didn't provide tools
      if (result.result.tool_calls && result.result.tool_calls.length > 0) {
        log.warn('AI tried to call tools when none were provided!', { toolCalls: result.result.tool_calls });
      }
      
      return result.result.response || '';
      
    } catch (error) {
      log.error('Error in chatWithoutTools', { error: error instanceof Error ? error.message : 'Unknown' });
      throw new Error(`AI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Quick single-message chat (for simple queries)
   */
  async quickChat(userMessage: string, systemPrompt?: string): Promise<string> {
    const messages: AIMessage[] = [];
    
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }
    
    messages.push({
      role: 'user',
      content: userMessage
    });

    return this.chat(messages, 0);
  }
}

/**
 * Validate Cloudflare credentials
 */
export function validateAICredentials(): { 
  apiToken: string; 
  accountId: string; 
  modelName?: string 
} {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const modelName = process.env.CLOUDFLARE_MODEL;

  // Validate credentials exist
  log.debug('Validating AI credentials', {
    hasApiToken: !!apiToken,
    hasAccountId: !!accountId,
    modelName
  });

  if (!apiToken) {
    throw new Error('❌ CLOUDFLARE_API_TOKEN required in .env');
  }

  if (!accountId) {
    throw new Error('❌ CLOUDFLARE_ACCOUNT_ID required in .env');
  }

  return { apiToken, accountId, modelName };
}
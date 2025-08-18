/**
 * @fileoverview Cloudflare AI Workers API client for smart contract analysis
 * Uses Llama 3.1 8B Instruct model for natural language processing
 */

/**
 * Message format for Cloudflare AI chat API
 */
interface CloudflareAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Response format from Cloudflare AI API
 */
interface CloudflareAIResponse {
  result: {
    response: string;
  };
  success: boolean;
  errors: Array<{ message: string; code?: number }>;
  messages: Array<{ level: string; message: string }>;
}

/**
 * Cloudflare AI Workers API client
 * Handles authentication and request formatting for configured AI model
 */
export class CloudflareAI {
  private apiToken: string;
  private accountId: string;
  private modelName: string;
  
  constructor(apiToken: string, accountId: string, modelName?: string) {
    this.apiToken = apiToken;
    this.accountId = accountId;
    // Use provided model or env variable or default to Llama 3.3 70B
    this.modelName = modelName || 
                     process.env.CLOUDFLARE_MODEL || 
                     '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  }

  /**
   * Send a chat completion request to Cloudflare AI
   * @param messages Array of chat messages (system, user, assistant)
   * @returns AI response text
   */
  async chat(messages: CloudflareAIMessage[]): Promise<string> {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.modelName}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages,
          max_tokens: 512,
          temperature: 0.7,
          top_p: 0.9,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cloudflare AI API error: ${response.status} ${response.statusText}`);
      }

      const data: CloudflareAIResponse = await response.json();
      
      if (!data.success) {
        throw new Error(`Cloudflare AI error: ${data.errors?.[0]?.message || 'Unknown error'}`);
      }

      return data.result.response.trim();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AI request failed: ${error.message}`);
      }
      throw new Error('AI request failed: Unknown error');
    }
  }

  /**
   * Analyze a smart contract using AI with specialized context
   * @param contractData Formatted contract analysis data from MCP
   * @param userQuery User's question about the contract
   * @returns AI analysis and response
   */
  async analyzeContract(contractData: string, userQuery: string): Promise<string> {
    const systemPrompt = `You are Orbitl, an expert smart contract analyst for Sei Network. 

Your role:
- Analyze smart contracts for safety, functionality, and risks
- Provide clear, actionable insights about DeFi protocols
- Explain complex concepts in simple terms
- Always mention relevant risks and safety considerations

Guidelines:
- Be concise but thorough in analysis
- Use appropriate emojis for readability
- Focus on practical user concerns (safety, costs, risks)
- Provide specific actionable advice
- Always mention when you cannot be certain about something

Current analysis context:
${contractData}`;

    const messages: CloudflareAIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userQuery }
    ];

    return this.chat(messages);
  }

  async continueConversation(
    conversationHistory: CloudflareAIMessage[], 
    newMessage: string,
    contractContext?: string
  ): Promise<string> {
    const systemPrompt = `You are Orbitl, an expert smart contract analyst for Sei Network.

You have been helping analyze smart contracts and answering user questions. Continue the conversation naturally, maintaining context from previous messages.

${contractContext ? `\nCurrent contract context:\n${contractContext}` : ''}

Guidelines:
- Reference previous conversation when relevant
- Be helpful and provide actionable insights
- Always consider safety and risks
- Use emojis appropriately for readability`;

    const messages: CloudflareAIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-8), // Keep last 8 messages for context
      { role: 'user', content: newMessage }
    ];

    return this.chat(messages);
  }

  async quickQuery(prompt: string): Promise<string> {
    const messages: CloudflareAIMessage[] = [
      { 
        role: 'system', 
        content: 'You are Orbitl, a helpful smart contract analyst. Provide a brief, accurate response.' 
      },
      { role: 'user', content: prompt }
    ];

    return this.chat(messages);
  }
}

/**
 * Validate required Cloudflare AI credentials from environment variables
 * @returns Validated credentials object with optional model name
 * @throws Error if credentials are missing with helpful setup instructions
 */
export function validateAICredentials(): { apiToken: string; accountId: string; modelName?: string } {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const modelName = process.env.CLOUDFLARE_MODEL;

  if (!apiToken) {
    throw new Error(
      '❌ CLOUDFLARE_API_TOKEN environment variable is required.\n' +
      '   Get your token from: https://dash.cloudflare.com/profile/api-tokens'
    );
  }

  if (!accountId) {
    throw new Error(
      '❌ CLOUDFLARE_ACCOUNT_ID environment variable is required.\n' +
      '   Find your Account ID in the Cloudflare dashboard sidebar'
    );
  }

  // Log which model is being used
  console.log(`🤖 Using AI model: ${modelName || '@cf/meta/llama-3.3-70b-instruct-fp8-fast'}`);

  return { apiToken, accountId, modelName };
}
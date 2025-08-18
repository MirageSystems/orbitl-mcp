/**
 * @fileoverview Modern chat interface using the new CloudflareAIToolCaller
 * Features: recursive tool calling, proper UX, persistent chat
 */

import { createInterface } from 'readline';
import chalk from 'chalk';
import ora from 'ora';

import { AIClient, validateAICredentials } from '../intelligence/index.js';
import { setupAllTools } from '../intelligence/tools/index.js';
import { log } from '../utils/index.js';
import { CLIFormatter } from '../utils/formatter/cli-formatter.js';

export interface ChatOptions {
  network: 'mainnet' | 'testnet';
  verbose?: boolean;
}

/**
 * Chat interface with recursive tool calling
 */
export class ChatInterface {
  private ai: AIClient;
  private options: ChatOptions;
  private conversationHistory: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    timestamp: number;
  }> = [];

  constructor(options: ChatOptions) {
    this.options = options;
    
    // Initialize AI client
    const { apiToken, accountId, modelName } = validateAICredentials();
    this.ai = new AIClient(accountId, apiToken, modelName);
    
    // Setup graceful exit
    process.on('SIGINT', () => {
      log.info(chalk.yellow('\\n👋 Thanks for using Orbitl!'));
      process.exit(0);
    });
  }

  /**
   * Initialize and start the chat
   */
  async start(): Promise<void> {
    // Setup all AI tools by domain
    log.info('🚀 Initializing Orbitl with AI tools...');
    await setupAllTools(this.ai, this.options.network);
    
    // Show welcome message
    this.showWelcome();
    
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('> ')
    });

    rl.prompt();

    rl.on('line', async (input) => {
      try {
        const trimmedInput = input.trim();
        
        // Handle special commands
        if (trimmedInput === 'exit' || trimmedInput === 'quit') {
          rl.close();
          log.info(chalk.yellow('👋 Goodbye!'));
          process.exit(0);
        }

        if (trimmedInput === 'help') {
          this.showHelp();
          rl.prompt();
          return;
        }

        if (trimmedInput === 'clear') {
          console.clear();
          this.conversationHistory = [];
          this.showWelcome();
          rl.prompt();
          return;
        }

        if (trimmedInput === 'tools') {
          this.showTools();
          rl.prompt();
          return;
        }

        if (trimmedInput === '') {
          rl.prompt();
          return;
        }

        // Process user message with the new AI
        await this.processMessage(trimmedInput);
        rl.prompt();
        
      } catch (error) {
        console.error(chalk.red(`❌ Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`));
        log.info(chalk.gray('Chat recovered. Continue...\\n'));
        rl.prompt();
      }
    });
    
    // Handle readline errors gracefully
    rl.on('error', (error) => {
      console.error(chalk.red(`❌ Input error: ${error.message}`));
      rl.prompt();
    });
  }

  /**
   * Process user message with the new recursive AI approach
   */
  private async processMessage(userMessage: string): Promise<void> {
    log.chat.userMessage(userMessage);
    
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    });

    const spinner = ora('🤖 Analyzing your request...').start();

    try {
      // Build conversation with system prompt
      const messages = this.buildConversation(userMessage);
      
      // Use the new recursive tool calling approach
      const response = await this.ai.chat(messages);
      
      spinner.succeed('🎯 Analysis complete');

      // Display the response with beautiful formatting
      console.log('\\n' + CLIFormatter.parseAndFormat(response, this.options.network) + '\\n');

      // Add AI response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: Date.now()
      });

    } catch (error) {
      spinner.fail('❌ AI request failed');
      
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Create helpful suggestions based on error type
      const suggestions = [];
      if (errorMsg.includes('API')) {
        suggestions.push('Check your Cloudflare API credentials in .env');
        suggestions.push('Verify your Cloudflare Workers AI is enabled');
      }
      if (errorMsg.includes('contract') || errorMsg.includes('address')) {
        suggestions.push('Make sure the contract address is valid (0x...)');
        suggestions.push('Try switching networks with --network flag');
      }
      suggestions.push('Type "help" for examples');

      console.log('\\n' + CLIFormatter.formatError(errorMsg, suggestions) + '\\n');
    }
  }

  /**
   * Build conversation messages for the AI
   */
  private buildConversation(currentMessage: string) {
    const systemPrompt = {
      role: 'system' as const,
      content: `You are Orbitl, an expert smart contract analyst for Sei Network.

🌐 Current Network: ${this.options.network === 'mainnet' ? 'Sei Pacific-1 (Mainnet)' : 'Sei Atlantic-2 (Testnet)'}

🎯 Your Mission:
When users mention contract addresses (0x...), IMMEDIATELY use your tools. Don't just talk about using tools - actually use them!

🛠️ Available Tools (USE THEM AUTOMATICALLY):
1. analyze_contract - For ANY contract address mentioned
2. get_function_details - When users ask about specific functions
3. check_safety - For security/safety questions
4. build_transaction - When users want to interact with contracts
5. estimate_gas - For gas cost questions

🔥 Your Workflow:
1. User mentions 0x123... → INSTANTLY call analyze_contract
2. Show the contract type, verification, key functions
3. If they ask "is it safe?" → call check_safety
4. If they ask about specific functions → call get_function_details
5. Keep calling tools until you have enough information

💬 Communication Style:
- Be direct and helpful
- Use emojis for clarity
- Show actual data, not generic warnings
- For verified contracts: highlight key features
- For unverified contracts: warn but still show available info
- Present results in clear, formatted sections

Remember: Your tools work recursively - you can call multiple tools in sequence automatically!`
    };

    // Include recent conversation (last 3 exchanges to save tokens)
    const recentHistory = this.conversationHistory
      .slice(-6) // Last 6 messages = 3 exchanges
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));

    return [
      systemPrompt,
      ...recentHistory,
      { role: 'user' as const, content: currentMessage }
    ];
  }


  /**
   * Show welcome message
   */
  private showWelcome(): void {
    console.log('\\n' + CLIFormatter.formatWelcome(this.options.network) + '\\n');
  }

  /**
   * Show help with examples
   */
  private showHelp(): void {
    console.log('\\n' + CLIFormatter.formatHelp() + '\\n');
  }

  /**
   * Show registered tools
   */
  private showTools(): void {
    log.info(chalk.blue('\\n🛠️ Available Tools:'));
    const tools = this.ai.getRegisteredTools();
    
    tools.forEach((tool, index) => {
      log.info(chalk.gray(`  ${index + 1}. ${chalk.cyan(tool)}`));
    });
    
    log.info(chalk.gray('\\n💡 These tools are called automatically when needed!\\n'));
  }
}
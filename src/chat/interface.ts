/**
 * @fileoverview Interactive chat interface for Orbitl smart contract analysis
 * Provides Claude Code-style chat experience with AI integration
 */

import { createInterface } from 'readline';
import chalk from 'chalk';
import ora from 'ora';

import { CloudflareAI, validateAICredentials } from '../ai/cloudflare-client.js';
import { OrbitlMCPServer } from '../mcp/server.js';
import { 
  ConversationManager, 
  type Conversation, 
  type ChatMessage 
} from './conversation.js';
import { isValidAddress } from '../types/contract.js';
import { SeiProvider, SEI_MAINNET_CONFIG, SEI_TESTNET_CONFIG } from '../blockchain/sei-provider.js';
import { ContractReader } from '../core/contract-reader.js';

/**
 * Configuration options for chat interface
 */
export interface ChatOptions {
  /** Network to use (mainnet/testnet) */
  network: string;
  /** Whether to continue previous conversation */
  continue?: boolean;
  /** Show detailed analysis data */
  verbose?: boolean;
}

/**
 * Interactive chat interface for smart contract analysis
 */
export class ChatInterface {
  private conversationManager: ConversationManager;
  private mcpServer: OrbitlMCPServer;
  private aiClient: CloudflareAI;
  private currentConversation: Conversation | null = null;
  private options: ChatOptions;

  constructor(options: ChatOptions) {
    this.options = options;
    this.conversationManager = new ConversationManager();
    this.mcpServer = new OrbitlMCPServer();
    
    // Initialize AI client with environment variables and model name
    const { apiToken, accountId, modelName } = validateAICredentials();
    this.aiClient = new CloudflareAI(apiToken, accountId, modelName);

    // Setup auto-save on interruption (Ctrl+C, Ctrl+Z, process exit)
    this.setupAutoSave();
  }

  /**
   * Setup automatic conversation saving on process interruption
   * Handles Ctrl+C (SIGINT), Ctrl+Z (SIGTSTP), and process exit
   */
  private setupAutoSave(): void {
    const autoSave = async () => {
      if (this.currentConversation && this.currentConversation.messages.length > 0) {
        try {
          // Generate summary for the conversation
          this.currentConversation.metadata.summary = 
            this.conversationManager.generateSummary(this.currentConversation);
          
          await this.conversationManager.saveConversation(this.currentConversation);
          console.log(chalk.gray(`\n💾 Auto-saved conversation: ${this.currentConversation.metadata.id}`));
        } catch (error) {
          console.error(chalk.red('\n❌ Failed to auto-save conversation'));
        }
      }
    };

    // Handle Ctrl+C (SIGINT)
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n⚠️  Interrupted! Auto-saving...'));
      await autoSave();
      process.exit(0);
    });

    // Handle Ctrl+Z (SIGTSTP) - though this suspends process
    process.on('SIGTSTP', async () => {
      console.log(chalk.yellow('\n⚠️  Suspending! Auto-saving...'));
      await autoSave();
      // Let the default handler suspend the process
      process.kill(process.pid, 'SIGTSTP');
    });

    // Handle normal process exit
    process.on('exit', () => {
      // Note: async operations don't work in 'exit' event
      // This is just for cleanup logging
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error(chalk.red('\n💥 Uncaught exception! Auto-saving...'));
      await autoSave();
      console.error(error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason) => {
      console.error(chalk.red('\n💥 Unhandled rejection! Auto-saving...'));
      await autoSave();
      console.error(reason);
      process.exit(1);
    });
  }

  /**
   * Start the interactive chat interface
   * Handles conversation loading, setup, and main chat loop
   */
  async start(): Promise<void> {
    console.log(chalk.blue.bold('🤖 Orbitl - Smart Contract AI Assistant'));
    console.log(chalk.gray(`🌐 Network: ${this.options.network === 'mainnet' ? 'Sei Mainnet' : 'Sei Testnet'}`));
    
    // Handle conversation continuation
    if (this.options.continue) {
      const latest = await this.conversationManager.getLatestConversation(this.options.network);
      if (latest) {
        this.currentConversation = latest;
        console.log(chalk.green('💾 Resuming conversation from ' + new Date(latest.metadata.lastModified).toLocaleString()));
        
        if (latest.metadata.contractsDiscussed.length > 0) {
          console.log(chalk.gray('📋 Previous contracts: ' + 
            latest.metadata.contractsDiscussed.map(addr => addr.slice(0, 8) + '...').join(', ')
          ));
        }
      } else {
        console.log(chalk.yellow('⚠️  No previous conversation found, starting new one'));
        this.currentConversation = await this.conversationManager.createConversation(this.options.network);
      }
    } else {
      this.currentConversation = await this.conversationManager.createConversation(this.options.network);
      console.log(chalk.green('💾 Starting new conversation (use --continue to resume)'));
    }

    console.log(chalk.gray('💬 Ask me anything about Sei contracts... (type "exit" to quit)\n'));

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('> '),
    });

    rl.prompt();

    rl.on('line', async (input) => {
      const trimmedInput = input.trim();
      
      if (trimmedInput === 'exit' || trimmedInput === 'quit') {
        await this.handleExit();
        rl.close();
        return;
      }

      if (trimmedInput === 'help') {
        this.showHelp();
        rl.prompt();
        return;
      }

      if (trimmedInput === 'history') {
        await this.showHistory();
        rl.prompt();
        return;
      }

      if (trimmedInput === '') {
        rl.prompt();
        return;
      }

      await this.processUserInput(trimmedInput);
      rl.prompt();
    });

    rl.on('close', async () => {
      await this.handleExit();
    });
  }

  /**
   * Process user input and generate AI response
   * Handles contract analysis via MCP and AI conversation
   * @param input User's chat input
   */
  private async processUserInput(input: string): Promise<void> {
    if (!this.currentConversation) {
      console.error(chalk.red('❌ No active conversation'));
      return;
    }

    // Add user message to conversation
    const contractAddress = this.conversationManager.extractContractAddress(input);
    this.conversationManager.addMessage(
      this.currentConversation, 
      'user', 
      input, 
      contractAddress || undefined
    );

    try {
      let response: string;
      let mcpContext: string | undefined;

      // Check if this input requires contract analysis
      if (contractAddress && isValidAddress(contractAddress)) {
        const spinner = ora('🔍 Analyzing contract...').start();
        
        try {
          // Use MCP server to analyze contract (simulate MCP call)
          const analysis = await this.analyzeContractDirect(contractAddress, this.options.network);
          
          mcpContext = analysis.content[0]?.text;
          spinner.succeed('Contract analyzed');

          if (this.options.verbose) {
            console.log(chalk.gray('\n📊 Raw Analysis:'));
            console.log(chalk.gray(mcpContext));
            console.log();
          }

        } catch (error) {
          spinner.fail('Analysis failed');
          console.error(chalk.red(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`));
          return;
        }
      }

      // Get AI response
      const aiSpinner = ora('🤖 Thinking...').start();
      
      try {
        if (mcpContext) {
          // First time analyzing this contract
          response = await this.aiClient.analyzeContract(mcpContext, input);
        } else {
          // Continue conversation with history
          const chatHistory = this.currentConversation.messages
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role, content: m.content })) as any[];
          
          response = await this.aiClient.continueConversation(chatHistory, input, mcpContext);
        }
        
        aiSpinner.succeed('Response ready');
      } catch (error) {
        aiSpinner.fail('AI request failed');
        console.error(chalk.red(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`));
        return;
      }

      // Display response with formatting
      console.log('\n' + this.formatResponse(response) + '\n');

      // Add AI response to conversation
      this.conversationManager.addMessage(
        this.currentConversation,
        'assistant',
        response,
        contractAddress || undefined
      );

      // Save conversation
      await this.conversationManager.saveConversation(this.currentConversation);

    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  private formatResponse(response: string): string {
    return response
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, chalk.bold('$1'))
      // Bullet points
      .replace(/^• (.+)$/gm, `  ${chalk.cyan('•')} $1`)
      .replace(/^- (.+)$/gm, `  ${chalk.cyan('•')} $1`)
      // Emojis and status indicators
      .replace(/✅/g, chalk.green('✅'))
      .replace(/❌/g, chalk.red('❌'))
      .replace(/⚠️/g, chalk.yellow('⚠️'))
      .replace(/💡/g, chalk.blue('💡'))
      .replace(/🔒/g, chalk.magenta('🔒'))
      .replace(/💰/g, chalk.yellow('💰'));
  }

  private showHelp(): void {
    console.log(chalk.blue('\n📖 Orbitl Chat Commands:'));
    console.log('  • Ask about any Sei contract: paste address or ask questions');
    console.log('  • "analyze 0x123..." - Analyze a specific contract');
    console.log('  • "is 0x123... safe?" - Get safety assessment');
    console.log('  • "what does swap() do?" - Explain functions (after analyzing)');
    console.log('  • "history" - Show recent conversations');
    console.log('  • "help" - Show this help');
    console.log('  • "exit" - Quit and save conversation\n');
  }

  private async showHistory(): Promise<void> {
    const conversations = await this.conversationManager.listConversations(5);
    
    if (conversations.length === 0) {
      console.log(chalk.gray('📂 No previous conversations found\n'));
      return;
    }

    console.log(chalk.blue('\n📂 Recent Conversations:'));
    conversations.forEach(conv => {
      const preview = this.conversationManager.formatConversationPreview(conv);
      console.log(`  ${preview}`);
    });
    console.log();
  }

  private async analyzeContractDirect(address: string, network: string) {
    const config = network === 'testnet' ? SEI_TESTNET_CONFIG : SEI_MAINNET_CONFIG;
    const provider = new SeiProvider(config);
    const reader = new ContractReader(provider);

    const contractData = await reader.read(address);
    
    // Format the same way as MCP server
    const safetyIndicator = contractData.isVerified ? '✅' : '❌';
    const typeEmoji = {
      'Token': '💰',
      'DEX': '🔄', 
      'Farm': '🌾',
      'Unknown': '❓'
    }[contractData.basicType] || '❓';

    const analysis = `${typeEmoji} **Contract Analysis Results**

**Basic Information:**
• Address: ${contractData.address}
• Type: ${contractData.basicType}
• Verified: ${safetyIndicator} ${contractData.isVerified ? 'Yes' : 'No'}
• Network: ${contractData.isVerified ? 'Source verified on Seitrace' : 'Unverified - HIGH RISK'}

**Function Summary:**
• Total Functions: ${contractData.functionCount}
• Read-Only: ${contractData.readOnlyFunctions.length} functions
• State-Changing: ${contractData.writeFunctions.length} functions

**Key Functions:**
${contractData.abi.slice(0, 8).map(f => 
  `• ${f.name}() - ${ContractReader.getFunctionDescription(f)}`
).join('\n')}${contractData.abi.length > 8 ? `\n• ... and ${contractData.abi.length - 8} more functions` : ''}`;

    return {
      content: [{ type: "text", text: analysis }]
    };
  }

  private async handleExit(): Promise<void> {
    if (this.currentConversation && this.currentConversation.messages.length > 0) {
      console.log(chalk.gray('\n💾 Saving conversation...'));
      
      // Generate summary for the conversation
      this.currentConversation.metadata.summary = 
        this.conversationManager.generateSummary(this.currentConversation);
      
      await this.conversationManager.saveConversation(this.currentConversation);
      console.log(chalk.green(`✅ Conversation saved as: ${this.currentConversation.metadata.id}`));
    }
    
    console.log(chalk.blue('👋 Goodbye!\n'));
  }
}
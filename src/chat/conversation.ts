/**
 * @fileoverview Conversation management for Orbitl chat sessions
 * Handles saving/loading conversation history and context with auto-recovery
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Individual chat message in a conversation
 */
export interface ChatMessage {
  /** Message role */
  role: 'user' | 'assistant' | 'system';
  /** Message content */
  content: string;
  /** Unix timestamp when message was created */
  timestamp: number;
  /** Contract address if message relates to specific contract */
  contractAddress?: string;
}

/**
 * Conversation metadata for organization and search
 */
export interface ConversationMetadata {
  /** Unique conversation identifier */
  id: string;
  /** Unix timestamp when conversation was created */
  created: number;
  /** Unix timestamp when conversation was last modified */
  lastModified: number;
  /** Network the conversation was conducted on */
  network: string;
  /** Total number of messages in conversation */
  messageCount: number;
  /** List of contract addresses discussed */
  contractsDiscussed: string[];
  /** Human-readable summary of conversation */
  summary?: string;
}

/**
 * Complete conversation with metadata and message history
 */
export interface Conversation {
  metadata: ConversationMetadata;
  messages: ChatMessage[];
}

/**
 * Manages conversation persistence and organization
 * Handles auto-save, recovery, and conversation history
 */
export class ConversationManager {
  private conversationsDir: string;

  constructor() {
    this.conversationsDir = join(homedir(), '.orbitl', 'conversations');
  }

  async ensureDirectoryExists(): Promise<void> {
    if (!existsSync(this.conversationsDir)) {
      await mkdir(this.conversationsDir, { recursive: true });
    }
  }

  private generateConversationId(): string {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 16).replace('T', '-').replace(':', '-');
    return `${timestamp}-${Math.random().toString(36).substr(2, 6)}`;
  }

  async createConversation(network: string): Promise<Conversation> {
    await this.ensureDirectoryExists();
    
    const id = this.generateConversationId();
    const now = Date.now();
    
    const conversation: Conversation = {
      metadata: {
        id,
        created: now,
        lastModified: now,
        network,
        messageCount: 0,
        contractsDiscussed: [],
      },
      messages: [],
    };

    return conversation;
  }

  async saveConversation(conversation: Conversation): Promise<void> {
    await this.ensureDirectoryExists();
    
    const filename = `${conversation.metadata.id}.json`;
    const filepath = join(this.conversationsDir, filename);
    
    // Update metadata
    conversation.metadata.lastModified = Date.now();
    conversation.metadata.messageCount = conversation.messages.length;
    
    // Extract contracts discussed
    const contracts = new Set(
      conversation.messages
        .filter(m => m.contractAddress)
        .map(m => m.contractAddress!)
    );
    conversation.metadata.contractsDiscussed = Array.from(contracts);

    await writeFile(filepath, JSON.stringify(conversation, null, 2));
  }

  async loadConversation(id: string): Promise<Conversation | null> {
    try {
      const filename = `${id}.json`;
      const filepath = join(this.conversationsDir, filename);
      const content = await readFile(filepath, 'utf-8');
      return JSON.parse(content) as Conversation;
    } catch (error) {
      return null;
    }
  }

  async getLatestConversation(network?: string): Promise<Conversation | null> {
    try {
      await this.ensureDirectoryExists();
      const files = await readdir(this.conversationsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      if (jsonFiles.length === 0) {
        return null;
      }

      // Sort by filename (contains timestamp) to get latest
      const sortedFiles = jsonFiles.sort().reverse();
      
      // Find latest conversation, optionally filtered by network
      for (const file of sortedFiles) {
        const conversation = await this.loadConversation(file.replace('.json', ''));
        if (conversation && (!network || conversation.metadata.network === network)) {
          return conversation;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async listConversations(limit = 10): Promise<ConversationMetadata[]> {
    try {
      await this.ensureDirectoryExists();
      const files = await readdir(this.conversationsDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      const conversations: ConversationMetadata[] = [];
      
      for (const file of jsonFiles.slice(0, limit)) {
        try {
          const conversation = await this.loadConversation(file.replace('.json', ''));
          if (conversation) {
            conversations.push(conversation.metadata);
          }
        } catch (error) {
          // Skip corrupted files
          continue;
        }
      }

      // Sort by last modified (newest first)
      return conversations.sort((a, b) => b.lastModified - a.lastModified);
    } catch (error) {
      return [];
    }
  }

  addMessage(
    conversation: Conversation, 
    role: 'user' | 'assistant', 
    content: string, 
    contractAddress?: string
  ): void {
    conversation.messages.push({
      role,
      content,
      timestamp: Date.now(),
      contractAddress,
    });
  }

  generateSummary(conversation: Conversation): string {
    const { messages, metadata } = conversation;
    
    if (messages.length === 0) {
      return 'Empty conversation';
    }

    const contractCount = metadata.contractsDiscussed.length;
    const messageCount = metadata.messageCount;
    
    // Extract key topics from first few messages
    const firstUserMessage = messages.find(m => m.role === 'user')?.content || '';
    const hasAnalysis = firstUserMessage.toLowerCase().includes('analyz');
    const hasSafety = messages.some(m => m.content && m.content.toLowerCase().includes('safe'));
    
    let summary = '';
    
    if (contractCount > 0) {
      const contractText = contractCount === 1 ? 'contract' : 'contracts';
      summary += `Discussed ${contractCount} ${contractText}`;
      
      if (metadata.contractsDiscussed.length > 0) {
        const shortAddr = metadata.contractsDiscussed[0]?.slice(0, 8) + '...';
        summary += ` (${shortAddr}`;
        if (contractCount > 1) summary += ` +${contractCount - 1} more`;
        summary += ')';
      }
    }
    
    if (hasAnalysis) summary += ', analyzed contracts';
    if (hasSafety) summary += ', discussed safety';
    
    if (!summary) {
      summary = `${messageCount} message conversation`;
    }

    return summary;
  }

  formatConversationPreview(metadata: ConversationMetadata): string {
    const date = new Date(metadata.lastModified).toLocaleDateString();
    const time = new Date(metadata.lastModified).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const summary = metadata.summary || this.generateSummaryFromMetadata(metadata);
    const network = metadata.network === 'mainnet' ? '🌐' : '🧪';
    
    return `${network} ${metadata.id} - ${date} ${time}\n   ${summary} (${metadata.messageCount} messages)`;
  }

  private generateSummaryFromMetadata(metadata: ConversationMetadata): string {
    if (metadata.contractsDiscussed.length === 0) {
      return 'General conversation';
    }
    
    const contractCount = metadata.contractsDiscussed.length;
    if (contractCount === 1) {
      return `Contract ${metadata.contractsDiscussed[0]?.slice(0, 8)}...`;
    }
    
    return `${contractCount} contracts discussed`;
  }

  extractContractAddress(text: string): string | null {
    // Look for Ethereum-style addresses (0x followed by 40 hex chars)
    const addressMatch = text.match(/0x[a-fA-F0-9]{40}/);
    return addressMatch ? addressMatch[0] : null;
  }
}
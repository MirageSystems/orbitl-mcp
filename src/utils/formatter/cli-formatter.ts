/**
 * CLI Formatter using existing UI components
 */

import chalk from 'chalk';
import { UIComponents } from './ui-components.js';
import type { DetailedTransactionPreview } from '../../wallet/types.js';

export class CLIFormatter {
  /**
   * Parse and format AI responses with network context
   */
  static parseAndFormat(text: string, network: 'mainnet' | 'testnet'): string {
    return UIComponents.formatBasicText(text);
  }

  /**
   * Format transaction preview for display
   */
  static formatTransactionPreview(preview: DetailedTransactionPreview): string {
    let output = `\nTransaction Preview\n`;
    output += `═`.repeat(50) + '\n';
    
    output += `Action: ${preview.action}\n`;
    output += `Risk Level: [${preview.riskLevel}]\n`;
    output += `Contract Verified: ${preview.contractVerified ? '✓ Yes' : '✗ No'}\n`;
    output += `Total Cost: ${preview.totalCost}\n`;
    
    if (preview.warnings && preview.warnings.length > 0) {
      output += `\nWarnings:\n`;
      preview.warnings.forEach(warning => output += `  • ${warning}\n`);
    }
    
    output += `\nOrbitl NEVER handles your private keys\n`;
    output += `═`.repeat(50);
    
    return output;
  }

  /**
   * Format error messages with suggestions
   */
  static formatError(message: string, suggestions: string[] = []): string {
    let output = chalk.red(`Error: ${message}\n`);
    
    if (suggestions.length > 0) {
      output += chalk.yellow(`\nSuggestions:\n`);
      suggestions.forEach(suggestion => {
        output += chalk.yellow(`  • ${suggestion}\n`);
      });
    }
    
    return output;
  }

  /**
   * Format welcome screen for chat interface
   */
  static formatWelcome(network: 'mainnet' | 'testnet'): string {
    let output = '';
    
    // Beautiful header using UIComponents
    output += UIComponents.createHeader('ORBITL', '🚀 AI Contract Analyst');
    output += '\n\n';

    // Network status box using UIComponents
    const networkInfo = [
      `${chalk.bold('Network:')} ${chalk.blue(network === 'mainnet' ? 'Sei Pacific-1 (Mainnet)' : 'Sei Atlantic-2 (Testnet)')}`,
      `${chalk.bold('Status:')} ${chalk.green('🟢 Connected')}`,
      `${chalk.bold('Tools:')} ${chalk.cyan('12 analysis tools loaded')}`
    ].join('\n');

    output += UIComponents.createBox(networkInfo, {
      title: '🌐 Network Status',
      color: 'blue'
    });

    output += '\n\n';
    output += chalk.cyan('💬 Just paste a contract address or ask about contracts!');
    output += chalk.gray('\n📝 Type "help" for examples, "tools" to see available tools\n');

    return output;
  }

  /**
   * Format help screen using UIComponents
   */
  static formatHelp(): string {
    let output = '';

    // App header using UIComponents
    output += UIComponents.createHeader('ORBITL', '🚀 AI Contract Analyst for Sei Network');
    output += '\n\n';

    // Commands using UIComponents table
    const commands = [
      ['help', 'Show this help message'],
      ['clear', 'Clear conversation history'],
      ['tools', 'Show available analysis tools'],
      ['exit', 'Exit Orbitl']
    ];

    output += UIComponents.createTable(['Command', 'Description'], commands);
    output += '\n\n';

    // Examples section
    output += chalk.bold('Examples:\n');
    const examples = [
      '"analyze 0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456"',
      '"what is USDC?"',
      '"send 100 USDC to 0x123..."',
      '"check safety of 0xabc..."'
    ];
    examples.forEach(example => {
      output += chalk.gray(`  • ${example}\n`);
    });

    return output;
  }

  /**
   * Format tool list using UIComponents
   */
  static formatTools(tools: string[]): string {
    let output = chalk.bold('Available AI Tools:\n\n');
    
    const categories = {
      'Analysis': tools.filter(t => t.includes('analyze') || t.includes('check') || t.includes('function')),
      'Transaction': tools.filter(t => t.includes('build') || t.includes('lookup')),
      'Wallet': tools.filter(t => t.includes('connect') || t.includes('simulate') || t.includes('execute'))
    };

    Object.entries(categories).forEach(([category, categoryTools]) => {
      if (categoryTools.length > 0) {
        output += chalk.blue(`${category}:\n`);
        categoryTools.forEach(tool => {
          output += `  • ${tool}\n`;
        });
        output += '\n';
      }
    });

    return output;
  }
}
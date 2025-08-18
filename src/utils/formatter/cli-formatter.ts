/**
 * @fileoverview Main CLI formatter class
 */

import chalk from 'chalk';
import { UIComponents } from './ui-components.js';
import { ResponseParser } from './response-parser.js';
import type { ContractAnalysisData } from './types.js';

export class CLIFormatter {
  
  /**
   * Format contract analysis results beautifully
   */
  static formatContractAnalysis(analysis: ContractAnalysisData): string {
    let output = '';

    // Contract Information Box
    output += this.formatContractInfo(analysis);
    output += '\n\n';

    // Safety Assessment Box
    output += this.formatSafetyAssessment(analysis);
    output += '\n\n';

    // Key Functions Table (if available)
    if (analysis.keyFunctions && analysis.keyFunctions.length > 0) {
      output += this.formatFunctionsTable(analysis.keyFunctions);
      output += '\n\n';
    }

    // Summary Box
    if (analysis.summary) {
      output += this.formatSummary(analysis.summary);
    }

    return output;
  }

  /**
   * Format contract information section
   */
  private static formatContractInfo(analysis: ContractAnalysisData): string {
    const content = [
      `${chalk.bold('Address:')} ${chalk.magenta(analysis.address || 'N/A')}`,
      `${chalk.bold('Type:')} ${UIComponents.getTypeIcon(analysis.type)} ${chalk.cyan(analysis.type)}`,
      `${chalk.bold('Network:')} ${chalk.blue(analysis.network)}`,
      `${chalk.bold('Verified:')} ${analysis.verified ? chalk.green('✅ Yes') : chalk.red('❌ No')}`
    ].join('\n');

    return UIComponents.createBox(content, {
      title: '📊 Contract Information',
      color: 'cyan'
    });
  }

  /**
   * Format safety assessment section
   */
  private static formatSafetyAssessment(analysis: ContractAnalysisData): string {
    const safetyColor = UIComponents.getSafetyColor(analysis.safetyScore);
    
    const content = [
      `${chalk.bold('Score:')} ${UIComponents.formatSafetyScore(analysis.safetyScore)}`,
      `${chalk.bold('Status:')} ${UIComponents.getRecommendationBadge(analysis.recommendation)}`,
      analysis.risks && analysis.risks.length > 0 ? 
        `${chalk.bold('Risks:')} ${analysis.risks.length} identified` :
        `${chalk.bold('Risks:')} ${chalk.green('None detected')}`
    ].join('\n');

    return UIComponents.createBox(content, {
      title: '🛡️ Safety Assessment',
      color: safetyColor
    });
  }

  /**
   * Format functions table
   */
  private static formatFunctionsTable(functions: ContractAnalysisData['keyFunctions']): string {
    if (!functions || functions.length === 0) return '';

    let output = chalk.bold.blue('🔧 Key Functions\n\n');
    
    const rows = functions.slice(0, 8).map(func => [
      chalk.yellow(func.name),
      UIComponents.getRiskBadge(func.risk),
      chalk.gray(func.type || 'unknown'),
      func.description || `Execute ${func.name}`
    ]);

    output += UIComponents.createTable(
      ['Function', 'Risk', 'Type', 'Description'],
      rows,
      {
        colWidths: [25, 10, 12, 35],
        headerColor: 'cyan'
      }
    );
    
    if (functions.length > 8) {
      output += chalk.gray(`\n... and ${functions.length - 8} more functions`);
    }

    return output;
  }

  /**
   * Format summary section
   */
  private static formatSummary(summary: ContractAnalysisData['summary']): string {
    if (!summary) return '';

    const content = `📋 ${summary.totalFunctions} total functions • ` +
                   `${summary.readOnlyFunctions} read-only • ` +
                   `${summary.stateMutatingFunctions} state-changing`;

    return UIComponents.createBox(content, {
      title: '📈 Summary',
      color: 'gray'
    });
  }

  /**
   * Format welcome screen
   */
  static formatWelcome(network: string): string {
    let output = '';
    
    // Beautiful header
    output += UIComponents.createHeader('ORBITL', '🚀 AI Smart Contract Analyst');
    output += '\n\n';

    // Network status box
    const networkInfo = [
      `${chalk.bold('Network:')} ${chalk.blue(network === 'mainnet' ? 'Sei Pacific-1 (Mainnet)' : 'Sei Atlantic-2 (Testnet)')}`,
      `${chalk.bold('Status:')} ${chalk.green('🟢 Connected')}`,
      `${chalk.bold('Tools:')} ${chalk.cyan('5 analysis tools loaded')}`
    ].join('\n');

    output += UIComponents.createBox(networkInfo, {
      title: '🌐 Network Status',
      color: 'blue'
    });

    output += '\n\n';
    output += chalk.cyan('💬 Just paste a contract address or ask about smart contracts!');
    output += chalk.gray('\n📝 Type "help" for examples, "tools" to see available tools\n');

    return output;
  }

  /**
   * Format help screen
   */
  static formatHelp(): string {
    let output = '';

    // App header
    output += UIComponents.createHeader('ORBITL', '🚀 AI Smart Contract Analyst for Sei Network');
    output += '\n\n';

    // Commands table
    const commandRows = [
      ['help', 'Show this help message'],
      ['clear', 'Clear conversation history'],
      ['tools', 'Show available analysis tools'],
      ['exit', 'Exit Orbitl']
    ].map(([cmd, desc]) => [chalk.yellow(cmd), desc]);

    output += chalk.bold.blue('🔧 Commands\n\n');
    output += UIComponents.createTable(['Command', 'Description'], commandRows, {
      colWidths: [15, 50]
    });
    output += '\n\n';

    // Examples section
    const examples = [
      'Analyze 0x882f62fe8e9594470d1da0f70bc85096f6c60423',
      'What is 0x1234...? Is it safe?',
      'Show me the swap function details',
      'Build a transaction to stake 100 tokens',
      'How much gas does approve cost?'
    ];

    output += chalk.bold.blue('💡 Example Queries\n\n');
    examples.forEach((example, i) => {
      output += chalk.gray(`${i + 1}. `) + chalk.cyan(`"${example}"`);
      if (i < examples.length - 1) output += '\n';
    });

    output += '\n\n';

    // Tips box
    const tips = [
      '• Just paste any contract address - I will analyze it automatically',
      '• Ask follow-up questions - I remember our conversation',
      '• I can chain multiple tools together for complete analysis',
      '• For verified contracts, I will show detailed function breakdowns'
    ].join('\n');

    output += UIComponents.createBox(tips, {
      title: '🎯 Pro Tips',
      color: 'green'
    });

    return output;
  }

  /**
   * Format error message
   */
  static formatError(error: string, suggestions?: string[]): string {
    let output = '';
    
    // Error box
    output += UIComponents.createBox(`❌ ${error}`, {
      title: '⚠️ Error',
      color: 'red'
    });

    if (suggestions && suggestions.length > 0) {
      output += '\n\n';
      const suggestionText = suggestions.map(s => `• ${s}`).join('\n');
      output += UIComponents.createBox(suggestionText, {
        title: '💡 Suggestions',
        color: 'yellow'
      });
    }

    return output;
  }

  /**
   * Parse and format any AI response
   */
  static parseAndFormat(response: string, network: string): string {
    // Check if this is contract analysis
    if (ResponseParser.isContractAnalysis(response)) {
      const contractData = ResponseParser.parseContractAnalysis(response, network);
      
      // Use beautiful formatter if we have meaningful data
      if (contractData.address || contractData.type !== 'Unknown') {
        return this.formatContractAnalysis(contractData);
      }
    }
    
    // Fallback to basic text formatting
    return UIComponents.formatBasicText(response);
  }
}
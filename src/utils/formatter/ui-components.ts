/**
 * @fileoverview UI Components for CLI formatting
 */

import chalk from 'chalk';
import boxen from 'boxen';
import figlet from 'figlet';
import gradient from 'gradient-string';
import Table from 'cli-table3';
import type { BoxOptions, SafetyColor, RiskLevel } from './types.js';

export class UIComponents {
  
  /**
   * Create beautiful ASCII art header with gradient
   */
  static createHeader(text: string, subtitle?: string): string {
    const header = figlet.textSync(text, { 
      font: 'ANSI Shadow',
      horizontalLayout: 'fitted',
      width: 80
    });
    
    const gradientHeader = gradient(['#FF6B6B', '#4ECDC4'])(header);
    
    let result = gradientHeader;
    if (subtitle) {
      result += '\n' + chalk.gray.italic(subtitle);
    }
    
    return result;
  }

  /**
   * Create a styled box with content
   */
  static createBox(content: string, options: BoxOptions = {}): string {
    const { title, color = 'cyan', padding = 1 } = options;
    
    return boxen(content, {
      padding,
      borderStyle: 'round',
      borderColor: color,
      title: title ? ` ${title} ` : undefined,
      titleAlignment: 'center'
    });
  }

  /**
   * Create a structured table
   */
  static createTable(headers: string[], rows: string[][], options: {
    colWidths?: number[];
    headerColor?: string;
  } = {}): string {
    const { colWidths, headerColor = 'cyan' } = options;
    
    const table = new Table({
      head: headers,
      colWidths,
      style: {
        head: [headerColor, 'bold'],
        border: ['grey']
      }
    });

    rows.forEach(row => table.push(row));
    return table.toString();
  }

  /**
   * Get icon for contract type
   */
  static getTypeIcon(type: string): string {
    const icons = {
      'DEX': '🔄',
      'Token': '💰',
      'Farm': '🌾',
      'NFT': '🎨',
      'Unknown': '❓'
    };
    return icons[type as keyof typeof icons] || '📜';
  }

  /**
   * Get color for safety score
   */
  static getSafetyColor(score: number): SafetyColor {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    return 'red';
  }

  /**
   * Get styled safety score display
   */
  static formatSafetyScore(score: number): string {
    const color = this.getSafetyColor(score);
    const scoreText = `${score}/100`;
    
    switch (color) {
      case 'green': return chalk.green(scoreText);
      case 'yellow': return chalk.yellow(scoreText);
      case 'red': return chalk.red(scoreText);
    }
  }

  /**
   * Get recommendation badge
   */
  static getRecommendationBadge(recommendation: string): string {
    const badges = {
      'SAFE': chalk.green('✅ SAFE'),
      'CAUTION': chalk.yellow('⚠️ CAUTION'),
      'DANGEROUS': chalk.red('❌ DANGEROUS')
    };
    return badges[recommendation as keyof typeof badges] || chalk.gray('❓ UNKNOWN');
  }

  /**
   * Get risk level badge
   */
  static getRiskBadge(risk: RiskLevel): string {
    const badges = {
      'NONE': chalk.green('SAFE'),
      'LOW': chalk.blue('LOW'),
      'MEDIUM': chalk.yellow('MED'),
      'HIGH': chalk.red('HIGH'),
      'CRITICAL': chalk.red.bold('CRIT')
    };
    return badges[risk] || chalk.gray('?');
  }

  /**
   * Format basic text response with simple styling
   */
  static formatBasicText(text: string): string {
    return text
      // Headers and sections
      .replace(/^(#{1,3})\s*(.+)$/gm, (match, hashes, content) => {
        const level = hashes.length;
        if (level === 1) return chalk.blue.bold(`\n🔷 ${content}`);
        if (level === 2) return chalk.cyan.bold(`\n▫️ ${content}`);
        return chalk.gray.bold(`\n  • ${content}`);
      })
      // Bold text
      .replace(/\*\*(.+?)\*\*/g, chalk.bold('$1'))
      // Code/addresses
      .replace(/`([^`]+)`/g, chalk.cyan('$1'))
      .replace(/(0x[a-fA-F0-9]{40})/g, chalk.magenta('$1'))
      // Status indicators
      .replace(/✅/g, chalk.green('✅'))
      .replace(/❌/g, chalk.red('❌'))
      .replace(/⚠️/g, chalk.yellow('⚠️'))
      // Risk levels
      .replace(/\bCRITICAL\b/g, chalk.red.bold('CRITICAL'))
      .replace(/\bHIGH\b/g, chalk.red('HIGH'))
      .replace(/\bMEDIUM\b/g, chalk.yellow('MEDIUM'))
      .replace(/\bLOW\b/g, chalk.green('LOW'))
      .replace(/\bSAFE\b/g, chalk.green.bold('SAFE'))
      .replace(/\bDANGEROUS\b/g, chalk.red.bold('DANGEROUS'));
  }
}
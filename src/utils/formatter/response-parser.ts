/**
 * @fileoverview Parse AI responses into structured data
 */

import type { ContractAnalysisData, FunctionInfo } from './types.js';

export class ResponseParser {
  
  /**
   * Check if response contains contract analysis data
   */
  static isContractAnalysis(response: string): boolean {
    return response.includes('Contract Analysis') || 
           response.includes('Safety Score') ||
           response.includes('Contract Type') ||
           (response.includes('0x') && response.includes('function'));
  }

  /**
   * Parse AI response into contract analysis data
   */
  static parseContractAnalysis(response: string, network: string): ContractAnalysisData {
    return {
      address: this.extractAddress(response),
      type: this.extractType(response),
      verified: this.extractVerified(response),
      network,
      safetyScore: this.extractSafetyScore(response),
      recommendation: this.extractRecommendation(response),
      keyFunctions: this.extractFunctions(response),
      summary: {
        totalFunctions: this.extractTotalFunctions(response),
        readOnlyFunctions: 0,
        stateMutatingFunctions: 0
      }
    };
  }

  /**
   * Extract contract address from response
   */
  private static extractAddress(response: string): string | null {
    const match = response.match(/0x[a-fA-F0-9]{40}/);
    return match ? match[0] : null;
  }

  /**
   * Extract contract type from response
   */
  private static extractType(response: string): ContractAnalysisData['type'] {
    if (response.includes('DEX') || response.includes('Decentralized Exchange')) return 'DEX';
    if (response.includes('Token')) return 'Token';
    if (response.includes('Farm')) return 'Farm';
    if (response.includes('NFT')) return 'NFT';
    return 'Unknown';
  }

  /**
   * Extract verification status
   */
  private static extractVerified(response: string): boolean {
    return response.includes('verified') && !response.includes('not verified');
  }

  /**
   * Extract safety score
   */
  private static extractSafetyScore(response: string): number {
    const match = response.match(/safety score[^\d]*(\d+)/i);
    return match ? parseInt(match[1] || '50') : 50;
  }

  /**
   * Extract recommendation
   */
  private static extractRecommendation(response: string): ContractAnalysisData['recommendation'] {
    const lower = response.toLowerCase();
    if (lower.includes('dangerous')) return 'DANGEROUS';
    if (lower.includes('caution')) return 'CAUTION';
    if (lower.includes('safe')) return 'SAFE';
    return 'CAUTION';
  }

  /**
   * Extract functions from response
   */
  private static extractFunctions(response: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    
    // Look for function patterns like "1. **burn**: description (MEDIUM risk)"
    const functionMatches = response.match(/\d+\.\s*\*\*([^*]+)\*\*[^\n]*/g) || [];
    
    for (const match of functionMatches.slice(0, 8)) {
      const nameMatch = match.match(/\*\*([^*]+)\*\*/);
      const riskMatch = match.match(/(CRITICAL|HIGH|MEDIUM|LOW|NONE)/i);
      const descriptionMatch = match.match(/\*\*[^*]+\*\*:\s*([^(]+)/);
      
      if (nameMatch && nameMatch[1]) {
        const name = nameMatch[1].trim();
        functions.push({
          name,
          risk: (riskMatch?.[1]?.toUpperCase() as FunctionInfo['risk']) || 'LOW',
          type: 'nonpayable',
          description: descriptionMatch?.[1]?.trim() || `Execute ${name}`
        });
      }
    }
    
    return functions;
  }

  /**
   * Extract total functions count
   */
  private static extractTotalFunctions(response: string): number {
    const match = response.match(/(\d+)\s+total\s+functions/i);
    return match ? parseInt(match[1] || '0') : 0;
  }
}
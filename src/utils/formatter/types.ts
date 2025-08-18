/**
 * @fileoverview Type definitions for formatter
 */

export interface ContractAnalysisData {
  address: string | null;
  type: 'DEX' | 'Token' | 'Farm' | 'NFT' | 'Unknown';
  verified: boolean;
  network: string;
  safetyScore: number;
  recommendation: 'SAFE' | 'CAUTION' | 'DANGEROUS';
  keyFunctions?: FunctionInfo[];
  risks?: string[];
  summary?: {
    totalFunctions: number;
    readOnlyFunctions: number;
    stateMutatingFunctions: number;
  };
}

export interface FunctionInfo {
  name: string;
  risk: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: string;
  description: string;
  signature?: string;
}

export interface BoxOptions {
  title?: string;
  color?: 'cyan' | 'green' | 'yellow' | 'red' | 'gray' | 'blue';
  padding?: number;
}

export type SafetyColor = 'green' | 'yellow' | 'red';
export type RiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
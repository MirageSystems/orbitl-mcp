/**
 * Formatter type definitions
 */

export interface BoxOptions {
  title?: string;
  color?: 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray';
  borderColor?: 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray';
  padding?: number;
  margin?: number;
  backgroundColor?: string;
  borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic';
}

export type SafetyColor = 'red' | 'yellow' | 'green';

export type RiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TableOptions {
  border?: boolean;
  compact?: boolean;
}
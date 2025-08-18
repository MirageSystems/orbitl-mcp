// Core transaction data types for Orbitl's Safe Transaction Builder
// These interfaces define the structure for building transactions without handling private keys

/**
 * Basic transaction data that will be sent to the network
 * Contains only the essential fields needed for transaction execution
 */
export interface TransactionData {
  to: string;           // Contract address to interact with
  data: string;         // Encoded function call data
  value: string;        // ETH/SEI value to send (usually "0" for token transactions)
  gasLimit?: string;    // Estimated gas limit for the transaction
  gasPrice?: string;    // Gas price for transaction execution
}

/**
 * Enhanced transaction data with safety features and preview information
 * This is what our SafeTransactionBuilder returns to provide comprehensive transaction info
 */
export interface SafeTransactionData {
  transaction: TransactionData;           // The actual transaction to execute
  preview: TransactionPreview;           // Human-readable transaction summary
  safetyScore: number;                   // Safety score from 0-100
  gasEstimate?: GasEstimate;            // Detailed gas cost estimation
}

/**
 * Human-readable transaction preview for user confirmation
 * Shows what the transaction will do in plain language
 */
export interface TransactionPreview {
  humanDescription: string;              // "Transfer 100 USDC to Alice"
  contractName: string;                 // "USDC Token Contract"
  riskLevel: RiskLevel;                 // Risk assessment
  warnings: string[];                   // Safety warnings for the user
  estimatedCost?: string;               // "$0.52" - human readable cost
}

/**
 * Detailed transaction preview with enhanced information
 * Used for comprehensive transaction analysis and display
 */
export interface DetailedTransactionPreview {
  action: string;                       // "transfer", "approve", "swap"
  riskLevel: RiskLevel;                 // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  contractVerified: boolean;            // true/false
  totalCost: string;                    // "$0.52 total cost"
  warnings?: string[];                  // Safety warnings for the user
}

/**
 * Parameter display information for transaction previews
 */
export interface PreviewParameter {
  name: string;                         // "recipient"
  value: string;                        // "0x742d35..."
  displayValue: string;                 // "alice.eth" or formatted display
  type: ParameterType;                  // Type of parameter
}

/**
 * Types of parameters in transactions
 */
export type ParameterType = 'address' | 'amount' | 'percentage' | 'duration' | 'boolean' | 'string';

/**
 * User confirmation requirements
 */
export interface UserConfirmation {
  type: 'warning' | 'info' | 'critical'; // Severity level
  message: string;                       // Message to display
  userMustAcknowledge: boolean;          // Whether user must explicitly confirm
}

/**
 * Gas estimation details for cost prediction
 */
export interface GasEstimate {
  gasLimit: string;                     // Estimated gas units needed
  gasPrice: string;                     // Current network gas price  
  estimatedCost: string;               // Human readable cost ("$0.50")
  estimatedCostWei: string;            // Cost in wei for precise calculations
  confidence: EstimateConfidence;       // How confident we are in the estimate
  buffer: number;                      // Safety buffer percentage (20 = 20% buffer)
}

/**
 * Risk levels for transaction safety assessment
 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Confidence levels for gas estimation
 */
export type EstimateConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

/**
 * Context information for building transactions
 * Used to provide additional information about the transaction intent
 */
export interface TransactionContext {
  userAddress?: string;                 // User's wallet address (if available)
  tokenSymbol?: string;                // "USDC", "SEI", etc.
  amount?: string;                     // Amount being transferred/approved
  recipient?: string;                  // Recipient address for transfers
  spender?: string;                    // Spender address for approvals
}

/**
 * Input validation result for transaction parameters
 */
export interface ValidationResult {
  isValid: boolean;                    // Whether the input is valid
  errors: string[];                    // List of validation errors
  warnings: string[];                  // List of warnings (non-blocking)
  suggestions: string[];               // Helpful suggestions for fixing issues
}

/**
 * Standard ERC-20 token information
 */
export interface TokenInfo {
  symbol: string;                      // "USDC"
  address: string;                     // Contract address
  decimals: number;                    // Token decimal places
  name: string;                        // Full token name
}

/**
 * Error class for transaction building failures
 */
export class TransactionBuildError extends Error {
  constructor(
    message: string,
    public code: string,
    public suggestions: string[] = []
  ) {
    super(message);
    this.name = 'TransactionBuildError';
  }
}

/**
 * Error class for validation failures
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public suggestions: string[] = []
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
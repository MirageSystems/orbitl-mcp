/**
 * @fileoverview Tool manager for contract analysis tools
 * Registers all tools with the new CloudflareAIToolCaller
 */

import { AIClient } from './client.js';
import { ContractReader } from '../analysis/reader.js';
import { SeiProvider, SEI_MAINNET_CONFIG, SEI_TESTNET_CONFIG } from '../network/sei.js';
import type { ContractData, ABIFunction } from '../analysis/types.js';
import log from '../utils/logger.js';

/**
 * Setup and register all contract analysis tools
 */
export async function setupContractTools(ai: AIClient, network: 'mainnet' | 'testnet' = 'mainnet') {
  // Initialize contract readers for both networks
  const mainnetReader = new ContractReader(new SeiProvider(SEI_MAINNET_CONFIG));
  const testnetReader = new ContractReader(new SeiProvider(SEI_TESTNET_CONFIG));
  
  const getReader = (net?: string) => {
    return (net === 'testnet' || network === 'testnet') ? testnetReader : mainnetReader;
  };

  // ============================================
  // TOOL 1: ANALYZE CONTRACT
  // ============================================
  ai.registerTool(
    'analyze_contract',
    'Analyze a smart contract on Sei Network to understand its type, functions, verification status, and safety',
    {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'The contract address to analyze (0x...)'
        },
        network: {
          type: 'string',
          description: 'Network to use: mainnet or testnet',
          enum: ['mainnet', 'testnet']
        }
      },
      required: ['address']
    },
    async (args: { address: string; network?: string }) => {
      log.contract.analyzing(args.address, args.network || network);
      
      const reader = getReader(args.network);
      const analysis = await reader.read(args.address);
      
      log.contract.analyzed(args.address, analysis.basicType, analysis.functionCount, analysis.isVerified);
      
      const result = {
        address: analysis.address,
        type: analysis.basicType,
        verified: analysis.isVerified,
        network: args.network || network,
        summary: {
          totalFunctions: analysis.functionCount,
          readOnlyFunctions: analysis.readOnlyFunctions.length,
          stateMutatingFunctions: analysis.writeFunctions.length
        },
        keyFunctions: analysis.abi.slice(0, 10).map(func => ({
          name: func.name,
          type: func.stateMutability,
          risk: assessRisk(func),
          description: getFunctionDescription(func),
          signature: ContractReader.formatFunctionSignature(func)
        })),
        risks: getContractRisks(analysis),
        safetyScore: calculateSafetyScore(analysis),
        recommendation: analysis.isVerified ? 
          (analysis.basicType === 'Unknown' ? 'CAUTION' : 'SAFE') : 
          'DANGEROUS'
      };
      
      return result;
    }
  );

  // ============================================
  // TOOL 2: GET FUNCTION DETAILS
  // ============================================
  ai.registerTool(
    'get_function_details',
    'Get detailed information about a specific function in a smart contract',
    {
      type: 'object',
      properties: {
        contract: {
          type: 'string',
          description: 'The contract address'
        },
        functionName: {
          type: 'string',
          description: 'Name of the function to analyze'
        },
        network: {
          type: 'string',
          description: 'Network to use: mainnet or testnet',
          enum: ['mainnet', 'testnet']
        }
      },
      required: ['contract', 'functionName']
    },
    async (args: { contract: string; functionName: string; network?: string }) => {
      const reader = getReader(args.network);
      const analysis = await reader.read(args.contract);
      
      const func = analysis.abi.find(f => 
        f.name.toLowerCase() === args.functionName.toLowerCase()
      );
      
      if (!func) {
        throw new Error(`Function '${args.functionName}' not found in contract`);
      }

      return {
        name: func.name,
        signature: ContractReader.formatFunctionSignature(func),
        inputs: func.inputs.map(input => ({
          name: input.name,
          type: input.type,
          description: getParameterDescription(input.type)
        })),
        outputs: func.outputs?.map(output => ({
          name: output.name || 'result',
          type: output.type,
          description: getParameterDescription(output.type)
        })) || [],
        stateMutability: func.stateMutability,
        risk: assessRisk(func),
        description: getFunctionDescription(func),
        usage: getFunctionUsage(func),
        warnings: getFunctionWarnings(func),
        gasEstimate: getGasEstimate(func)
      };
    }
  );

  // ============================================
  // TOOL 3: CHECK SAFETY
  // ============================================
  ai.registerTool(
    'check_safety',
    'Perform a comprehensive safety check on a contract or specific function',
    {
      type: 'object',
      properties: {
        contract: {
          type: 'string',
          description: 'The contract address to check'
        },
        functionName: {
          type: 'string',
          description: 'Optional: specific function to check'
        },
        network: {
          type: 'string',
          description: 'Network to use: mainnet or testnet',
          enum: ['mainnet', 'testnet']
        }
      },
      required: ['contract']
    },
    async (args: { contract: string; functionName?: string; network?: string }) => {
      const reader = getReader(args.network);
      const analysis = await reader.read(args.contract);
      
      if (args.functionName) {
        // Check specific function
        const func = analysis.abi.find(f => 
          f.name.toLowerCase() === args.functionName!.toLowerCase()
        );
        
        if (!func) {
          throw new Error(`Function '${args.functionName}' not found`);
        }
        
        return {
          type: 'function',
          function: args.functionName,
          risk: assessRisk(func),
          warnings: getFunctionWarnings(func),
          safe: ['NONE', 'LOW'].includes(assessRisk(func)),
          recommendation: getFunctionRecommendation(func)
        };
      } else {
        // Check entire contract
        const risks = getContractRisks(analysis);
        const safetyScore = calculateSafetyScore(analysis);
        
        return {
          type: 'contract',
          verified: analysis.isVerified,
          contractType: analysis.basicType,
          safetyScore,
          risks,
          criticalFunctions: analysis.abi
            .filter(f => assessRisk(f) === 'CRITICAL')
            .map(f => f.name),
          highRiskFunctions: analysis.abi
            .filter(f => assessRisk(f) === 'HIGH')
            .map(f => f.name),
          recommendation: safetyScore >= 70 ? 'SAFE' : safetyScore >= 40 ? 'CAUTION' : 'DANGEROUS',
          summary: `This is a ${analysis.isVerified ? 'verified' : 'unverified'} ${analysis.basicType} contract with a safety score of ${safetyScore}/100`
        };
      }
    }
  );

  // ============================================
  // TOOL 4: BUILD TRANSACTION (UNSIGNED)
  // ============================================
  ai.registerTool(
    'build_transaction',
    'Build unsigned transaction data for a contract function call (NEVER signs transactions)',
    {
      type: 'object',
      properties: {
        contract: {
          type: 'string',
          description: 'The contract address'
        },
        method: {
          type: 'string',
          description: 'Function name to call'
        },
        args: {
          type: 'array',
          description: 'Function arguments',
          items: { type: 'string' }
        },
        value: {
          type: 'string',
          description: 'ETH/SEI value to send (optional)',
          default: '0'
        }
      },
      required: ['contract', 'method']
    },
    async (args: { contract: string; method: string; args?: string[]; value?: string }) => {
      // This is a mock implementation - in production would properly encode the function call
      return {
        to: args.contract,
        data: `0x${Buffer.from(`${args.method}(${(args.args || []).join(',')})`).toString('hex')}`, // Mock encoding
        value: args.value || '0',
        gasLimit: '200000', // Estimated
        network: network,
        warning: '🔒 This is unsigned transaction data. NEVER share private keys!',
        instructions: [
          '1. Copy this transaction data',
          '2. Open your wallet (MetaMask, Keplr, etc.)',
          '3. Paste and review the transaction carefully',
          '4. Sign with YOUR wallet (we never touch your keys)',
          '5. Submit to network'
        ],
        securityNote: 'Orbitl NEVER handles private keys or signs transactions. You maintain full control of your assets.'
      };
    }
  );

  // ============================================
  // TOOL 5: ESTIMATE GAS
  // ============================================
  ai.registerTool(
    'estimate_gas',
    'Estimate gas costs for a contract function call',
    {
      type: 'object',
      properties: {
        contract: {
          type: 'string',
          description: 'The contract address'
        },
        method: {
          type: 'string',
          description: 'Function name'
        },
        args: {
          type: 'array',
          description: 'Function arguments',
          items: { type: 'string' }
        }
      },
      required: ['contract', 'method']
    },
    async (args: { contract: string; method: string; args?: string[] }) => {
      const reader = getReader();
      const analysis = await reader.read(args.contract);
      
      const func = analysis.abi.find(f => 
        f.name.toLowerCase() === args.method.toLowerCase()
      );
      
      if (!func) {
        throw new Error(`Function '${args.method}' not found in contract`);
      }

      const baseGas = 21000;
      const functionGas = getGasEstimate(func);
      const totalGas = baseGas + functionGas;
      
      return {
        function: args.method,
        gasLimit: totalGas.toString(),
        estimatedCost: `~${totalGas.toLocaleString()} gas units`,
        recommendation: 'Add 20% buffer for safety',
        breakdown: {
          baseTransaction: baseGas,
          functionExecution: functionGas,
          total: totalGas
        },
        notes: func.stateMutability === 'payable' ? 
          ['This function requires sending SEI', 'Gas costs may vary based on network congestion'] :
          ['Gas costs may vary based on network congestion']
      };
    }
  );

  log.info(`✅ Registered ${ai.getRegisteredTools().length} contract analysis tools`);
  return ai;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function assessRisk(func: ABIFunction): 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const dangerous = ['selfdestruct', 'delegatecall', 'kill', 'suicide'];
  const risky = ['approve', 'transfer', 'transferfrom', 'setowner', 'withdraw'];
  const medium = ['mint', 'burn', 'swap'];
  
  const name = func.name.toLowerCase();
  
  if (dangerous.some(d => name.includes(d))) return 'CRITICAL';
  if (risky.some(r => name.includes(r))) return 'HIGH';
  if (func.stateMutability === 'view' || func.stateMutability === 'pure') return 'NONE';
  if (func.stateMutability === 'payable') return 'MEDIUM';
  if (medium.some(m => name.includes(m))) return 'MEDIUM';
  
  return 'LOW';
}

function getFunctionDescription(func: ABIFunction): string {
  const descriptions: Record<string, string> = {
    'transfer': 'Send tokens to another address',
    'approve': 'Allow another address to spend your tokens',
    'swap': 'Exchange one token for another',
    'mint': 'Create new tokens',
    'burn': 'Destroy tokens',
    'stake': 'Lock tokens to earn rewards',
    'unstake': 'Unlock staked tokens',
    'claimrewards': 'Collect earned rewards',
    'addliquidity': 'Provide tokens to liquidity pool',
    'removeliquidity': 'Remove tokens from liquidity pool',
    'balanceof': 'Check token balance',
    'allowance': 'Check spending allowance',
    'totalsupply': 'Get total token supply'
  };
  
  const name = func.name.toLowerCase();
  for (const [key, description] of Object.entries(descriptions)) {
    if (name.includes(key)) {
      return description;
    }
  }
  
  return func.stateMutability === 'view' || func.stateMutability === 'pure' ?
    `View ${func.name} data` : `Execute ${func.name}`;
}

function getFunctionUsage(func: ABIFunction): string {
  if (func.inputs.length === 0) {
    return `Call ${func.name}() with no parameters`;
  }
  
  const params = func.inputs.map(input => `${input.name}: ${input.type}`).join(', ');
  return `Call ${func.name}(${params})`;
}

function getFunctionWarnings(func: ABIFunction): string[] {
  const warnings: string[] = [];
  const risk = assessRisk(func);
  
  if (risk === 'CRITICAL') {
    warnings.push('⚠️ CRITICAL: This function can destroy the contract or steal funds');
  } else if (risk === 'HIGH') {
    warnings.push('⚠️ HIGH RISK: This function can transfer your assets');
  }
  
  if (func.stateMutability === 'payable') {
    warnings.push('💰 This function requires sending SEI tokens');
  }
  
  if (func.name.toLowerCase().includes('approve')) {
    warnings.push('🔓 Approval functions can allow unlimited spending - be careful with amounts');
  }
  
  return warnings;
}

function getFunctionRecommendation(func: ABIFunction): string {
  const risk = assessRisk(func);
  
  switch (risk) {
    case 'CRITICAL': return 'DO NOT USE - This function is extremely dangerous';
    case 'HIGH': return 'Use with extreme caution - Double check all parameters';
    case 'MEDIUM': return 'Safe to use - Review parameters before calling';
    case 'LOW': return 'Generally safe to use';
    case 'NONE': return 'Safe to call - Read-only function';
    default: return 'Review function carefully before use';
  }
}

function getParameterDescription(type: string): string {
  const descriptions: Record<string, string> = {
    'address': 'Ethereum/Sei address (0x...)',
    'uint256': 'Large unsigned integer (typically token amounts)',
    'uint': 'Unsigned integer',
    'bool': 'True or false value',
    'bytes': 'Binary data',
    'string': 'Text string'
  };
  
  for (const [key, description] of Object.entries(descriptions)) {
    if (type.includes(key)) {
      return description;
    }
  }
  
  return `${type} value`;
}

function getGasEstimate(func: ABIFunction): number {
  const name = func.name.toLowerCase();
  
  // Gas estimates based on common function patterns
  if (name.includes('transfer')) return 65000;
  if (name.includes('approve')) return 45000;
  if (name.includes('swap')) return 150000;
  if (name.includes('stake') || name.includes('deposit')) return 100000;
  if (name.includes('mint')) return 80000;
  if (name.includes('burn')) return 60000;
  if (func.stateMutability === 'view' || func.stateMutability === 'pure') return 3000;
  
  return 50000; // Default estimate
}

function getContractRisks(analysis: ContractData): string[] {
  const risks: string[] = [];
  
  if (!analysis.isVerified) {
    risks.push('❌ Contract source code is not verified - high risk');
  }
  
  const criticalFuncs = analysis.abi.filter(f => assessRisk(f) === 'CRITICAL');
  if (criticalFuncs.length > 0) {
    risks.push(`⚠️ Contains ${criticalFuncs.length} critical risk function(s)`);
  }
  
  const payableFuncs = analysis.abi.filter(f => f.stateMutability === 'payable');
  if (payableFuncs.length > 5) {
    risks.push('💰 Many functions require sending funds - review carefully');
  }
  
  if (analysis.basicType === 'Unknown') {
    risks.push('❓ Unknown contract type - purpose unclear');
  }
  
  return risks;
}

function calculateSafetyScore(analysis: ContractData): number {
  let score = 50; // Base score
  
  // Verification bonus
  if (analysis.isVerified) score += 30;
  
  // Risk penalties
  const criticalCount = analysis.abi.filter(f => assessRisk(f) === 'CRITICAL').length;
  const highCount = analysis.abi.filter(f => assessRisk(f) === 'HIGH').length;
  
  score -= criticalCount * 20;
  score -= highCount * 5;
  
  // Type bonus
  if (analysis.basicType === 'Token') score += 15;
  if (analysis.basicType === 'DEX') score += 10;
  if (analysis.basicType === 'Farm') score += 5;
  
  return Math.max(0, Math.min(100, score));
}
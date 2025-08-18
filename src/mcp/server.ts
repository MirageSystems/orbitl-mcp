// MCP Server for Orbitl - Smart Contract Analysis Tools
// Provides tools that AI can call to analyze Sei contracts

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { SeiProvider, SEI_MAINNET_CONFIG, SEI_TESTNET_CONFIG } from "../blockchain/sei-provider.js";
import { ContractReader } from "../core/contract-reader.js";
import type { ContractData } from "../types/contract.js";

export class OrbitlMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "orbitl",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "analyze_contract",
            description: "Analyze a Sei smart contract for type, functions, and safety",
            inputSchema: {
              type: "object",
              properties: {
                address: {
                  type: "string",
                  description: "Contract address to analyze (0x...)",
                },
                network: {
                  type: "string",
                  enum: ["mainnet", "testnet"],
                  description: "Network to use (default: mainnet)",
                },
              },
              required: ["address"],
            },
          },
          {
            name: "check_network",
            description: "Check connectivity to Sei network",
            inputSchema: {
              type: "object",
              properties: {
                network: {
                  type: "string",
                  enum: ["mainnet", "testnet"],
                  description: "Network to check (default: mainnet)",
                },
              },
            },
          },
          {
            name: "get_function_details",
            description: "Get detailed information about specific contract functions",
            inputSchema: {
              type: "object",
              properties: {
                address: {
                  type: "string",
                  description: "Contract address",
                },
                functionName: {
                  type: "string",
                  description: "Name of function to analyze",
                },
                network: {
                  type: "string",
                  enum: ["mainnet", "testnet"],
                  description: "Network to use (default: mainnet)",
                },
              },
              required: ["address", "functionName"],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "analyze_contract":
            return await this.analyzeContract(args as { address: string; network?: string });
          
          case "check_network":
            return await this.checkNetwork(args as { network?: string });
          
          case "get_function_details":
            return await this.getFunctionDetails(args as { 
              address: string; 
              functionName: string; 
              network?: string 
            });

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async analyzeContract(params: { address: string; network?: string }) {
    const network = params.network || 'mainnet';
    const config = network === 'testnet' ? SEI_TESTNET_CONFIG : SEI_MAINNET_CONFIG;
    const provider = new SeiProvider(config);
    const reader = new ContractReader(provider);

    const contractData = await reader.read(params.address);
    
    return {
      content: [
        {
          type: "text",
          text: this.formatContractAnalysis(contractData),
        },
      ],
    };
  }

  private async checkNetwork(params: { network?: string }) {
    const network = params.network || 'mainnet';
    const config = network === 'testnet' ? SEI_TESTNET_CONFIG : SEI_MAINNET_CONFIG;
    const provider = new SeiProvider(config);

    const { blockNumber, networkName } = await provider.checkConnection();
    
    return {
      content: [
        {
          type: "text",
          text: `✅ Connected to ${networkName}\n` +
                `📦 Latest Block: ${blockNumber}\n` +
                `🌐 Chain ID: ${config.chainId}\n` +
                `🔗 RPC: ${config.rpcUrl}`,
        },
      ],
    };
  }

  private async getFunctionDetails(params: { 
    address: string; 
    functionName: string; 
    network?: string 
  }) {
    const network = params.network || 'mainnet';
    const config = network === 'testnet' ? SEI_TESTNET_CONFIG : SEI_MAINNET_CONFIG;
    const provider = new SeiProvider(config);
    const reader = new ContractReader(provider);

    const contractData = await reader.read(params.address);
    const func = contractData.abi.find(f => 
      f.name.toLowerCase() === params.functionName.toLowerCase()
    );

    if (!func) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Function "${params.functionName}" not found in contract.\n\n` +
                  `Available functions:\n${contractData.abi.map(f => `• ${f.name}`).join('\n')}`,
          },
        ],
      };
    }

    const signature = ContractReader.formatFunctionSignature(func);
    const description = ContractReader.getFunctionDescription(func);
    const mutability = func.stateMutability;
    const isReadOnly = mutability === 'view' || mutability === 'pure';

    return {
      content: [
        {
          type: "text",
          text: `🔧 Function: ${func.name}\n\n` +
                `📝 Signature: ${signature}\n` +
                `💡 Description: ${description}\n` +
                `🔒 Type: ${isReadOnly ? 'Read-only' : 'State-changing'}\n` +
                `⚡ Mutability: ${mutability}\n\n` +
                `📥 Inputs: ${func.inputs.length ? func.inputs.map(i => `${i.name}: ${i.type}`).join(', ') : 'None'}\n` +
                `📤 Outputs: ${func.outputs?.length ? func.outputs.map(o => `${o.name}: ${o.type}`).join(', ') : 'None'}`,
        },
      ],
    };
  }

  private formatContractAnalysis(data: ContractData): string {
    const safetyIndicator = data.isVerified ? '✅' : '❌';
    const typeEmoji = {
      'Token': '💰',
      'DEX': '🔄', 
      'Farm': '🌾',
      'Unknown': '❓'
    }[data.basicType] || '❓';

    return `${typeEmoji} **Contract Analysis Results**

**Basic Information:**
• Address: ${data.address}
• Type: ${data.basicType}
• Verified: ${safetyIndicator} ${data.isVerified ? 'Yes' : 'No'}
• Network: ${data.isVerified ? 'Source verified on Seitrace' : 'Unverified - HIGH RISK'}

**Function Summary:**
• Total Functions: ${data.functionCount}
• Read-Only: ${data.readOnlyFunctions.length} functions
• State-Changing: ${data.writeFunctions.length} functions

**Key Functions:**
${data.abi.slice(0, 8).map(f => 
  `• ${f.name}() - ${ContractReader.getFunctionDescription(f)}`
).join('\n')}${data.abi.length > 8 ? `\n• ... and ${data.abi.length - 8} more functions` : ''}

**Safety Assessment:**
${this.generateSafetyAssessment(data)}

**Contract Type Details:**
${this.generateTypeDetails(data)}`;
  }

  private generateSafetyAssessment(data: ContractData): string {
    const risks = [];
    const positives = [];

    if (!data.isVerified) {
      risks.push('❌ Source code not verified - Cannot audit for security');
    } else {
      positives.push('✅ Source code verified on explorer');
    }

    if (data.functionCount > 20) {
      risks.push('⚠️ High complexity contract - more potential attack vectors');
    }

    if (data.basicType === 'Unknown' && data.isVerified) {
      risks.push('⚠️ Unknown contract pattern - requires manual review');
    }

    if (data.basicType !== 'Unknown') {
      positives.push(`✅ Recognized ${data.basicType} pattern`);
    }

    const riskLevel = risks.length > positives.length ? 'HIGH' : 
                     risks.length > 0 ? 'MEDIUM' : 'LOW';

    return `**Risk Level: ${riskLevel}**\n\n` +
           `${positives.join('\n')}\n${risks.join('\n')}`;
  }

  private generateTypeDetails(data: ContractData): string {
    switch (data.basicType) {
      case 'Token':
        return `This appears to be a token contract. You can:
• Check balances (balanceOf)
• Transfer tokens (transfer) 
• Approve spending (approve)
• ${data.abi.some(f => f.name === 'mint') ? 'Mint new tokens (if authorized)' : 'Standard ERC-20 functionality'}`;

      case 'DEX':
        return `This is a DEX (Decentralized Exchange) contract. You can:
• Swap tokens (swap functions)
• ${data.abi.some(f => f.name.includes('Liquidity')) ? 'Add/remove liquidity' : 'Trade tokens'}
• ${data.abi.some(f => f.name.includes('flash')) ? 'Use flash loans' : 'Standard trading'}
• View pool information and reserves`;

      case 'Farm':
        return `This is a farming/staking contract. You can:
• Stake tokens to earn rewards
• Withdraw staked tokens
• Claim earned rewards
• View reward rates and balances`;

      default:
        return `Unknown contract type. ${data.isVerified ? 'Review the functions above to understand capabilities.' : 'Cannot determine functionality without verified source.'}`;
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Orbitl MCP server running on stdio");
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new OrbitlMCPServer();
  server.start().catch(console.error);
}
# Phase 2 MCP: Native Function Calling Architecture

## 🎯 **The Revelation: Kill MCP, Use Native Tools**

Based on Cloudflare docs, Llama 3.3 70B has **native function calling**. We don't need MCP at all!

## 🏗️ **Super Simple Architecture**

```
User Input → Cloudflare AI (with native tools) → Response
                       ↓
              [AI decides when to call tools]
                       ↓
              [Tool executor runs functions]
                       ↓
              [AI uses results in response]
```

## 🔧 **Implementation Plan**

### **Step 1: Define Native Tools**

```typescript
const tools = [
  {
    type: "function",
    function: {
      name: "analyze_contract",
      description: "Analyze a smart contract on Sei Network",
      parameters: {
        type: "object",
        properties: {
          address: {
            type: "string", 
            description: "Contract address starting with 0x"
          },
          network: {
            type: "string",
            description: "Network: mainnet or testnet",
            enum: ["mainnet", "testnet"]
          }
        },
        required: ["address"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_function_details", 
      description: "Get detailed information about a specific contract function",
      parameters: {
        type: "object",
        properties: {
          contract: {
            type: "string",
            description: "Contract address"
          },
          functionName: {
            type: "string", 
            description: "Name of the function to analyze"
          }
        },
        required: ["contract", "functionName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_safety",
      description: "Check safety and risks of a contract or function",
      parameters: {
        type: "object",
        properties: {
          contract: {
            type: "string",
            description: "Contract address"
          },
          functionName: {
            type: "string",
            description: "Optional: specific function to check"
          }
        },
        required: ["contract"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "build_transaction",
      description: "Build unsigned transaction data (NEVER signs with private keys)",
      parameters: {
        type: "object",
        properties: {
          contract: {
            type: "string",
            description: "Contract address"
          },
          method: {
            type: "string",
            description: "Function name to call"
          },
          args: {
            type: "array",
            description: "Function arguments"
          }
        },
        required: ["contract", "method", "args"]
      }
    }
  }
];
```

### **Step 2: Tool Executor**

```typescript
class ToolExecutor {
  private contractReader: ContractReader;
  
  async execute(toolCall: ToolCall): Promise<any> {
    const { name, arguments: args } = toolCall;
    
    switch (name) {
      case 'analyze_contract':
        return await this.analyzeContract(args.address, args.network);
        
      case 'get_function_details':
        return await this.getFunctionDetails(args.contract, args.functionName);
        
      case 'check_safety':
        return await this.checkSafety(args.contract, args.functionName);
        
      case 'build_transaction':
        return await this.buildTransaction(args.contract, args.method, args.args);
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
  
  private async analyzeContract(address: string, network = 'mainnet') {
    // Use existing ContractReader
    const analysis = await this.contractReader.read(address);
    return {
      address: analysis.address,
      type: analysis.basicType,
      verified: analysis.isVerified,
      functions: analysis.abi.slice(0, 10), // First 10 functions
      summary: `${analysis.basicType} contract with ${analysis.functionCount} functions`
    };
  }
  
  private async buildTransaction(contract: string, method: string, args: any[]) {
    // Build unsigned transaction data only
    return {
      to: contract,
      data: "0x...", // Encoded function call
      value: "0",
      warning: "🔒 NEVER sign this with your private key. Use your external wallet!"
    };
  }
}
```

### **Step 3: Updated AI Client**

```typescript
class CloudflareAI {
  async chatWithTools(messages: Message[], tools: Tool[]): Promise<string> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        messages,
        tools,  // Native Cloudflare tools!
        max_tokens: 1000,
        temperature: 0.7
      })
    });
    
    const data = await response.json();
    
    // Handle tool calls if AI requests them
    if (data.result.tool_calls) {
      const toolResults = await this.executeTools(data.result.tool_calls);
      
      // Send tool results back to AI
      return await this.continueWithResults(messages, toolResults);
    }
    
    return data.result.response;
  }
  
  private async executeTools(toolCalls: ToolCall[]): Promise<any[]> {
    const executor = new ToolExecutor();
    return await Promise.all(
      toolCalls.map(call => executor.execute(call))
    );
  }
}
```

### **Step 4: Super Simple Chat Interface**

```typescript
class SimpleChatInterface {
  async processMessage(userInput: string): Promise<void> {
    const messages = [
      {
        role: "system",
        content: `You are Orbitl, expert smart contract analyst for Sei Network.
        
        You have these tools available:
        - analyze_contract: Get full contract analysis
        - get_function_details: Deep dive into specific functions
        - check_safety: Risk assessment 
        - build_transaction: Create unsigned transaction data
        
        NEVER ask for private keys. Always use tools when users mention contracts.
        Always warn about risks and emphasize wallet safety.`
      },
      { role: "user", content: userInput }
    ];
    
    const response = await this.aiClient.chatWithTools(messages, TOOLS);
    console.log(response);
  }
}
```

## 🗑️ **What to Remove**

- ❌ `src/mcp/` - Entire MCP server
- ❌ `src/preprocessor/` - No preprocessing needed
- ❌ Complex context building 
- ❌ Cache (premature optimization)
- ❌ Multiple conversation methods

## ✅ **What to Keep**

- ✅ `src/core/contract-reader.ts` - Still need analysis
- ✅ `src/blockchain/sei-provider.ts` - Still need chain connection
- ✅ `src/types/contract.ts` - Type definitions
- ✅ Basic conversation persistence

## 📁 **New File Structure**

```
src/
├── tools/
│   ├── definitions.ts     # Tool definitions for AI
│   └── executor.ts        # Tool execution logic  
├── ai/
│   └── client.ts         # Updated Cloudflare client
├── chat/
│   └── interface.ts      # Simplified chat
├── core/                 # Keep existing
├── blockchain/           # Keep existing
└── cli/
    └── index.ts          # Entry point
```

## 🚀 **Benefits**

1. **80% less code** - Remove MCP complexity
2. **Native function calling** - Uses Cloudflare's built-in features
3. **AI decides everything** - No manual detection/routing
4. **OpenAI-compatible** - Standard function calling pattern
5. **Easier to debug** - Simpler flow

## 🎯 **Implementation Timeline**

- **Hour 1**: Create tool definitions and executor
- **Hour 2**: Update AI client for native tools  
- **Hour 3**: Simplify chat interface
- **Hour 4**: Remove MCP/preprocessor, test
- **Hour 5**: Polish and cleanup

## 🏁 **Success Criteria**

```bash
$ pnpm dev
> What is 0x882f62fe8e9594470d1da0f70bc85096f6c60423?

AI: I'll analyze that contract for you.
[calls analyze_contract tool automatically]
AI: This is a verified DEX contract with 26 functions...

> Build a swap transaction
AI: I'll help you build that transaction.  
[calls build_transaction tool]
AI: Here's your unsigned transaction data. NEVER sign with private keys!
```

The AI handles everything - no manual preprocessing, no complex flows. Just tools + chat!
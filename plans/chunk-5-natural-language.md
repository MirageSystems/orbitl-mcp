# Chunk 5: Natural Language Parser

## 🎯 **Goal**: Parse human commands into transaction intents

**Timeline**: 3-4 days  
**Risk**: Medium-High  
**Dependencies**: Chunks 1-4 completed

---

## 📋 **Tasks**

### **5.1: Define Intent Structure** (1 hour)
Create `src/wallet/intent-parser.ts`:

```typescript
export interface TransactionIntent {
  action: 'transfer' | 'approve' | 'swap' | 'stake' | 'unstake';
  confidence: number;        // 0-100, how sure we are about the parsing
  parameters: IntentParameters;
  warnings: string[];        // Parsing ambiguities or concerns
  needsClarification: boolean; // If user input is ambiguous
}

export interface IntentParameters {
  // Common parameters
  amount?: string;
  token?: string;
  
  // Transfer specific
  recipient?: string;
  
  // Approval specific  
  spender?: string;
  
  // Swap specific
  fromToken?: string;
  toToken?: string;
  slippage?: string;
  
  // Staking specific
  protocol?: string;
  duration?: string;
}

export interface ParsedCommand {
  originalInput: string;
  intent: TransactionIntent;
  alternatives?: TransactionIntent[]; // Other possible interpretations
}
```

### **5.2: Build Intent Recognition Engine** (4-5 hours)
Create the core parser that recognizes user intents:

```typescript
export class IntentParser {
  
  /**
   * Parse natural language command into structured intent
   */
  parseCommand(input: string): ParsedCommand {
    const normalizedInput = this.normalizeInput(input);
    
    // Try to detect the main action
    const action = this.detectAction(normalizedInput);
    
    if (!action) {
      throw new ParseError('Could not understand the command. Try: "transfer 100 USDC to 0x123"');
    }
    
    // Extract parameters based on action
    const parameters = this.extractParameters(normalizedInput, action);
    
    // Calculate confidence based on how many parameters we found
    const confidence = this.calculateConfidence(action, parameters, normalizedInput);
    
    // Check for potential issues
    const warnings = this.generateWarnings(parameters, normalizedInput);
    
    const intent: TransactionIntent = {
      action,
      confidence,
      parameters,
      warnings,
      needsClarification: confidence < 70
    };
    
    return {
      originalInput: input,
      intent,
      alternatives: this.findAlternatives(normalizedInput)
    };
  }
  
  private detectAction(input: string): TransactionIntent['action'] | null {
    const actionPatterns = {
      'transfer': [
        /\btransfer\b/i, /\bsend\b/i, /\bmove\b/i,
        /\bpay\b/i, /\bgiving?\b/i
      ],
      'approve': [
        /\bapprove\b/i, /\ballow\b/i, /\benable\b/i,
        /\bpermit\b/i, /\bauthorize\b/i
      ],
      'swap': [
        /\bswap\b/i, /\btrade\b/i, /\bexchange\b/i,
        /\bconvert\b/i, /\bbuy\b/i, /\bsell\b/i
      ],
      'stake': [
        /\bstake\b/i, /\bdeposit\b/i, /\block\b/i,
        /\bdelegat\b/i, /\byield\b/i
      ],
      'unstake': [
        /\bunstake\b/i, /\bwithdraw\b/i, /\bunlock\b/i,
        /\bundelegat\b/i, /\bclaim\b/i
      ]
    };
    
    for (const [action, patterns] of Object.entries(actionPatterns)) {
      if (patterns.some(pattern => pattern.test(input))) {
        return action as TransactionIntent['action'];
      }
    }
    
    return null;
  }
  
  private extractParameters(
    input: string, 
    action: TransactionIntent['action']
  ): IntentParameters {
    const params: IntentParameters = {};
    
    // Extract amount (numbers + currency)
    const amountMatch = input.match(/(\d+(?:\.\d+)?)\s*([A-Z]{2,10})/i);
    if (amountMatch) {
      params.amount = amountMatch[1];
      params.token = amountMatch[2].toUpperCase();
    }
    
    // Extract addresses (0x followed by 40 hex chars)
    const addressMatches = input.match(/(0x[a-fA-F0-9]{40})/g);
    
    switch (action) {
      case 'transfer':
        if (addressMatches && addressMatches.length > 0) {
          params.recipient = addressMatches[0];
        }
        break;
        
      case 'approve':
        if (addressMatches && addressMatches.length > 0) {
          params.spender = addressMatches[0];
        }
        // Look for protocol names
        const protocolMatch = input.match(/\b(dragonswap|astroport|uniswap)\b/i);
        if (protocolMatch) {
          params.spender = this.resolveProtocolAddress(protocolMatch[1]);
        }
        break;
        
      case 'swap':
        // Look for "X for Y" or "X to Y" patterns
        const swapMatch = input.match(/(\w+)\s+(?:for|to|into)\s+(\w+)/i);
        if (swapMatch) {
          params.fromToken = swapMatch[1].toUpperCase();
          params.toToken = swapMatch[2].toUpperCase();
        }
        
        // Look for slippage
        const slippageMatch = input.match(/(\d+(?:\.\d+)?)%?\s*slippage/i);
        if (slippageMatch) {
          params.slippage = slippageMatch[1];
        }
        break;
    }
    
    return params;
  }
}
```

### **5.3: Add Smart Token Resolution** (2 hours)
Create `src/wallet/token-resolver.ts`:

```typescript
export class TokenResolver {
  
  private static readonly KNOWN_TOKENS: Record<string, TokenInfo> = {
    // Sei Network tokens
    'SEI': {
      symbol: 'SEI',
      address: '0x0000000000000000000000000000000000000000', // Native SEI
      decimals: 18,
      name: 'Sei'
    },
    'USDC': {
      symbol: 'USDC',
      address: '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a',
      decimals: 6,
      name: 'USD Coin'
    },
    'WSEI': {
      symbol: 'WSEI',
      address: '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456',
      decimals: 18,
      name: 'Wrapped SEI'
    }
  };
  
  /**
   * Resolve token symbol to address and metadata
   */
  static resolveToken(symbolOrAddress: string): TokenInfo | null {
    // If it's already an address, try to look it up
    if (symbolOrAddress.startsWith('0x')) {
      const found = Object.values(this.KNOWN_TOKENS)
        .find(token => token.address.toLowerCase() === symbolOrAddress.toLowerCase());
      return found || null;
    }
    
    // Otherwise, look up by symbol
    const symbol = symbolOrAddress.toUpperCase();
    return this.KNOWN_TOKENS[symbol] || null;
  }
  
  /**
   * Get all available tokens for suggestions
   */
  static getAllTokens(): TokenInfo[] {
    return Object.values(this.KNOWN_TOKENS);
  }
  
  /**
   * Suggest similar tokens for typos
   */
  static suggestTokens(input: string): TokenInfo[] {
    const inputLower = input.toLowerCase();
    return this.getAllTokens()
      .filter(token => 
        token.symbol.toLowerCase().includes(inputLower) ||
        token.name.toLowerCase().includes(inputLower)
      )
      .slice(0, 3);
  }
}

interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  name: string;
}
```

### **5.4: Add Protocol Address Resolution** (1 hour)
```typescript
export class ProtocolResolver {
  
  private static readonly KNOWN_PROTOCOLS: Record<string, ProtocolInfo> = {
    'dragonswap': {
      name: 'DragonSwap',
      router: '0x1234567890123456789012345678901234567890',
      type: 'dex'
    },
    'astroport': {
      name: 'Astroport',
      router: '0x9876543210987654321098765432109876543210',  
      type: 'dex'
    }
  };
  
  static resolveProtocol(nameOrAddress: string): ProtocolInfo | null {
    if (nameOrAddress.startsWith('0x')) {
      const found = Object.values(this.KNOWN_PROTOCOLS)
        .find(protocol => protocol.router.toLowerCase() === nameOrAddress.toLowerCase());
      return found || null;
    }
    
    const nameLower = nameOrAddress.toLowerCase();
    return this.KNOWN_PROTOCOLS[nameLower] || null;
  }
}
```

### **5.5: Build Command Validation** (2 hours)
Create comprehensive validation for parsed commands:

```typescript
export class IntentValidator {
  
  /**
   * Validate parsed intent and suggest fixes
   */
  validateIntent(intent: TransactionIntent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    
    switch (intent.action) {
      case 'transfer':
        this.validateTransfer(intent.parameters, errors, warnings, suggestions);
        break;
      case 'approve':
        this.validateApproval(intent.parameters, errors, warnings, suggestions);
        break;
      case 'swap':
        this.validateSwap(intent.parameters, errors, warnings, suggestions);
        break;
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }
  
  private validateTransfer(
    params: IntentParameters, 
    errors: string[], 
    warnings: string[], 
    suggestions: string[]
  ) {
    if (!params.amount) {
      errors.push('Amount is required for transfers');
      suggestions.push('Try: "transfer 100 USDC to 0x123..."');
    }
    
    if (!params.token) {
      errors.push('Token is required for transfers');
      suggestions.push('Specify which token to transfer (USDC, SEI, etc.)');
    } else {
      const tokenInfo = TokenResolver.resolveToken(params.token);
      if (!tokenInfo) {
        errors.push(`Unknown token: ${params.token}`);
        const similar = TokenResolver.suggestTokens(params.token);
        if (similar.length > 0) {
          suggestions.push(`Did you mean: ${similar.map(t => t.symbol).join(', ')}?`);
        }
      }
    }
    
    if (!params.recipient) {
      errors.push('Recipient address is required');
      suggestions.push('Add "to 0x..." or "to [protocol name]"');
    } else if (!this.isValidAddress(params.recipient)) {
      errors.push('Invalid recipient address format');
      suggestions.push('Address should be 42 characters starting with 0x');
    }
  }
  
  private validateSwap(
    params: IntentParameters,
    errors: string[],
    warnings: string[],
    suggestions: string[]
  ) {
    if (!params.amount && !params.fromToken) {
      errors.push('Amount and source token required for swaps');
      suggestions.push('Try: "swap 100 USDC for SEI"');
    }
    
    if (!params.toToken) {
      errors.push('Target token required for swaps');
      suggestions.push('Specify what token to swap to');
    }
    
    if (params.fromToken === params.toToken) {
      errors.push('Cannot swap token for itself');
    }
    
    if (params.slippage) {
      const slippage = parseFloat(params.slippage);
      if (slippage > 10) {
        warnings.push('High slippage tolerance may result in poor execution');
      }
    }
  }
}
```

### **5.6: Integration with Transaction Builder** (1-2 hours)
Create bridge between natural language and transaction building:

```typescript
export class CommandProcessor {
  private intentParser: IntentParser;
  private intentValidator: IntentValidator;
  private transactionBuilder: SafeTransactionBuilder;
  
  constructor(rpcUrl: string) {
    this.intentParser = new IntentParser();
    this.intentValidator = new IntentValidator();
    this.transactionBuilder = new SafeTransactionBuilder(rpcUrl);
  }
  
  /**
   * Process natural language command into transaction
   */
  async processCommand(input: string): Promise<ProcessedCommand> {
    
    // 1. Parse the command
    const parsed = this.intentParser.parseCommand(input);
    
    // 2. Validate the intent
    const validation = this.intentValidator.validateIntent(parsed.intent);
    
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors[0],
        suggestions: validation.suggestions,
        needsClarification: true
      };
    }
    
    // 3. Build transaction based on intent
    try {
      const transaction = await this.buildFromIntent(parsed.intent);
      
      return {
        success: true,
        transaction,
        parsedIntent: parsed.intent,
        confidence: parsed.intent.confidence
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to build transaction: ${error.message}`,
        suggestions: ['Please check your command and try again']
      };
    }
  }
  
  private async buildFromIntent(intent: TransactionIntent): Promise<SafeTransactionData> {
    const params = intent.parameters;
    
    switch (intent.action) {
      case 'transfer':
        const tokenInfo = TokenResolver.resolveToken(params.token!);
        return this.transactionBuilder.buildTransfer(
          tokenInfo!.address,
          params.recipient!,
          params.amount!
        );
        
      case 'approve':
        const approveTokenInfo = TokenResolver.resolveToken(params.token!);
        return this.transactionBuilder.buildApproval(
          approveTokenInfo!.address,
          params.spender!,
          params.amount!
        );
        
      case 'swap':
        // More complex - need to build DEX swap
        return this.buildSwapTransaction(intent);
        
      default:
        throw new Error(`Action ${intent.action} not yet implemented`);
    }
  }
}
```

---

## 🧪 **Testing Strategy**

### **Unit Tests for Parser**
```typescript
describe('IntentParser', () => {
  let parser: IntentParser;
  
  beforeEach(() => {
    parser = new IntentParser();
  });
  
  it('parses simple transfer commands', () => {
    const result = parser.parseCommand('transfer 100 USDC to 0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456');
    
    expect(result.intent.action).toBe('transfer');
    expect(result.intent.parameters.amount).toBe('100');
    expect(result.intent.parameters.token).toBe('USDC');
    expect(result.intent.parameters.recipient).toBe('0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456');
    expect(result.intent.confidence).toBeGreaterThan(80);
  });
  
  it('parses swap commands', () => {
    const result = parser.parseCommand('swap 50 USDC for SEI');
    
    expect(result.intent.action).toBe('swap');
    expect(result.intent.parameters.amount).toBe('50');
    expect(result.intent.parameters.fromToken).toBe('USDC');
    expect(result.intent.parameters.toToken).toBe('SEI');
  });
  
  it('handles ambiguous commands', () => {
    const result = parser.parseCommand('send money');
    
    expect(result.intent.needsClarification).toBe(true);
    expect(result.intent.confidence).toBeLessThan(50);
  });
});
```

### **Integration Testing**
```bash
# Test end-to-end natural language processing
pnpm tsx -e "
import { CommandProcessor } from './src/wallet/intent-parser.js';

const processor = new CommandProcessor('http://sei-rpc');

// Test various commands
const commands = [
  'transfer 100 USDC to 0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456',
  'swap 50 USDC for SEI',
  'approve DragonSwap to spend 1000 USDC',
  'send money', // Should need clarification
  'swap USDC', // Missing target token
];

for (const command of commands) {
  console.log(\`\nCommand: \${command}\`);
  const result = await processor.processCommand(command);
  console.log('Result:', JSON.stringify(result, null, 2));
}
"
```

---

## ✅ **Acceptance Criteria**

- [ ] Parses basic transfer commands correctly
- [ ] Parses swap commands with proper token resolution  
- [ ] Validates commands and provides helpful error messages
- [ ] Handles ambiguous input gracefully
- [ ] Suggests corrections for typos and missing parameters
- [ ] Integrates with existing transaction builder
- [ ] Confidence scoring works properly
- [ ] All tests pass
- [ ] Handles edge cases without crashing

---

## 🎯 **Command Examples to Support**

### **Transfers**
- "transfer 100 USDC to 0x123..."
- "send 50 SEI to alice"  
- "move 1000 WSEI to DragonSwap"

### **Approvals**
- "approve DragonSwap to spend 500 USDC"
- "allow 0x123... to use 100 USDC"
- "enable unlimited USDC for Astroport"

### **Swaps**
- "swap 100 USDC for SEI"
- "trade 50 SEI to USDC with 1% slippage"
- "convert 1000 WSEI into USDC"

---

## 🚀 **Deliverables**

1. `src/wallet/intent-parser.ts` - Core parsing logic
2. `src/wallet/token-resolver.ts` - Token name resolution
3. `src/wallet/protocol-resolver.ts` - Protocol address resolution
4. `src/wallet/intent-validator.ts` - Command validation
5. `src/wallet/command-processor.ts` - Integration layer
6. Comprehensive tests for all parsing scenarios
7. Error handling and user-friendly suggestions
8. Integration with existing transaction builder

---

## 🔄 **Next Chunk**

Once natural language parsing works, **Chunk 6: Wallet Connection** will add the ability to actually connect wallets and sign the transactions we've built.

**Ready to make Orbitl understand human language? Let's build the ChatGPT of crypto! 🗣️**
# Chunk 4: Transaction Preview Generator

## 🎯 **Goal**: Create beautiful, detailed transaction previews that users can understand

**Timeline**: 2-3 days  
**Risk**: Low  
**Dependencies**: Chunks 1, 2, 3 completed

---

## 📋 **Tasks**

### **4.1: Design Preview Interface** (1 hour)
Extend existing types in `src/wallet/types.ts`:

```typescript
interface DetailedTransactionPreview {
  // Basic info
  title: string;              // "Token Transfer"
  humanDescription: string;   // "Transfer 100 USDC to Alice"
  
  // Contract details
  contractName: string;       // "USDC Token Contract"
  contractAddress: string;    // "0x123..."
  contractVerified: boolean;  // true/false
  
  // Transaction details
  action: string;             // "transfer", "approve", "swap"
  parameters: PreviewParameter[];
  
  // Risk assessment
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskFactors: string[];      // ["Large approval amount"]
  safetyWarnings: string[];   // ["This approves unlimited spending"]
  
  // Cost information
  gasEstimate: GasEstimate;
  totalCost: string;          // "$0.52 total cost"
  
  // User confirmations needed
  confirmations: UserConfirmation[];
}

interface PreviewParameter {
  name: string;        // "recipient"
  value: string;       // "0x742d35..."
  displayValue: string; // "alice.eth" or "0x742d35..."
  type: 'address' | 'amount' | 'percentage' | 'duration';
}

interface UserConfirmation {
  type: 'warning' | 'info' | 'critical';
  message: string;
  userMustAcknowledge: boolean;
}
```

### **4.2: Create Preview Generator** (2-3 hours)
Create `src/wallet/preview-generator.ts`:

```typescript
export class TransactionPreviewGenerator {
  
  /**
   * Generate detailed preview for any transaction
   */
  async generatePreview(
    txData: SafeTransactionData,
    context: TransactionContext
  ): Promise<DetailedTransactionPreview> {
    
    const action = this.detectAction(txData);
    
    switch (action) {
      case 'transfer':
        return this.generateTransferPreview(txData, context);
      case 'approve':
        return this.generateApprovalPreview(txData, context);
      case 'swap':
        return this.generateSwapPreview(txData, context);
      default:
        return this.generateGenericPreview(txData, context);
    }
  }
  
  private generateTransferPreview(
    txData: SafeTransactionData,
    context: TransactionContext
  ): DetailedTransactionPreview {
    
    return {
      title: 'Token Transfer',
      humanDescription: `Transfer ${context.amount} ${context.tokenSymbol} to ${context.recipientName || context.recipient}`,
      
      contractName: `${context.tokenSymbol} Token Contract`,
      contractAddress: txData.transaction.to,
      contractVerified: true, // From our contract analysis
      
      action: 'transfer',
      parameters: [
        {
          name: 'Recipient',
          value: context.recipient,
          displayValue: context.recipientName || this.formatAddress(context.recipient),
          type: 'address'
        },
        {
          name: 'Amount',
          value: context.amount,
          displayValue: `${context.amount} ${context.tokenSymbol}`,
          type: 'amount'
        }
      ],
      
      riskLevel: 'LOW',
      riskFactors: [],
      safetyWarnings: [],
      
      gasEstimate: txData.gasEstimate!,
      totalCost: txData.gasEstimate!.estimatedCost,
      
      confirmations: [
        {
          type: 'info',
          message: `You are sending ${context.amount} ${context.tokenSymbol}`,
          userMustAcknowledge: false
        }
      ]
    };
  }
  
  private generateApprovalPreview(
    txData: SafeTransactionData, 
    context: TransactionContext
  ): DetailedTransactionPreview {
    
    const isUnlimitedApproval = context.amount === 'unlimited' || 
                               BigInt(context.amount) > BigInt('1000000000000000000000000');
    
    return {
      title: 'Token Approval',
      humanDescription: `Allow ${context.spenderName || 'contract'} to spend ${context.amount === 'unlimited' ? 'unlimited' : context.amount} ${context.tokenSymbol}`,
      
      contractName: `${context.tokenSymbol} Token Contract`,
      contractAddress: txData.transaction.to,
      contractVerified: true,
      
      action: 'approve',
      parameters: [
        {
          name: 'Spender',
          value: context.spender!,
          displayValue: context.spenderName || this.formatAddress(context.spender!),
          type: 'address'
        },
        {
          name: 'Amount',
          value: context.amount,
          displayValue: isUnlimitedApproval ? 'Unlimited' : `${context.amount} ${context.tokenSymbol}`,
          type: 'amount'
        }
      ],
      
      riskLevel: isUnlimitedApproval ? 'MEDIUM' : 'LOW',
      riskFactors: isUnlimitedApproval ? ['Unlimited approval amount'] : [],
      safetyWarnings: isUnlimitedApproval ? [
        'This approval allows the spender to take ALL of your tokens',
        'Consider approving only the amount you need'
      ] : [],
      
      gasEstimate: txData.gasEstimate!,
      totalCost: txData.gasEstimate!.estimatedCost,
      
      confirmations: [
        {
          type: isUnlimitedApproval ? 'warning' : 'info',
          message: isUnlimitedApproval ? 
            'You are granting unlimited token access' : 
            `You are approving ${context.amount} ${context.tokenSymbol}`,
          userMustAcknowledge: isUnlimitedApproval
        }
      ]
    };
  }
}
```

### **4.3: Integrate with Beautiful CLI Formatter** (2 hours)
Create `src/wallet/preview-formatter.ts`:

```typescript
import { UIComponents } from '../utils/formatter/index.js';

export class TransactionPreviewFormatter {
  
  static formatPreview(preview: DetailedTransactionPreview): string {
    let output = '';
    
    // Main title and description
    output += UIComponents.createHeader(preview.title, '🔍 Transaction Preview');
    output += '\n\n';
    
    // Transaction details box
    const detailsContent = [
      `${chalk.bold('Action:')} ${chalk.cyan(preview.humanDescription)}`,
      `${chalk.bold('Contract:')} ${preview.contractName}`,
      `${chalk.bold('Address:')} ${chalk.magenta(preview.contractAddress)}`,
      `${chalk.bold('Verified:')} ${preview.contractVerified ? chalk.green('✅ Yes') : chalk.red('❌ No')}`
    ].join('\n');
    
    output += UIComponents.createBox(detailsContent, {
      title: '📋 Transaction Details',
      color: 'cyan'
    });
    
    output += '\n\n';
    
    // Parameters table
    if (preview.parameters.length > 0) {
      output += chalk.bold.blue('📝 Parameters\n\n');
      
      const paramRows = preview.parameters.map(param => [
        chalk.yellow(param.name),
        param.displayValue,
        chalk.gray(param.type)
      ]);
      
      output += UIComponents.createTable(
        ['Parameter', 'Value', 'Type'],
        paramRows,
        { colWidths: [15, 40, 10] }
      );
      
      output += '\n\n';
    }
    
    // Risk assessment
    const riskColor = this.getRiskColor(preview.riskLevel);
    const riskContent = [
      `${chalk.bold('Risk Level:')} ${this.formatRiskLevel(preview.riskLevel)}`,
      `${chalk.bold('Gas Cost:')} ${chalk.green(preview.totalCost)}`,
      preview.riskFactors.length > 0 ? 
        `${chalk.bold('Risk Factors:')} ${preview.riskFactors.join(', ')}` : 
        `${chalk.bold('Risk Factors:')} ${chalk.green('None')}`
    ].join('\n');
    
    output += UIComponents.createBox(riskContent, {
      title: '⚡ Cost & Risk Assessment',
      color: riskColor
    });
    
    // Safety warnings (if any)
    if (preview.safetyWarnings.length > 0) {
      output += '\n\n';
      const warningsContent = preview.safetyWarnings
        .map(warning => `⚠️ ${warning}`)
        .join('\n');
      
      output += UIComponents.createBox(warningsContent, {
        title: '🚨 Safety Warnings',
        color: 'red'
      });
    }
    
    // User confirmations
    const criticalConfirmations = preview.confirmations.filter(c => c.userMustAcknowledge);
    if (criticalConfirmations.length > 0) {
      output += '\n\n';
      const confirmContent = criticalConfirmations
        .map(conf => `${this.getConfirmationIcon(conf.type)} ${conf.message}`)
        .join('\n');
      
      output += UIComponents.createBox(confirmContent, {
        title: '✋ Confirmation Required',
        color: 'yellow'
      });
    }
    
    return output;
  }
  
  private static getRiskColor(risk: string): 'green' | 'yellow' | 'red' {
    switch (risk) {
      case 'LOW': return 'green';
      case 'MEDIUM': return 'yellow';
      case 'HIGH':
      case 'CRITICAL': return 'red';
      default: return 'yellow';
    }
  }
  
  private static formatRiskLevel(risk: string): string {
    switch (risk) {
      case 'LOW': return chalk.green('🟢 LOW');
      case 'MEDIUM': return chalk.yellow('🟡 MEDIUM'); 
      case 'HIGH': return chalk.red('🔴 HIGH');
      case 'CRITICAL': return chalk.red.bold('🔴 CRITICAL');
      default: return chalk.gray('❓ UNKNOWN');
    }
  }
}
```

### **4.4: Add Context Resolution** (1-2 hours)
Create `src/wallet/context-resolver.ts`:

```typescript
export interface TransactionContext {
  amount: string;
  tokenSymbol: string;
  tokenDecimals: number;
  recipient?: string;
  recipientName?: string;  // ENS name, address book name, etc.
  spender?: string;
  spenderName?: string;    // "DragonSwap Router", etc.
}

export class TransactionContextResolver {
  
  /**
   * Resolve context for better transaction previews
   */
  async resolveContext(
    txData: SafeTransactionData,
    userInput: any
  ): Promise<TransactionContext> {
    
    // Start with basic context
    const context: TransactionContext = {
      amount: userInput.amount || '0',
      tokenSymbol: await this.resolveTokenSymbol(txData.transaction.to),
      tokenDecimals: await this.resolveTokenDecimals(txData.transaction.to)
    };
    
    // Add recipient info if transfer
    if (userInput.recipient) {
      context.recipient = userInput.recipient;
      context.recipientName = await this.resolveAddressName(userInput.recipient);
    }
    
    // Add spender info if approval
    if (userInput.spender) {
      context.spender = userInput.spender;
      context.spenderName = await this.resolveAddressName(userInput.spender);
    }
    
    return context;
  }
  
  private async resolveTokenSymbol(tokenAddress: string): Promise<string> {
    // Try to get token symbol from contract or known tokens list
    const knownTokens: Record<string, string> = {
      '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a': 'USDC',
      '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456': 'WSEI',
      // Add more known tokens
    };
    
    return knownTokens[tokenAddress] || 'TOKEN';
  }
  
  private async resolveAddressName(address: string): Promise<string | undefined> {
    // Could integrate with ENS, address book, etc.
    const knownAddresses: Record<string, string> = {
      '0x1234567890123456789012345678901234567890': 'DragonSwap Router',
      '0x9876543210987654321098765432109876543210': 'Astroport Router',
      // Add more known contracts
    };
    
    return knownAddresses[address];
  }
}
```

### **4.5: Integration Testing** (1 hour)
Update transaction builder to use new preview system:

```typescript
// In SafeTransactionBuilder
async buildTransfer(
  tokenAddress: string,
  to: string, 
  amount: string
): Promise<SafeTransactionData> {
  
  // ... existing encoding and gas estimation ...
  
  // Generate enhanced preview
  const contextResolver = new TransactionContextResolver();
  const context = await contextResolver.resolveContext(basicTxData, {
    amount,
    recipient: to
  });
  
  const previewGenerator = new TransactionPreviewGenerator();
  const detailedPreview = await previewGenerator.generatePreview(basicTxData, context);
  
  return {
    transaction,
    preview: detailedPreview, // Now detailed instead of basic
    safetyScore: 90,
    gasEstimate
  };
}
```

---

## 🧪 **Testing Strategy**

### **Visual Testing**
```bash
# Test preview generation and formatting
pnpm tsx -e "
import { SafeTransactionBuilder } from './src/wallet/transaction-builder.js';
import { TransactionPreviewFormatter } from './src/wallet/preview-formatter.js';

const builder = new SafeTransactionBuilder('http://sei-rpc');

// Test transfer preview
const transfer = await builder.buildTransfer(
  '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', // USDC
  '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456', // Recipient
  '100'
);

console.log('TRANSFER PREVIEW:');
console.log(TransactionPreviewFormatter.formatPreview(transfer.preview));

console.log('\n'.repeat(3));

// Test approval preview (unlimited)
const approval = await builder.buildApproval(
  '0xA0b86a33E6441d82f6f7f8e0dC7F2A5e9b9e2c3a', // USDC
  '0x1234567890123456789012345678901234567890', // DragonSwap
  'unlimited'
);

console.log('APPROVAL PREVIEW (UNLIMITED):');
console.log(TransactionPreviewFormatter.formatPreview(approval.preview));
"
```

### **Unit Tests**
```typescript
describe('TransactionPreviewGenerator', () => {
  it('generates proper transfer preview', async () => {
    const generator = new TransactionPreviewGenerator();
    const mockTxData = createMockTransferData();
    const mockContext = createMockTransferContext();
    
    const preview = await generator.generatePreview(mockTxData, mockContext);
    
    expect(preview.title).toBe('Token Transfer');
    expect(preview.riskLevel).toBe('LOW');
    expect(preview.parameters).toHaveLength(2);
    expect(preview.safetyWarnings).toHaveLength(0);
  });
  
  it('generates proper approval preview with warnings', async () => {
    const generator = new TransactionPreviewGenerator();
    const mockTxData = createMockApprovalData();
    const mockContext = createMockUnlimitedApprovalContext();
    
    const preview = await generator.generatePreview(mockTxData, mockContext);
    
    expect(preview.title).toBe('Token Approval');
    expect(preview.riskLevel).toBe('MEDIUM');
    expect(preview.safetyWarnings.length).toBeGreaterThan(0);
    expect(preview.confirmations.some(c => c.userMustAcknowledge)).toBe(true);
  });
});
```

---

## ✅ **Acceptance Criteria**

- [ ] Beautiful, formatted transaction previews
- [ ] Clear risk level indication with color coding
- [ ] Human-readable parameter display  
- [ ] Safety warnings for risky operations
- [ ] User confirmations for critical actions
- [ ] Integration with existing beautiful CLI formatter
- [ ] Context resolution for better descriptions
- [ ] All tests pass
- [ ] Previews are easy to understand for non-technical users

---

## 🎨 **Example Output**

The transaction preview should look like this:

```
 ██████╗ ██████╗ ██████╗ ██████╗  ███████╗██╗   ██╗██╗███████╗██╗    ██╗
██╔═══██╗██╔══██╗██╔══██╗██╔══██╗██╔════╝██║   ██║██║██╔════╝██║    ██║
██║   ██║██████╔╝██████╔╝██████╔╝█████╗  ██║   ██║██║█████╗  ██║ █╗ ██║
██║   ██║██╔═══╝ ██╔═══╝ ██╔══██╗██╔══╝  ╚██╗ ██╔╝██║██╔══╝  ██║███╗██║
╚██████╔╝██║     ██║     ██║  ██║███████╗ ╚████╔╝ ██║███████╗╚███╔███╔╝
 ╚═════╝ ╚═╝     ╚═╝     ╚═╝  ╚═╝╚══════╝  ╚═══╝  ╚═╝╚══════╝ ╚══╝╚══╝

🔍 Transaction Preview

╭──────────  📋 Transaction Details  ───────────╮
│                                              │
│   Action: Transfer 100 USDC to DragonSwap   │  
│   Contract: USDC Token Contract              │
│   Address: 0xA0b86a33E6441d82f6f7f8e0dC7...  │
│   Verified: ✅ Yes                          │
│                                              │
╰──────────────────────────────────────────────╯

📝 Parameters

┌───────────────┬──────────────────────────────────────────┬──────────┐
│ Parameter     │ Value                                    │ Type     │
├───────────────┼──────────────────────────────────────────┼──────────┤
│ Recipient     │ DragonSwap Router                        │ address  │
├───────────────┼──────────────────────────────────────────┼──────────┤
│ Amount        │ 100 USDC                                 │ amount   │
└───────────────┴──────────────────────────────────────────┴──────────┘

╭─────  ⚡ Cost & Risk Assessment  ──────╮
│                                       │
│   Risk Level: 🟢 LOW                  │
│   Gas Cost: $0.52                     │
│   Risk Factors: None                  │
│                                       │
╰───────────────────────────────────────╯
```

---

## 🚀 **Deliverables**

1. `src/wallet/preview-generator.ts` - Core preview generation logic
2. `src/wallet/preview-formatter.ts` - Beautiful CLI formatting  
3. `src/wallet/context-resolver.ts` - Address and token name resolution
4. Updated `src/wallet/types.ts` - New preview interfaces
5. Integration with existing transaction builder
6. Comprehensive tests for all preview types
7. Visual validation of formatted output

---

## 🔄 **Next Chunk**

Once previews are beautiful and clear, **Chunk 5: Natural Language Parser** will add the ability to understand commands like "swap 100 USDC for SEI".

**Ready to create previews that users can actually understand? Let's make transactions transparent! 🔍**
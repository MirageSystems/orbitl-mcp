# Chunk 3: Gas Estimation System

## 🎯 **Goal**: Provide accurate gas estimates for transaction cost prediction

**Timeline**: 1-2 days  
**Risk**: Low-Medium  
**Dependencies**: Chunks 1 & 2 completed

---

## 📋 **Tasks**

### **3.1: Create Gas Estimation Interface** (30 minutes)
Create `src/wallet/gas-estimator.ts`:
```typescript
export interface GasEstimate {
  gasLimit: string;        // Estimated gas units needed
  gasPrice: string;        // Current network gas price  
  estimatedCost: string;   // Human readable cost ("$0.50")
  estimatedCostWei: string; // Cost in wei
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'; // Estimate confidence
  buffer: number;          // Safety buffer percentage (20% = 1.2x)
}

export class GasEstimator {
  /**
   * Estimate gas for any transaction
   */
  async estimateTransaction(txData: TransactionData): Promise<GasEstimate>
  
  /**
   * Get current network gas price
   */
  async getCurrentGasPrice(): Promise<string>
  
  /**
   * Static estimates for common operations
   */
  getStaticEstimate(operation: 'transfer' | 'approve' | 'swap'): number
}
```

### **3.2: Implement Static Gas Estimates** (1 hour)
Start with simple, static estimates based on historical data:

```typescript
export class GasEstimator {
  
  private static readonly STATIC_ESTIMATES = {
    // ERC-20 operations
    'erc20_transfer': 65000,
    'erc20_approve': 45000,
    'erc20_transferFrom': 70000,
    
    // DEX operations  
    'uniswap_swap': 150000,
    'add_liquidity': 200000,
    'remove_liquidity': 180000,
    
    // Staking operations
    'stake': 100000,
    'unstake': 80000,
    'claim_rewards': 60000
  };
  
  getStaticEstimate(operation: string): number {
    const baseEstimate = this.STATIC_ESTIMATES[operation] || 100000;
    
    // Add safety buffer (20%)
    return Math.floor(baseEstimate * 1.2);
  }
}
```

### **3.3: Add Network Gas Price Fetching** (2 hours)
Integrate with Sei network to get current gas prices:

```typescript
export class GasEstimator {
  private provider: ethers.JsonRpcProvider;
  
  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  
  async getCurrentGasPrice(): Promise<string> {
    try {
      // Get current gas price from network
      const feeData = await this.provider.getFeeData();
      
      // Use gasPrice for legacy, or maxFeePerGas for EIP-1559
      const gasPrice = feeData.gasPrice || feeData.maxFeePerGas;
      
      if (!gasPrice) {
        throw new Error('Unable to fetch gas price');
      }
      
      return gasPrice.toString();
      
    } catch (error) {
      // Fallback to reasonable default (20 gwei equivalent)
      console.warn('Failed to fetch gas price, using default:', error);
      return ethers.parseUnits('20', 'gwei').toString();
    }
  }
}
```

### **3.4: Implement Cost Calculation** (1 hour)
Convert gas estimates to human-readable costs:

```typescript
export class GasEstimator {
  
  async estimateTransaction(txData: TransactionData): Promise<GasEstimate> {
    
    // 1. Get gas limit estimate
    const gasLimit = txData.gasLimit || '100000';
    
    // 2. Get current gas price
    const gasPrice = await this.getCurrentGasPrice();
    
    // 3. Calculate total cost in wei
    const gasCostWei = (BigInt(gasLimit) * BigInt(gasPrice)).toString();
    
    // 4. Convert to human readable (assuming SEI = $0.50)
    const estimatedCost = await this.formatCost(gasCostWei);
    
    return {
      gasLimit,
      gasPrice,
      estimatedCost,
      estimatedCostWei: gasCostWei,
      confidence: 'MEDIUM',
      buffer: 20 // 20% safety buffer
    };
  }
  
  private async formatCost(costWei: string): Promise<string> {
    // Convert wei to SEI (18 decimals)
    const seiAmount = ethers.formatEther(costWei);
    
    // Rough price conversion (SEI ≈ $0.50)  
    const seiPrice = 0.50;
    const usdCost = parseFloat(seiAmount) * seiPrice;
    
    if (usdCost < 0.01) {
      return '<$0.01';
    }
    
    return `$${usdCost.toFixed(2)}`;
  }
}
```

### **3.5: Integrate with Transaction Builder** (1 hour)
Update transaction builder to use real gas estimates:

```typescript
// In src/wallet/transaction-builder.ts

export class SafeTransactionBuilder {
  private gasEstimator: GasEstimator;
  
  constructor(rpcUrl: string) {
    this.gasEstimator = new GasEstimator(rpcUrl);
  }
  
  async buildTransfer(
    tokenAddress: string,
    to: string, 
    amount: string
  ): Promise<SafeTransactionData> {
    
    // ... existing encoding logic ...
    
    // Get accurate gas estimate
    const gasEstimate = this.gasEstimator.getStaticEstimate('erc20_transfer');
    const currentGasPrice = await this.gasEstimator.getCurrentGasPrice();
    
    const transaction: TransactionData = {
      to: tokenAddress,
      data,
      value: '0',
      gasLimit: gasEstimate.toString(),
      gasPrice: currentGasPrice
    };
    
    // Generate detailed cost estimate
    const fullGasEstimate = await this.gasEstimator.estimateTransaction(transaction);
    
    const preview: TransactionPreview = {
      humanDescription: `Transfer ${amount} tokens to ${to}`,
      contractName: 'ERC-20 Token',
      riskLevel: 'LOW',
      warnings: [],
      estimatedCost: fullGasEstimate.estimatedCost
    };
    
    return {
      transaction,
      preview,
      safetyScore: 90,
      gasEstimate: fullGasEstimate // Add gas details
    };
  }
}
```

### **3.6: Add Gas Price Monitoring** (Optional - 1 hour)
For volatile networks, add gas price volatility warnings:

```typescript
export class GasEstimator {
  
  async getGasPriceAnalysis(): Promise<{
    current: string;
    trend: 'rising' | 'falling' | 'stable';
    recommendation: string;
  }> {
    // Could implement simple moving average
    // For now, return current price with basic analysis
    
    const current = await this.getCurrentGasPrice();
    
    return {
      current,
      trend: 'stable',
      recommendation: 'Current gas prices are normal'
    };
  }
}
```

---

## 🧪 **Testing Strategy**

### **Unit Tests**
```typescript
describe('GasEstimator', () => {
  let gasEstimator: GasEstimator;
  
  beforeEach(() => {
    gasEstimator = new GasEstimator('http://localhost:8545');
  });
  
  it('provides static estimates for common operations', () => {
    const transferGas = gasEstimator.getStaticEstimate('erc20_transfer');
    expect(transferGas).toBeGreaterThan(50000);
    expect(transferGas).toBeLessThan(100000);
  });
  
  it('fetches current gas price from network', async () => {
    const gasPrice = await gasEstimator.getCurrentGasPrice();
    expect(gasPrice).toMatch(/^\d+$/); // Should be a number string
    expect(BigInt(gasPrice)).toBeGreaterThan(0n);
  });
  
  it('calculates transaction costs correctly', async () => {
    const mockTxData: TransactionData = {
      to: '0x123',
      data: '0x456', 
      value: '0',
      gasLimit: '65000'
    };
    
    const estimate = await gasEstimator.estimateTransaction(mockTxData);
    
    expect(estimate.gasLimit).toBe('65000');
    expect(estimate.estimatedCost).toMatch(/^\$\d+\.\d{2}$/);
    expect(estimate.confidence).toBe('MEDIUM');
  });
});
```

### **Integration Tests**
```typescript
describe('Transaction Builder with Gas Estimation', () => {
  it('builds transactions with accurate gas estimates', async () => {
    const builder = new SafeTransactionBuilder('http://sei-rpc-url');
    
    const result = await builder.buildTransfer(
      '0xTokenAddress',
      '0xRecipient',
      '100'
    );
    
    // Should have realistic gas estimates
    expect(parseInt(result.transaction.gasLimit!)).toBeGreaterThan(50000);
    expect(result.preview.estimatedCost).toMatch(/\$\d+\.\d{2}/);
    expect(result.gasEstimate).toBeDefined();
  });
});
```

### **Manual Testing**
```bash
# Test gas estimation directly
pnpm tsx -e "
import { GasEstimator } from './src/wallet/gas-estimator.js';

const estimator = new GasEstimator('https://sei-rpc-url');

// Test static estimates
console.log('ERC-20 Transfer:', estimator.getStaticEstimate('erc20_transfer'));
console.log('Token Approval:', estimator.getStaticEstimate('erc20_approve'));

// Test current gas price
const gasPrice = await estimator.getCurrentGasPrice();
console.log('Current Gas Price:', gasPrice);

// Test cost calculation
const mockTx = {
  to: '0x123',
  data: '0x456',
  value: '0',
  gasLimit: '65000'
};

const estimate = await estimator.estimateTransaction(mockTx);
console.log('Cost Estimate:', estimate);
"
```

---

## ✅ **Acceptance Criteria**

- [ ] Static gas estimates for common operations
- [ ] Current gas price fetching from Sei network
- [ ] Human-readable cost estimates ($X.XX format)
- [ ] Integration with transaction builder
- [ ] Reasonable fallbacks when network unavailable
- [ ] Safety buffer included in estimates
- [ ] All tests pass
- [ ] Cost estimates are within 20% of actual

---

## 🔍 **Key Validation Points**

### **Critical**
- **Estimate Accuracy**: Within 20% of actual gas usage
- **Network Integration**: Successfully fetches real gas prices
- **Fallback Handling**: Works even when RPC is down
- **Cost Format**: Clear, user-friendly cost display

### **Performance**
- **Speed**: Gas estimation adds <500ms to transaction building
- **Caching**: Don't fetch gas price on every estimate
- **Error Handling**: Graceful degradation when network fails

---

## 🔧 **Configuration Options**

Allow users to configure gas preferences:
```typescript
interface GasConfig {
  preferredSpeed: 'slow' | 'standard' | 'fast';
  maxGasPrice?: string;     // User-defined gas price limit
  safetyBuffer: number;     // Custom safety buffer (default 20%)
}
```

---

## 🚀 **Deliverables**

1. `src/wallet/gas-estimator.ts` - Core gas estimation
2. Updated `src/wallet/transaction-builder.ts` - Integrated gas estimates  
3. `src/wallet/types.ts` - Updated with gas estimate types
4. Tests for all gas estimation functions
5. Manual validation of gas estimate accuracy
6. Network integration working with Sei RPC

---

## 🔄 **Next Chunk**

Once gas estimation is working, **Chunk 4: Transaction Preview** will create beautiful, detailed previews that show users exactly what they're about to sign.

**Ready to estimate gas costs accurately? Let's make transaction costs predictable! ⛽**
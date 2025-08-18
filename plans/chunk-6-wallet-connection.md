# Chunk 6: Wallet Connection Interface

## 🎯 **Goal**: Connect to user wallets for safe transaction signing

**Timeline**: 3-4 days  
**Risk**: Medium-High  
**Dependencies**: Chunks 1-5 completed

---

## 📋 **Tasks**

### **6.1: Define Wallet Interface** (1 hour)
Create `src/wallet/wallet-interface.ts`:

```typescript
export interface WalletConnection {
  address: string;           // Connected wallet address
  chainId: number;           // Network chain ID
  walletType: WalletType;    // Which wallet is connected
  isConnected: boolean;      // Connection status
}

export interface WalletProvider {
  name: string;              // "MetaMask", "WalletConnect", etc.
  icon?: string;             // For UI display
  isAvailable: boolean;      // Can be used in current environment
  connect(): Promise<WalletConnection>;
  disconnect(): Promise<void>;
  signTransaction(txData: TransactionData): Promise<string>;
  getBalance(tokenAddress?: string): Promise<string>;
}

export type WalletType = 'metamask' | 'walletconnect' | 'keplr' | 'ledger' | 'coinbase';

export interface SigningResult {
  success: boolean;
  transactionHash?: string;  // If successful
  error?: string;            // If failed
  userRejected?: boolean;    // If user cancelled
}
```

### **6.2: Implement WalletConnect Integration** (4-5 hours)
Install WalletConnect dependencies:
```bash
pnpm add @walletconnect/sign-client @walletconnect/types @walletconnect/utils
```

Create `src/wallet/providers/walletconnect-provider.ts`:
```typescript
import { SignClient } from '@walletconnect/sign-client';

export class WalletConnectProvider implements WalletProvider {
  name = 'WalletConnect';
  isAvailable = true;
  
  private signClient?: SignClient;
  private session?: any;
  private connection?: WalletConnection;
  
  async connect(): Promise<WalletConnection> {
    
    // 1. Initialize WalletConnect client
    this.signClient = await SignClient.init({
      projectId: process.env.WALLETCONNECT_PROJECT_ID!, // From WalletConnect Cloud
      metadata: {
        name: 'Orbitl',
        description: 'AI Smart Contract Analyst',
        url: 'https://orbitl.ai',
        icons: ['https://orbitl.ai/icon.png']
      }
    });
    
    // 2. Create connection proposal
    const { uri, approval } = await this.signClient.connect({
      requiredNamespaces: {
        eip155: {
          methods: ['eth_sendTransaction', 'eth_signTransaction', 'eth_accounts'],
          chains: ['eip155:1329'], // Sei Pacific-1 chain ID
          events: ['accountsChanged', 'chainChanged']
        }
      }
    });
    
    // 3. Display QR code or deep link for mobile wallets
    if (uri) {
      await this.displayConnectionOptions(uri);
    }
    
    // 4. Wait for user to approve connection
    this.session = await approval();
    
    // 5. Extract account information
    const accounts = this.session.namespaces.eip155.accounts;
    const address = accounts[0].split(':')[2]; // Extract address from CAIP-10 format
    const chainId = parseInt(accounts[0].split(':')[1]);
    
    this.connection = {
      address,
      chainId,
      walletType: 'walletconnect',
      isConnected: true
    };
    
    return this.connection;
  }
  
  async signTransaction(txData: TransactionData): Promise<string> {
    if (!this.signClient || !this.session) {
      throw new Error('Wallet not connected');
    }
    
    try {
      // Format transaction for signing
      const transaction = {
        from: this.connection!.address,
        to: txData.to,
        data: txData.data,
        value: txData.value || '0x0',
        gas: txData.gasLimit ? `0x${parseInt(txData.gasLimit).toString(16)}` : '0x5208',
        gasPrice: txData.gasPrice ? `0x${parseInt(txData.gasPrice).toString(16)}` : undefined
      };
      
      // Request signature from wallet
      const result = await this.signClient.request({
        topic: this.session.topic,
        chainId: `eip155:${this.connection!.chainId}`,
        request: {
          method: 'eth_sendTransaction',
          params: [transaction]
        }
      });
      
      return result as string; // Transaction hash
      
    } catch (error) {
      if (error.message.includes('User rejected')) {
        throw new Error('Transaction rejected by user');
      }
      throw error;
    }
  }
  
  private async displayConnectionOptions(uri: string): Promise<void> {
    console.log('\\n' + chalk.blue('📱 Connect Your Wallet'));
    console.log('\\n' + chalk.gray('Choose your connection method:'));
    
    // Option 1: QR Code (for desktop)
    console.log('\\n' + chalk.cyan('1. 📱 Mobile Wallet (QR Code)'));
    console.log('   Scan this QR code with your mobile wallet:');
    
    // Generate QR code in terminal
    const QRCode = require('qrcode');
    const qrString = await QRCode.toString(uri, { type: 'terminal', small: true });
    console.log(qrString);
    
    // Option 2: Deep links (for mobile)
    console.log('\\n' + chalk.cyan('2. 🔗 Deep Links'));
    const popularWallets = [
      { name: 'MetaMask', deepLink: `metamask://wc?uri=${encodeURIComponent(uri)}` },
      { name: 'Trust Wallet', deepLink: `trust://wc?uri=${encodeURIComponent(uri)}` },
      { name: 'Rainbow', deepLink: `rainbow://wc?uri=${encodeURIComponent(uri)}` }
    ];
    
    popularWallets.forEach(wallet => {
      console.log(`   ${wallet.name}: ${chalk.blue(wallet.deepLink)}`);
    });
    
    console.log('\\n' + chalk.yellow('⏳ Waiting for wallet connection...'));
  }
  
  async disconnect(): Promise<void> {
    if (this.signClient && this.session) {
      await this.signClient.disconnect({
        topic: this.session.topic,
        reason: {
          code: 6000,
          message: 'User disconnected'
        }
      });
    }
    
    this.session = undefined;
    this.connection = undefined;
  }
}
```

### **6.3: Add Browser Wallet Support** (2 hours)
Create `src/wallet/providers/browser-provider.ts`:
```typescript
export class BrowserWalletProvider implements WalletProvider {
  name: string;
  isAvailable: boolean;
  private provider?: any;
  
  constructor(walletType: 'metamask' | 'coinbase') {
    this.name = walletType === 'metamask' ? 'MetaMask' : 'Coinbase Wallet';
    
    // Check if wallet is installed
    if (typeof window !== 'undefined') {
      if (walletType === 'metamask') {
        this.isAvailable = !!(window as any).ethereum?.isMetaMask;
        this.provider = (window as any).ethereum;
      } else {
        this.isAvailable = !!(window as any).ethereum?.isCoinbaseWallet;
        this.provider = (window as any).ethereum;
      }
    } else {
      // Not in browser environment
      this.isAvailable = false;
    }
  }
  
  async connect(): Promise<WalletConnection> {
    if (!this.isAvailable || !this.provider) {
      throw new Error(\`\${this.name} is not installed\`);
    }
    
    try {
      // Request account access
      const accounts = await this.provider.request({ 
        method: 'eth_requestAccounts' 
      });
      
      // Get chain ID
      const chainId = await this.provider.request({ 
        method: 'eth_chainId' 
      });
      
      return {
        address: accounts[0],
        chainId: parseInt(chainId, 16),
        walletType: this.name.toLowerCase().includes('metamask') ? 'metamask' : 'coinbase',
        isConnected: true
      };
      
    } catch (error) {
      if (error.code === 4001) {
        throw new Error('Connection rejected by user');
      }
      throw error;
    }
  }
  
  async signTransaction(txData: TransactionData): Promise<string> {
    if (!this.provider) {
      throw new Error('Wallet not connected');
    }
    
    try {
      const txHash = await this.provider.request({
        method: 'eth_sendTransaction',
        params: [{
          to: txData.to,
          data: txData.data,
          value: txData.value || '0x0',
          gas: txData.gasLimit ? `0x\${parseInt(txData.gasLimit).toString(16)}` : undefined,
          gasPrice: txData.gasPrice ? `0x\${parseInt(txData.gasPrice).toString(16)}` : undefined
        }]
      });
      
      return txHash;
      
    } catch (error) {
      if (error.code === 4001) {
        throw new Error('Transaction rejected by user');
      }
      throw error;
    }
  }
  
  async disconnect(): Promise<void> {
    // Browser wallets don't have explicit disconnect
    // Just clear our reference
    this.provider = undefined;
  }
}
```

### **6.4: Create Wallet Manager** (2 hours)
Create `src/wallet/wallet-manager.ts`:
```typescript
export class WalletManager {
  private providers: Map<WalletType, WalletProvider> = new Map();
  private activeConnection?: WalletConnection;
  private activeProvider?: WalletProvider;
  
  constructor() {
    this.initializeProviders();
  }
  
  private initializeProviders() {
    // WalletConnect (always available)
    this.providers.set('walletconnect', new WalletConnectProvider());
    
    // Browser wallets (only in browser)
    if (typeof window !== 'undefined') {
      this.providers.set('metamask', new BrowserWalletProvider('metamask'));
      this.providers.set('coinbase', new BrowserWalletProvider('coinbase'));
    }
  }
  
  /**
   * Get all available wallet options
   */
  getAvailableWallets(): WalletProvider[] {
    return Array.from(this.providers.values())
      .filter(provider => provider.isAvailable);
  }
  
  /**
   * Connect to a specific wallet
   */
  async connect(walletType: WalletType): Promise<WalletConnection> {
    const provider = this.providers.get(walletType);
    if (!provider) {
      throw new Error(\`Wallet type \${walletType} not supported\`);
    }
    
    if (!provider.isAvailable) {
      throw new Error(\`\${provider.name} is not available\`);
    }
    
    try {
      this.activeConnection = await provider.connect();
      this.activeProvider = provider;
      
      console.log(\`\\n\${chalk.green('✅ Connected to \${provider.name}')}\`);
      console.log(\`Address: \${chalk.cyan(this.activeConnection.address)}\`);
      console.log(\`Chain ID: \${this.activeConnection.chainId}\\n\`);
      
      return this.activeConnection;
      
    } catch (error) {
      console.log(\`\\n\${chalk.red('❌ Failed to connect to \${provider.name}')}\`);
      console.log(\`Error: \${error.message}\\n\`);
      throw error;
    }
  }
  
  /**
   * Sign and submit transaction
   */
  async signTransaction(txData: TransactionData): Promise<SigningResult> {
    if (!this.activeProvider || !this.activeConnection) {
      throw new Error('No wallet connected');
    }
    
    try {
      console.log(\`\\n\${chalk.blue('📝 Requesting signature from \${this.activeProvider.name}...')}\`);
      
      const txHash = await this.activeProvider.signTransaction(txData);
      
      console.log(\`\${chalk.green('✅ Transaction signed and submitted!')}\`);
      console.log(\`Transaction Hash: \${chalk.cyan(txHash)}\\n\`);
      
      return {
        success: true,
        transactionHash: txHash
      };
      
    } catch (error) {
      const isUserRejection = error.message.includes('rejected') || 
                             error.message.includes('denied') ||
                             error.message.includes('cancelled');
      
      console.log(\`\${chalk.red('❌ Transaction failed')}\`);
      console.log(\`Error: \${error.message}\\n\`);
      
      return {
        success: false,
        error: error.message,
        userRejected: isUserRejection
      };
    }
  }
  
  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return !!this.activeConnection?.isConnected;
  }
  
  /**
   * Get current connection info
   */
  getConnection(): WalletConnection | undefined {
    return this.activeConnection;
  }
  
  /**
   * Disconnect current wallet
   */
  async disconnect(): Promise<void> {
    if (this.activeProvider) {
      await this.activeProvider.disconnect();
      this.activeProvider = undefined;
      this.activeConnection = undefined;
      
      console.log(\`\${chalk.yellow('👋 Wallet disconnected')}\\n\`);
    }
  }
}
```

### **6.5: Create Connection UI** (2 hours)
Create `src/wallet/connection-ui.ts`:
```typescript
import { createInterface } from 'readline';

export class WalletConnectionUI {
  
  /**
   * Show wallet selection menu and get user choice
   */
  async promptWalletSelection(availableWallets: WalletProvider[]): Promise<WalletType> {
    console.log('\\n' + chalk.blue.bold('🔗 Connect Your Wallet'));
    console.log('\\nChoose a wallet to connect:');
    
    availableWallets.forEach((wallet, index) => {
      const icon = this.getWalletIcon(wallet.name);
      console.log(\`  \${index + 1}. \${icon} \${chalk.cyan(wallet.name)}\`);
    });
    
    console.log(\`  \${availableWallets.length + 1}. \${chalk.gray('❌ Cancel')}\`);
    
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve, reject) => {
      rl.question(\`\\nSelect option (1-\${availableWallets.length + 1}): \`, (answer) => {
        rl.close();
        
        const choice = parseInt(answer);
        
        if (choice === availableWallets.length + 1) {
          reject(new Error('Connection cancelled by user'));
          return;
        }
        
        if (choice < 1 || choice > availableWallets.length) {
          reject(new Error('Invalid selection'));
          return;
        }
        
        const selectedWallet = availableWallets[choice - 1];
        const walletType = this.getWalletType(selectedWallet.name);
        resolve(walletType);
      });
    });
  }
  
  /**
   * Show transaction confirmation prompt
   */
  async promptTransactionConfirmation(preview: DetailedTransactionPreview): Promise<boolean> {
    console.log('\\n' + chalk.yellow.bold('⚠️ Transaction Confirmation Required'));
    
    // Show any critical warnings
    const criticalWarnings = preview.confirmations.filter(c => c.userMustAcknowledge);
    if (criticalWarnings.length > 0) {
      console.log('\\n' + chalk.red('🚨 Please acknowledge:'));
      criticalWarnings.forEach(warning => {
        console.log(\`  ❗ \${warning.message}\`);
      });
    }
    
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(\`\\n\${chalk.cyan('Do you want to proceed with this transaction? (yes/no): ')}\`, (answer) => {
        rl.close();
        resolve(answer.toLowerCase().startsWith('y'));
      });
    });
  }
  
  private getWalletIcon(walletName: string): string {
    const icons = {
      'WalletConnect': '📱',
      'MetaMask': '🦊',
      'Coinbase Wallet': '🔷',
      'Keplr': '⭐',
      'Ledger': '🔐'
    };
    return icons[walletName as keyof typeof icons] || '💳';
  }
  
  private getWalletType(walletName: string): WalletType {
    const mapping = {
      'WalletConnect': 'walletconnect',
      'MetaMask': 'metamask',
      'Coinbase Wallet': 'coinbase',
      'Keplr': 'keplr',
      'Ledger': 'ledger'
    };
    return mapping[walletName as keyof typeof mapping] as WalletType;
  }
}
```

### **6.6: Integration with Command Processor** (1 hour)
Update `src/wallet/command-processor.ts`:
```typescript
export class CommandProcessor {
  private walletManager: WalletManager;
  private connectionUI: WalletConnectionUI;
  
  constructor(rpcUrl: string) {
    // ... existing code ...
    this.walletManager = new WalletManager();
    this.connectionUI = new WalletConnectionUI();
  }
  
  /**
   * Execute a complete transaction flow
   */
  async executeTransaction(input: string): Promise<ExecutionResult> {
    
    // 1. Parse and build transaction
    const processed = await this.processCommand(input);
    if (!processed.success) {
      return processed;
    }
    
    // 2. Show beautiful preview
    const previewFormatted = TransactionPreviewFormatter.formatPreview(processed.transaction!.preview);
    console.log(previewFormatted);
    
    // 3. Get user confirmation
    const confirmed = await this.connectionUI.promptTransactionConfirmation(processed.transaction!.preview);
    if (!confirmed) {
      return {
        success: false,
        error: 'Transaction cancelled by user'
      };
    }
    
    // 4. Connect wallet if not connected
    if (!this.walletManager.isConnected()) {
      const availableWallets = this.walletManager.getAvailableWallets();
      if (availableWallets.length === 0) {
        return {
          success: false,
          error: 'No wallets available. Please install MetaMask or use WalletConnect.'
        };
      }
      
      try {
        const walletType = await this.connectionUI.promptWalletSelection(availableWallets);
        await this.walletManager.connect(walletType);
      } catch (error) {
        return {
          success: false,
          error: \`Failed to connect wallet: \${error.message}\`
        };
      }
    }
    
    // 5. Sign and submit transaction
    const signingResult = await this.walletManager.signTransaction(processed.transaction!.transaction);
    
    return {
      success: signingResult.success,
      transactionHash: signingResult.transactionHash,
      error: signingResult.error
    };
  }
}
```

---

## 🧪 **Testing Strategy**

### **Mock Testing** (For Development)
```typescript
// Create mock wallet for testing
export class MockWalletProvider implements WalletProvider {
  name = 'Mock Wallet';
  isAvailable = true;
  
  async connect(): Promise<WalletConnection> {
    return {
      address: '0x742d35Cc6665Cb9D9dC69E7A1E15f2fc0C9A3456',
      chainId: 1329,
      walletType: 'metamask',
      isConnected: true
    };
  }
  
  async signTransaction(txData: TransactionData): Promise<string> {
    // Return mock transaction hash
    return '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  }
  
  async disconnect(): Promise<void> {
    // Mock disconnect
  }
}
```

### **Integration Testing**
```bash
# Test wallet connection flow
pnpm tsx -e "
import { WalletManager } from './src/wallet/wallet-manager.js';

const manager = new WalletManager();

console.log('Available wallets:');
const wallets = manager.getAvailableWallets();
wallets.forEach(wallet => console.log('-', wallet.name));

// Test WalletConnect (if PROJECT_ID is set)
if (process.env.WALLETCONNECT_PROJECT_ID) {
  try {
    console.log('\\nTesting WalletConnect...');
    const connection = await manager.connect('walletconnect');
    console.log('Connected:', connection);
  } catch (error) {
    console.log('Connection failed:', error.message);
  }
}
"
```

---

## ✅ **Acceptance Criteria**

- [ ] WalletConnect integration works with QR codes
- [ ] Browser wallet detection and connection
- [ ] Beautiful wallet selection interface
- [ ] Transaction signing with user confirmation
- [ ] Proper error handling for user rejection
- [ ] Connection status management
- [ ] Integration with existing transaction builder
- [ ] Support for multiple wallet types
- [ ] Clear user feedback during connection process

---

## 🔧 **Environment Setup**

Create `.env.example`:
```bash
# WalletConnect Project ID (get from https://cloud.walletconnect.com)
WALLETCONNECT_PROJECT_ID=your_project_id_here

# Network configuration
SEI_RPC_URL=https://sei-rpc-url
SEI_CHAIN_ID=1329
```

---

## 🚀 **Deliverables**

1. `src/wallet/wallet-interface.ts` - Core wallet interfaces
2. `src/wallet/providers/walletconnect-provider.ts` - WalletConnect integration
3. `src/wallet/providers/browser-provider.ts` - MetaMask/Coinbase support
4. `src/wallet/wallet-manager.ts` - Central wallet management
5. `src/wallet/connection-ui.ts` - User interface for connections
6. Updated command processor with transaction execution
7. Mock wallet for testing
8. Integration tests for wallet connection flow

---

## 🔄 **Next Chunk**

Once wallet connection works, **Chunk 7: Integration & Polish** will bring everything together into a seamless user experience.

**Ready to connect wallets safely? Let's make transaction signing smooth and secure! 🔗**
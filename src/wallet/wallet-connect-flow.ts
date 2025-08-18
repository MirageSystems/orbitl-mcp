// WalletConnect Flow Integration
// Shows QR → Wait → Send transaction flow

import qrcode from 'qrcode-terminal';
import { WalletConnect, WALLETCONNECT_CONFIG } from './wallet-connect.js';
import type { TransactionData } from './types.js';

export interface WalletFlowResult {
  success: boolean;
  message: string;
  transactionHash?: string;
  explorerUrl?: string;
  error?: string;
}

/**
 * Wallet connection and transaction flow
 * No complex state management - just QR → Connect → Send
 */
export class WalletConnectFlow {
  private wallet: WalletConnect;
  private isConnected: boolean = false;

  constructor() {
    this.wallet = new WalletConnect(WALLETCONNECT_CONFIG);
  }

  /**
   * Show QR code and wait for wallet connection
   */
  async showQRAndConnect(): Promise<WalletFlowResult> {
    try {
      console.log('\n🔗 Initializing WalletConnect...');
      
      // Initialize WalletConnect
      await this.wallet.initialize();
      
      // Generate connection URI
      const { uri } = await this.wallet.generateConnectionURI();
      
      console.log('\n📱 Scan QR code with your mobile wallet:');
      console.log('   • MetaMask Mobile');
      console.log('   • Trust Wallet');  
      console.log('   • Rainbow Wallet');
      
      // Show QR code in terminal
      qrcode.generate(uri, { small: true });
      
      console.log('\n🔗 Or copy this URI to your wallet:');
      console.log(`${uri.slice(0, 50)}...`);
      
      console.log('\n⏳ Waiting for connection...');
      
      // Wait for connection (simplified)
      return new Promise((resolve) => {
        let timeout: NodeJS.Timeout;
        
        this.wallet.on('session_connected', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          
          console.log('\n✅ Wallet connected successfully!');
          
          const state = this.wallet.getConnectionState();
          console.log(`📱 Connected: ${state.account?.slice(0, 6)}...${state.account?.slice(-4)}`);
          
          resolve({
            success: true,
            message: 'Wallet connected successfully'
          });
        });
        
        this.wallet.on('error', (error) => {
          clearTimeout(timeout);
          
          console.log(`\n❌ Connection failed: ${error.message}`);
          
          resolve({
            success: false,
            message: 'Connection failed',
            error: error.message
          });
        });
        
        // 2 minute timeout
        timeout = setTimeout(() => {
          console.log('\n⏰ Connection timeout after 2 minutes');
          
          resolve({
            success: false,
            message: 'Connection timeout - please try again'
          });
        }, 120000);
      });
      
    } catch (error) {
      return {
        success: false,
        message: 'Failed to initialize WalletConnect',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send transaction to connected wallet for signing
   */
  async sendTransactionForSigning(txData: TransactionData): Promise<WalletFlowResult> {
    if (!this.isConnected) {
      return {
        success: false,
        message: 'No wallet connected - please connect first',
        error: 'NOT_CONNECTED'
      };
    }

    try {
      console.log('\n📤 Sending transaction to wallet for signing...');
      console.log(`   To: ${txData.to}`);
      console.log(`   Data: ${txData.data?.slice(0, 20)}...`);
      console.log(`   Gas: ${txData.gasLimit}`);
      
      // PRODUCTION READY: Actual WalletConnect transaction sending
      console.log('\n⏳ Please approve in your wallet app...');
      
      try {
        // Send actual transaction via WalletConnect
        const transactionHash = await this.wallet.sendTransaction(txData);
        
        const chainId = this.wallet.getChainId();
        const isTestnet = chainId === '1328' || chainId === 'atlantic-2'; 
        const networkName = isTestnet ? 'Atlantic-2 (Testnet)' : 'Pacific-1 (Mainnet)';
        const explorerBase = isTestnet 
          ? 'https://www.seiscan.app/atlantic-2/txs'
          : 'https://www.seiscan.app/pacific-1/txs';
        
        console.log('\n✅ Transaction signed and submitted!');
        console.log(`🔗 Transaction Hash: ${transactionHash}`);
        console.log(`🌐 Network: Sei ${networkName}`);
        console.log(`🔍 Track progress: ${explorerBase}/${transactionHash}`);
        console.log('\n🎉 Transaction complete! Your wallet will update automatically.');
        
        return {
          success: true,
          message: 'Transaction submitted successfully',
          transactionHash,
          explorerUrl: `${explorerBase}/${transactionHash}`
        };
        
      } catch (txError) {
        console.log(`\n❌ Transaction rejected by user or failed`);
        
        return {
          success: false,
          message: 'Transaction rejected or failed',
          error: txError instanceof Error ? txError.message : 'Transaction failed'
        };
      }
      
    } catch (error) {
      console.log(`\n❌ Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        success: false,
        message: 'Transaction signing failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Complete flow: Connect → Send transaction
   */
  async executeTransaction(txData: TransactionData): Promise<WalletFlowResult> {
    // Step 1: Connect wallet if not connected
    if (!this.isConnected) {
      const connectionResult = await this.showQRAndConnect();
      
      if (!connectionResult.success) {
        return connectionResult;
      }
    }

    // Step 2: Send transaction
    return await this.sendTransactionForSigning(txData);
  }

  /**
   * Check if wallet is currently connected
   */
  isWalletConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get connection status for display
   */
  getConnectionStatus(): string {
    if (!this.isConnected) {
      return '🔴 No wallet connected';
    }

    const state = this.wallet.getConnectionState();
    return `🟢 Connected: ${state.account?.slice(0, 6)}...${state.account?.slice(-4)}`;
  }
}
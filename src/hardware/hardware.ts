import { ethers } from 'ethers';
import type { TransactionData } from '../wallet/types.js';

export interface HardwareWallet {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAddress(path: string): Promise<string>;
  signTransaction(tx: UnsignedTransaction, path: string): Promise<string>;
  isConnected(): boolean;
  getDeviceInfo(): Promise<DeviceInfo>;
}

export interface UnsignedTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit: string;
  gasPrice: string;
  nonce: number;
  chainId: number;
}

export interface DeviceInfo {
  model: string;
  version: string;
  deviceId: string;
}

export type WalletType = 'ledger' | 'trezor';

export class HardwareWalletManager {
  private wallets: Map<WalletType, HardwareWallet> = new Map();

async detectWallets(): Promise<WalletType[]> {
  const available: WalletType[] = [];

  try {
    const { LedgerWallet } = await import('./ledger.js');
    const ledger = new LedgerWallet();
    await ledger.connect();
    // Verify device presence by fetching a default address
    await ledger.getAddress("m/44'/60'/0'/0/0");
    this.wallets.set('ledger', ledger);
    available.push('ledger');
    console.log('✅ Ledger wallet detected');
  } catch (error) {
    console.log(`❌ Ledger not available: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  try {
    const { TrezorWallet } = await import('./trezor.js');
    const trezor = new TrezorWallet();
    await trezor.connect();
    // Verify device presence by fetching a default address
    await trezor.getAddress("m/44'/60'/0'/0/0");
    this.wallets.set('trezor', trezor);
    available.push('trezor');
    console.log('✅ Trezor wallet detected');
  } catch (error) {
    console.log(`❌ Trezor not available: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return available;
}

  getWallet(type: WalletType): HardwareWallet | undefined {
    return this.wallets.get(type);
  }

  async signWithHardware(
    type: WalletType,
    transaction: TransactionData,
    path: string = "m/44'/60'/0'/0/0",
    rpcUrl: string = 'https://evm-rpc.sei-apis.com'
  ): Promise<string> {
    const wallet = this.getWallet(type);
    if (!wallet) {
      throw new Error(`${type} wallet not available`);
    }

    // Derive sender from the hardware path and query nonce/chainId from RPC
    const fromAddress = await wallet.getAddress(path);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const nonce = await provider.getTransactionCount(fromAddress);
    const { chainId } = await provider.getNetwork();

    const unsignedTx: UnsignedTransaction = {
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
      gasLimit: transaction.gasLimit || '65000',
      gasPrice: transaction.gasPrice || '10000000000',
      nonce,
      chainId: Number(chainId)
    };

    return await wallet.signTransaction(unsignedTx, path);
  }

  private async getNonce(address: string, rpcUrl: string): Promise<number> {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return await provider.getTransactionCount(address);
  }
}
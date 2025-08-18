import type { HardwareWallet, UnsignedTransaction, DeviceInfo } from './hardware';

export class LedgerWallet implements HardwareWallet {
  private transport: any;
  private ethApp: any;
  private connected = false;

  async connect(): Promise<void> {
    try {
      const TransportNodeHid = await import('@ledgerhq/hw-transport-node-hid').then(m => m.default);
      const Eth = await import('@ledgerhq/hw-app-eth').then(m => m.default);
      
      this.transport = await TransportNodeHid.create();
      this.ethApp = new Eth(this.transport);
      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect to Ledger: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
      this.ethApp = null;
      this.connected = false;
    }
  }

  async getAddress(path: string = "m/44'/60'/0'/0/0"): Promise<string> {
    if (!this.connected || !this.ethApp) {
      throw new Error('Ledger not connected');
    }

    try {
      const result = await this.ethApp.getAddress(path, false);
      return result.address;
    } catch (error) {
      throw new Error(`Failed to get address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async signTransaction(tx: UnsignedTransaction, path: string = "m/44'/60'/0'/0/0"): Promise<string> {
    if (!this.connected || !this.ethApp) {
      throw new Error('Ledger not connected');
    }

    try {
      const { ethers } = await import('ethers');
      
      const txData = {
        to: tx.to,
        value: tx.value,
        data: tx.data,
        gasLimit: tx.gasLimit,
        gasPrice: tx.gasPrice,
        nonce: tx.nonce,
        type: 0,
        chainId: tx.chainId
      };

      const serialized = ethers.Transaction.from(txData).unsignedSerialized.slice(2);
      const signature = await this.ethApp.signTransaction(path, serialized);

      const v = parseInt(signature.v, 16);
      const r = `0x${signature.r}`;
      const s = `0x${signature.s}`;

      const signedTx = ethers.Transaction.from({
        ...txData,
        signature: { v, r, s }
      });

      return signedTx.serialized;
    } catch (error) {
      throw new Error(`Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    if (!this.connected || !this.ethApp) {
      throw new Error('Ledger not connected');
    }

    try {
      const appConfig = await this.ethApp.getAppConfiguration();
      return {
        model: 'Ledger',
        version: appConfig.version,
        deviceId: 'ledger-device'
      };
    } catch (error) {
      return {
        model: 'Ledger',
        version: 'Unknown',
        deviceId: 'ledger-device'
      };
    }
  }
}
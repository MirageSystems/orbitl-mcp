import type { HardwareWallet, UnsignedTransaction, DeviceInfo } from './hardware';

export class TrezorWallet implements HardwareWallet {
  private TrezorConnect: any;
  private connected = false;

  async connect(): Promise<void> {
    try {
      this.TrezorConnect = await import('@trezor/connect').then(m => m.default);
      
      await this.TrezorConnect.init({
        lazyLoad: true,
        manifest: {
          email: 'orbitl@example.com',
          appUrl: 'https://orbitl.app'
        }
      });
      
      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect to Trezor: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.TrezorConnect) {
      await this.TrezorConnect.dispose();
      this.TrezorConnect = null;
      this.connected = false;
    }
  }

  async getAddress(path: string = "m/44'/60'/0'/0/0"): Promise<string> {
    if (!this.connected || !this.TrezorConnect) {
      throw new Error('Trezor not connected');
    }

    try {
      const result = await this.TrezorConnect.ethereumGetAddress({
        path: path,
        showOnTrezor: false
      });

      if (!result.success) {
        throw new Error(result.payload.error);
      }

      return result.payload.address;
    } catch (error) {
      throw new Error(`Failed to get address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async signTransaction(tx: UnsignedTransaction, path: string = "m/44'/60'/0'/0/0"): Promise<string> {
    if (!this.connected || !this.TrezorConnect) {
      throw new Error('Trezor not connected');
    }

    try {
      const { ethers } = await import('ethers');
      
      const result = await this.TrezorConnect.ethereumSignTransaction({
        path: path,
        transaction: {
          to: tx.to,
          value: ethers.toBeHex(tx.value),
          data: tx.data,
          gasLimit: tx.gasLimit,
          gasPrice: tx.gasPrice,
          nonce: `0x${tx.nonce.toString(16)}`,
          chainId: tx.chainId
        }
      });

      if (!result.success) {
        throw new Error(result.payload.error);
      }
      
      const signedTx = ethers.Transaction.from({
        to: tx.to,
        value: tx.value,
        data: tx.data,
        gasLimit: tx.gasLimit,
        gasPrice: tx.gasPrice,
        nonce: tx.nonce,
        chainId: tx.chainId,
        signature: {
          v: parseInt(result.payload.v, 16),
          r: result.payload.r,
          s: result.payload.s
        }
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
    if (!this.connected || !this.TrezorConnect) {
      throw new Error('Trezor not connected');
    }

    try {
      const result = await this.TrezorConnect.getFeatures();
      
      if (!result.success) {
        throw new Error(result.payload.error);
      }

      return {
        model: result.payload.model || 'Trezor',
        version: result.payload.major_version + '.' + result.payload.minor_version + '.' + result.payload.patch_version,
        deviceId: result.payload.device_id || 'trezor-device'
      };
    } catch (error) {
      return {
        model: 'Trezor',
        version: 'Unknown',
        deviceId: 'trezor-device'
      };
    }
  }
}
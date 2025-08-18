import { SignClient } from "@walletconnect/sign-client";
import { getSdkError } from "@walletconnect/utils";
import { EventEmitter } from "events";

export interface WalletConnectOptions {
  projectId: string;
  metadata: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
}

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  account?: string;
  chainId?: string;
  sessionTopic?: string;
}

export interface TransactionRequest {
  from?: string;
  to: string;
  data?: string;
  value?: string;
  gas?: string;
  gasPrice?: string;
}

export interface WalletConnectSession {
  topic: string;
  namespaces: {
    eip155?: {
      accounts: string[];
      chains: string[];
      methods: string[];
      events: string[];
    };
  };
}

export class WalletConnect extends EventEmitter {
  private signClient: any = null;
  private connectionState: ConnectionState = {
    isConnected: false,
    isConnecting: false,
  };

  constructor(private options: WalletConnectOptions) {
    super();
  }

  async initialize(): Promise<void> {
    try {
      this.signClient = await SignClient.init({
        projectId: this.options.projectId,
        metadata: this.options.metadata,
      });

      this.setupEventListeners();
      this.emit("initialized");
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.signClient) return;

    this.signClient.on("session_event", this.onSessionEvent.bind(this));
    this.signClient.on("session_update", this.onSessionUpdate.bind(this));
    this.signClient.on("session_delete", this.onSessionDelete.bind(this));
    this.signClient.on("session_expire", this.onSessionExpire.bind(this));
  }

  async generateConnectionURI(): Promise<{ uri: string; qrCodeData: string }> {
    if (!this.signClient) {
      throw new Error("SignClient not initialized");
    }

    this.updateConnectionState({ isConnecting: true });

    try {
      // Connect to session using proper Ethereum namespaces
      const { uri, approval } = await this.signClient.connect({
        requiredNamespaces: {
          eip155: {
            methods: [
              "eth_sendTransaction",
              "eth_signTransaction",
              "eth_sign",
              "personal_sign",
              "eth_signTypedData",
              "eth_signTypedData_v4",
            ],
            chains: ["eip155:1329", "eip155:1328"], // Sei mainnet and testnet
            events: ["chainChanged", "accountsChanged"],
          },
        },
      });

      if (!uri) {
        throw new Error("Failed to create connection URI");
      }

      // Set up session approval handler
    approval()
      .then((session: WalletConnectSession) => {
        this.updateConnectionState({
        isConnected: true,
        isConnecting: false,
        sessionTopic: session.topic,
        account: session.namespaces.eip155?.accounts[0]?.split(":")[2],
        chainId: session.namespaces.eip155?.chains[0]?.split(":")[1],
        });
        this.emit("session_connected", session);
      })
      .catch((error: Error) => {
        this.updateConnectionState({ isConnecting: false });
        this.emit("error", error);
      });

      const qrCodeData = uri;
      this.emit("qr_generated", { uri, qrCodeData });
      return { uri, qrCodeData };
    } catch (error) {
      this.updateConnectionState({ isConnecting: false });
      this.emit("error", error);
      throw error;
    }
  }

  private onSessionEvent(event: any): void {
    console.log("Session event:", event);
  }

  private onSessionUpdate(event: any): void {
    console.log("Session update:", event);
  }




  private onSessionDelete(event: any): void {
    this.updateConnectionState({
      isConnected: false,
      isConnecting: false,
      account: undefined,
      chainId: undefined,
      sessionTopic: undefined,
    });
    this.emit("session_disconnected", event);
  }

  private onSessionExpire(event: any): void {
    this.updateConnectionState({
      isConnected: false,
      isConnecting: false,
      account: undefined,
      chainId: undefined,
      sessionTopic: undefined,
    });
    this.emit("session_expired", event);
  }

  async disconnect(): Promise<void> {
    if (!this.signClient || !this.connectionState.sessionTopic) {
      return;
    }

    try {
      await this.signClient.disconnect({
        topic: this.connectionState.sessionTopic,
        reason: getSdkError("USER_DISCONNECTED"),
      });
    } catch (error) {
      this.emit("error", error);
    }
  }

  private updateConnectionState(updates: Partial<ConnectionState>): void {
    this.connectionState = { ...this.connectionState, ...updates };
    this.emit("connection_state_changed", this.connectionState);
  }

  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  isConnected(): boolean {
    return this.connectionState.isConnected;
  }

  getAccount(): string | undefined {
    return this.connectionState.account;
  }

  getChainId(): string | undefined {
    return this.connectionState.chainId;
  }

  async sendTransaction(transaction: TransactionRequest): Promise<string> {
    if (!this.isConnected() || !this.connectionState.sessionTopic || !this.signClient) {
      throw new Error("Wallet not connected");
    }

    const from = transaction.from ?? this.connectionState.account;
    if (!from) throw new Error("No connected account for transaction");
    const tx = { ...transaction, from };
    const result = await this.signClient.request({
      topic: this.connectionState.sessionTopic,
      chainId: `eip155:${this.connectionState.chainId}`,
      request: {
        method: "eth_sendTransaction",
        params: [tx],
      },
    });

    return result as string;
  }

  async signTransaction(transaction: TransactionRequest): Promise<string> {
    if (!this.isConnected() || !this.connectionState.sessionTopic || !this.signClient) {
      throw new Error("Wallet not connected");
    }

    const from = transaction.from ?? this.connectionState.account;
    if (!from) throw new Error("No connected account for transaction");
    const tx = { ...transaction, from };
    const result = await this.signClient.request({
      topic: this.connectionState.sessionTopic,
      chainId: `eip155:${this.connectionState.chainId}`,
      request: {
        method: "eth_signTransaction",
        params: [tx],
      },
    });

    return result as string;
  }

  async personalSign(message: string, address: string): Promise<string> {
    if (!this.isConnected() || !this.connectionState.sessionTopic || !this.signClient) {
      throw new Error("Wallet not connected");
    }

    const result = await this.signClient.request({
      topic: this.connectionState.sessionTopic,
      chainId: `eip155:${this.connectionState.chainId}`,
      request: {
        method: "personal_sign",
        params: [message, address],
      },
    });

    return result as string;
  }
}
export const WALLETCONNECT_CONFIG = {
  projectId: "a5053152776b33257c03b8d693e55afa",
  metadata: {
    name: "Orbitl",
    description: "Natural language interface for Sei smart contract interaction",
    url: "https://github.com/MirageSystems/orbitl-mcp/",
    icons: ["https://walletconnect.com/walletconnect-logo.png"] // nedds to be updated 
  }
};
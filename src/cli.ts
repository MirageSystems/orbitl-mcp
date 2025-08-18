#!/usr/bin/env node

/**
 * @fileoverview Orbitl - Contract AI Assistant for Sei Network
 * Main CLI entry point with chat-first interface and MCP integration
 * @author Orbitl Team
 */

// Load environment variables from .env file
import 'dotenv/config';

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { SeiProvider, SEI_TESTNET_CONFIG, SEI_MAINNET_CONFIG } from "./network/sei.js";
import { ContractReader } from "./analysis/reader.js";
import { formatAddress } from "./analysis/types.js";
import type { ContractData, ABIFunction } from "./analysis/types.js";
import { ChatInterface } from "./interface/chat.js";
import { log } from "./utils/index.js";
import qrcode from "qrcode-terminal";
import { WalletConnect } from './wallet/wallet-connect.js';
import {WALLETCONNECT_CONFIG} from './wallet/wallet-connect.js';

const program = new Command();

// CLI Setup
program
  .name("orbitl")
  .description("🤖 Contract AI Assistant for Sei Network with recursive tool calling")
  .version("1.0.0")
  .option('-n, --network <network>', 'Network to use (mainnet|testnet)', 'mainnet')
  .option('-c, --continue', 'Continue previous conversation')
  .option('-v, --verbose', 'Show detailed analysis data')
  .hook('preAction', (thisCommand, actionCommand) => {
    // Validate network option
    const network = thisCommand.opts().network;
    if (!['mainnet', 'testnet'].includes(network)) {
      console.error(chalk.red('❌ Network must be "mainnet" or "testnet"'));
      process.exit(1);
    }
  });

// ============================================
// DIRECT COMMANDS FOR MANUAL TESTING
// ============================================

// Command: lookup - Find token contract address
program
  .command('lookup <input>')
  .description('Look up token contract address by symbol or verify address')
  .action(async (input, options, cmd) => {
    const { getTokenResolver } = await import('./config/token-resolver.js');
    
    try {
      // Get network from global option
      const network = cmd.parent?.opts().network || 'mainnet';
      const resolver = getTokenResolver(network as 'mainnet' | 'testnet');
      const token = await resolver.resolveToken(input);
      
      console.log('\n' + resolver.formatTokenInfo(token));
    } catch (error) {
      console.log(chalk.red(`\n❌ ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });

// Command: simulate - Simulate a transaction
program
  .command('simulate <type> <token> <amount>')
  .description('Simulate a transaction (transfer or approve)')
  .requiredOption('-f, --from <address>', 'From address')
  .requiredOption('-t, --to <address>', 'To address (recipient or spender)')
  .action(async (type, token, amount, options, cmd) => {
    const { TransactionSimulator } = await import('./wallet/transaction-simulator.js');
    const { SEI_MAINNET_CONFIG, SEI_TESTNET_CONFIG } = await import('./network/sei.js');
    const { getTokenResolver } = await import('./config/token-resolver.js');
    
    try {
      // Get network from global option
      const network = cmd.parent?.opts().network || 'mainnet';
      
      // Get network config
      const config = network === 'testnet' ? SEI_TESTNET_CONFIG : SEI_MAINNET_CONFIG;
      const simulator = new TransactionSimulator(config.rpcUrl);
      
      // Resolve token using centralized resolver
      const resolver = getTokenResolver(network as 'mainnet' | 'testnet');
      const tokenInfo = await resolver.resolveToken(token);
      
      console.log(chalk.blue(`\n🔍 Simulating ${type} on ${network}...`));
      
      let result;
      if (type === 'transfer') {
        result = await simulator.simulateTransfer(
          tokenInfo.address,
          options.from,
          options.to,
          amount,
          tokenInfo.symbol,
          tokenInfo.decimals
        );
      } else if (type === 'approve') {
        result = await simulator.simulateApproval(
          tokenInfo.address,
          options.from,
          options.to,
          amount,
          tokenInfo.symbol
        );
      } else {
        console.log(chalk.red(`❌ Unknown transaction type: ${type}`));
        console.log(chalk.yellow('Available types: transfer, approve'));
        return;
      }
      
      console.log(TransactionSimulator.formatSimulation(result));
    } catch (error) {
      console.log(chalk.red(`❌ ${error instanceof Error ? error.message : 'Simulation failed'}`));
    }
  });

// Command: validate - Validate an address
program
  .command('validate <address>')
  .description('Validate an Ethereum/Sei address')
  .action(async (address) => {
    const { TransactionValidator } = await import('./wallet/validator.js');
    
    const result = TransactionValidator.validateAddress(address, 'Address');
    
    if (result.isValid) {
      console.log(chalk.green(`\n✅ Valid address: ${address}`));
    } else {
      console.log(chalk.red(`\n❌ Invalid address: ${address}`));
      if (result.errors.length > 0) {
        console.log(chalk.red('\nErrors:'));
        result.errors.forEach(e => console.log(`  • ${e}`));
      }
    }
    
    if (result.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️ Warnings:'));
      result.warnings.forEach(w => console.log(`  • ${w}`));
    }
    
    if (result.suggestions.length > 0) {
      console.log(chalk.cyan('\n💡 Suggestions:'));
      result.suggestions.forEach(s => console.log(`  • ${s}`));
    }
  });

// Command: wallet - Test WalletConnect
program
  .command('wallet')
  .description('Connect wallet via WalletConnect QR code')
  .action(async () => {
    const { WalletConnectFlow } = await import('./wallet/wallet-connect-flow.js');
    
    const flow = new WalletConnectFlow();
    const result = await flow.showQRAndConnect();
    
    if (result.success) {
      console.log(chalk.green('\n✅ Wallet connected successfully!'));
    } else {
      console.log(chalk.red(`\n❌ Connection failed: ${result.error}`));
    }
  });

// Command: gas - Estimate gas for a transaction
program
  .command('gas <operation>')
  .description('Estimate gas for an operation (transfer, approve, swap)')
  .action(async (operation) => {
    const { GasEstimator } = await import('./wallet/gas-estimator.js');
    const { SEI_MAINNET_CONFIG } = await import('./network/sei.js');
    const { getTokenResolver } = await import('./config/token-resolver.js');
    
    const estimator = new GasEstimator(SEI_MAINNET_CONFIG.rpcUrl);
    
    // Build actual transaction data based on operation
    let txData;
    const resolver = getTokenResolver('mainnet'); // Use mainnet for gas estimation
    
    try {
      if (operation === 'transfer') {
        const usdc = await resolver.getTokenBySymbol('USDC');
        if (usdc) {
          txData = {
            to: usdc.address,
            data: '0xa9059cbb', // transfer function selector
            value: '0',
            gasLimit: '65000'
          };
        }
      } else if (operation === 'approve') {
        const usdc = await resolver.getTokenBySymbol('USDC');
        if (usdc) {
          txData = {
            to: usdc.address,
            data: '0x095ea7b3', // approve function selector
            value: '0',
            gasLimit: '45000'
          };
        }
      }
      
      // Fallback for unsupported operations
      if (!txData) {
        console.log(chalk.yellow(`⚠️ ${operation} operation not fully implemented for gas estimation`));
        console.log(chalk.gray('Using ERC-20 transfer estimate as fallback'));
        
        const usdc = await resolver.getTokenBySymbol('USDC');
        txData = {
          to: usdc?.address || '0xa0b86a33e6441d82f6f7f8e0dc7f2a5e9b9e2c3a',
          data: '0xa9059cbb',
          value: '0',
          gasLimit: '65000'
        };
      }
    } catch (error) {
      console.log(chalk.red(`❌ Failed to build transaction for gas estimation: ${error}`));
      return;
    }
    
    try {
      const estimate = await estimator.estimateTransaction(txData);
      
      console.log(chalk.green(`\n⛽ Gas Estimate for ${operation}:`));
      console.log(chalk.gray('─'.repeat(50)));
      console.log(`📊 Gas Limit:     ${estimate.gasLimit}`);
      console.log(`💰 Gas Price:     ${estimate.gasPrice} wei`);
      console.log(`💵 Estimated Cost: ${estimate.estimatedCost}`);
      console.log(`🎯 Confidence:    ${estimate.confidence}`);
      console.log(`🛡️ Buffer:        ${estimate.buffer}%`);
    } catch (error) {
      console.log(chalk.red(`❌ Gas estimation failed: ${error}`));
    }
  });

// Default action: Start chat interface with recursive tool calling
program.action(async (options) => {
  try {
    const chat = new ChatInterface({
      network: options.network as 'mainnet' | 'testnet',
      verbose: options.verbose
    });
    await chat.start();
  } catch (error) {
    if (error instanceof Error && error.message.includes('CLOUDFLARE')) {
      console.error(chalk.red(error.message));
      log.warn(chalk.yellow('\n💡 Set up your Cloudflare AI credentials in .env:'));
      log.info(chalk.gray('   CLOUDFLARE_API_TOKEN="your_token"'));
      log.info(chalk.gray('   CLOUDFLARE_ACCOUNT_ID="your_account_id"'));
    } else {
      console.error(chalk.red(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
    process.exit(1);
  }
});

/**
 * Analyze Command - Direct contract analysis (non-interactive)
 */
program
  .command("analyze")
  .alias("a")
  .description("Analyze a contract (non-interactive)")
  .argument("<address>", "Contract address to analyze")
  .option("-d, --detailed", "Show detailed function list")
  .action(async (address: string, options: { detailed?: boolean }, command: Command) => {
    const spinner = ora("Analyzing contract...").start();
    
    try {
      // Use global network option
      const globalOptions = command.parent?.opts() || {};
      const network = globalOptions.network || 'mainnet';
      const config = network === 'testnet' ? SEI_TESTNET_CONFIG : SEI_MAINNET_CONFIG;
      const provider = new SeiProvider(config);
      const reader = new ContractReader(provider);

      // Read and analyze contract
      const contractData = await reader.read(address);
      
      spinner.succeed("Analysis complete!");
      
      // Display results using cli-table3
      displayContractInfo(contractData, options);
      
    } catch (error) {
      spinner.fail("Analysis failed");
      
      console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      
      // Show helpful suggestions
      if (error instanceof Error) {
        if (error.message.includes("Invalid address")) {
          log.warn(chalk.yellow("\n💡 Make sure the address is in format: 0x1234..."));
        } else if (error.message.includes("not a contract")) {
          log.warn(chalk.yellow("\n💡 This address doesn't contain a contract"));
        } else if (error.message.includes("Network connection")) {
          log.warn(chalk.yellow("\n💡 Check your internet connection and try again"));
        }
      }
      
      process.exit(1);
    }
  });

/**
 * Check Command - Network connectivity test
 */
program
  .command("check")
  .alias("c")
  .description("Check connection to Sei network")
  .action(async (options: {}, command: Command) => {
    const spinner = ora("Checking network connection...").start();
    
    try {
      // Use global network option
      const globalOptions = command.parent?.opts() || {};
      const network = globalOptions.network || 'mainnet';
      const config = network === 'testnet' ? SEI_TESTNET_CONFIG : SEI_MAINNET_CONFIG;
      const provider = new SeiProvider(config);
      
      const { blockNumber, networkName } = await provider.checkConnection();
      
      spinner.succeed(`Connected to ${networkName}`);
      
      // Display connection info
      const table = new Table({
        head: [chalk.cyan("Property"), chalk.cyan("Value")]
      });
      
      table.push(
        ["Network", networkName],
        ["Chain ID", config.chainId.toString()],
        ["Latest Block", blockNumber.toString()],
        ["RPC URL", config.rpcUrl]
      );
      
      log.info("\n" + table.toString());
      
    } catch (error) {
      spinner.fail("Connection failed");
      console.error(chalk.red(`\n❌ ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

  /**
 * Connect Command - WalletConnect integration
 */
  program
  .command("connect")
  .alias("wc")
  .description("Connect to a mobile wallet via WalletConnect")
  .option("-t, --testnet", "Use Sei testnet (default is mainnet)")
  .action(async (options: { testnet?: boolean }) => {
    const spinner = ora("Initializing WalletConnect...").start();

    try {
      const wallet = new WalletConnect(WALLETCONNECT_CONFIG);

      // Initialize WalletConnect
      await wallet.initialize();
      spinner.text = "Generating connection QR code...";

      // Generate connection URI
      const { uri, qrCodeData } = await wallet.generateConnectionURI();
      spinner.succeed("QR code generated!");

      console.log(chalk.green("\n🔗 WalletConnect Session"));
      console.log(chalk.bold("Scan this QR code with your mobile wallet:"));

      qrcode.generate(uri, { small: true });

      console.log(chalk.yellow("\n📱 Or copy this URI to your wallet app:"));
      console.log(chalk.cyan(uri));

      console.log(chalk.gray("\nWaiting for wallet connection..."));

      // Set up event listeners
      let connected = false;

      wallet.on("session_connected", (session) => {
        connected = true;
        console.log(chalk.green("\n✅ Wallet Connected!"));

        const state = wallet.getConnectionState();
        const table = new Table({
          head: [chalk.cyan("Property"), chalk.cyan("Value")]
        });

        table.push(
          ["Account", state.account || "Unknown"],
          ["Chain", `Sei ${options.testnet ? 'Testnet' : 'Mainnet'}`],
          ["Status", chalk.green("Connected")]
        );

        console.log("\n" + table.toString());
        console.log(chalk.yellow("\n💡 You can now use wallet commands with --wallet flag"));
        process.exit(0);
      });

      wallet.on("error", (error) => {
        console.error(chalk.red(`\n❌ Connection error: ${error.message}`));
        process.exit(1);
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        if (!connected) {
          console.log(chalk.yellow("\n⏱️  Connection timeout"));
          console.log("Please try again or check your wallet app");
          process.exit(0);
        }
      }, 120000);

    } catch (error) {
      spinner.fail("Connection failed");
      console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

/**
 * Display contract information in nice tables
 */
function displayContractInfo(contractData: ContractData, options: { detailed?: boolean }) {
  log.info("\n" + chalk.bold.blue("📄 Contract Analysis Results"));
  
  // Basic info table
  const basicTable = new Table({
    head: [chalk.cyan("Property"), chalk.cyan("Value")]
  });
  
  basicTable.push(
    ["Address", contractData.address],
    ["Type", chalk.bold(contractData.basicType)],
    ["Verified", contractData.isVerified ? chalk.green("✓ Yes") : chalk.red("✗ No")],
    ["Functions", `${contractData.functionCount} found`],
    ["Read-Only", `${contractData.readOnlyFunctions.length} functions`],
    ["Write", `${contractData.writeFunctions.length} functions`]
  );
  
  log.info("\n" + basicTable.toString());
  
  // Show functions if detailed or if few functions
  if (options.detailed || contractData.functionCount <= 10) {
    displayFunctions(contractData.abi);
  } else {
    log.info(chalk.gray(`\n💡 Use --detailed flag to see all ${contractData.functionCount} functions`));
  }
  
  // Show type-specific info
  displayTypeSpecificInfo(contractData);
}

/**
 * Display function list in a table
 */
function displayFunctions(functions: ABIFunction[]) {
  if (functions.length === 0) {
    log.warn(chalk.yellow("\n⚠️  No functions found (unverified contract)"));
    return;
  }
  
  log.info("\n" + chalk.bold.blue("🔧 Available Functions"));
  
  const funcTable = new Table({
    head: [chalk.cyan("Function"), chalk.cyan("Description"), chalk.cyan("Type")]
  });
  
  functions.forEach(func => {
    const signature = ContractReader.formatFunctionSignature(func);
    const description = ContractReader.getFunctionDescription(func);
    const type = func.stateMutability === "view" || func.stateMutability === "pure" 
      ? chalk.gray("Read") 
      : chalk.blue("Write");
    
    funcTable.push([signature, description, type]);
  });
  
  log.info("\n" + funcTable.toString());
}

/**
 * Show type-specific information
 */
function displayTypeSpecificInfo(contractData: ContractData) {
  const { basicType, abi } = contractData;
  
  if (basicType === "Token" && contractData.isVerified) {
    log.info(chalk.green("\n💰 Token Contract Detected"));
    log.info("  • Can send/receive tokens");
    log.info("  • Check balances and allowances");
    if (abi.some(f => f.name === "decimals")) {
      log.info("  • Has decimal configuration");
    }
  } else if (basicType === "DEX" && contractData.isVerified) {
    log.info(chalk.blue("\n🔄 DEX Contract Detected"));
    log.info("  • Can swap tokens");
    if (abi.some(f => f.name.includes("Liquidity"))) {
      log.info("  • Supports liquidity operations");
    }
  } else if (basicType === "Farm" && contractData.isVerified) {
    log.info(chalk.magenta("\n🌾 Farm Contract Detected"));
    log.info("  • Can stake/deposit tokens");
    log.info("  • Earn rewards over time");
  } else if (basicType === "Unknown") {
    log.info(chalk.gray("\n❓ Unknown Contract Type"));
    if (!contractData.isVerified) {
      log.info("  • Contract not verified on explorer");
      log.info("  • Cannot determine functionality");
    }
  }
}

/**
 * Global error handlers for uncaught exceptions
 * Note: Chat interface has its own error handlers for auto-save
 */
process.on("uncaughtException", (error) => {
  console.error(chalk.red("\n💥 Unexpected error occurred:"));
  console.error(error.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error(chalk.red("\n💥 Unhandled promise rejection:"));
  console.error(reason);
  process.exit(1);
});

// Note: Removed auto-help - default action now starts chat

// Parse CLI arguments
program.parse();
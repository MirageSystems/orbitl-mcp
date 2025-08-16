#!/usr/bin/env node

// Phase 1: CLI Interface - Battle-tested implementation
// Using commander.js, cli-table3, ora, chalk

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { SeiProvider, SEI_TESTNET_CONFIG, SEI_MAINNET_CONFIG } from "../blockchain/sei-provider.js";
import { ContractReader } from "../core/contract-reader.js";
import { formatAddress } from "../types/contract.js";
import type { ContractData, ABIFunction } from "../types/contract.js";

const program = new Command();

// CLI Setup
program
  .name("orbitl")
  .description("Natural language interface for Sei smart contract interaction")
  .version("1.0.0");

/**
 * Analyze Command - Main functionality
 */
program
  .command("analyze")
  .alias("a")
  .description("Analyze a smart contract")
  .argument("<address>", "Contract address to analyze")
  .option("-t, --testnet", "Use Sei testnet (default is mainnet)")
  .option("-m, --mainnet", "Use Sei mainnet (default)")
  .option("-d, --detailed", "Show detailed function list")
  .action(async (address: string, options: { testnet?: boolean; mainnet?: boolean; detailed?: boolean }) => {
    const spinner = ora("Analyzing contract...").start();
    
    try {
      // Initialize provider based on network (mainnet is default)
      const config = options.testnet ? SEI_TESTNET_CONFIG : SEI_MAINNET_CONFIG;
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
          console.log(chalk.yellow("\n💡 Make sure the address is in format: 0x1234..."));
        } else if (error.message.includes("not a contract")) {
          console.log(chalk.yellow("\n💡 This address doesn't contain a smart contract"));
        } else if (error.message.includes("Network connection")) {
          console.log(chalk.yellow("\n💡 Check your internet connection and try again"));
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
  .option("-t, --testnet", "Check testnet connection (default is mainnet)")
  .option("-m, --mainnet", "Check mainnet connection (default)")
  .action(async (options: { testnet?: boolean; mainnet?: boolean }) => {
    const spinner = ora("Checking network connection...").start();
    
    try {
      const config = options.testnet ? SEI_TESTNET_CONFIG : SEI_MAINNET_CONFIG;
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
      
      console.log("\n" + table.toString());
      
    } catch (error) {
      spinner.fail("Connection failed");
      console.error(chalk.red(`\n❌ ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

/**
 * Display contract information in nice tables
 */
function displayContractInfo(contractData: ContractData, options: { detailed?: boolean }) {
  console.log("\n" + chalk.bold.blue("📄 Contract Analysis Results"));
  
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
  
  console.log("\n" + basicTable.toString());
  
  // Show functions if detailed or if few functions
  if (options.detailed || contractData.functionCount <= 10) {
    displayFunctions(contractData.abi);
  } else {
    console.log(chalk.gray(`\n💡 Use --detailed flag to see all ${contractData.functionCount} functions`));
  }
  
  // Show type-specific info
  displayTypeSpecificInfo(contractData);
}

/**
 * Display function list in a table
 */
function displayFunctions(functions: ABIFunction[]) {
  if (functions.length === 0) {
    console.log(chalk.yellow("\n⚠️  No functions found (unverified contract)"));
    return;
  }
  
  console.log("\n" + chalk.bold.blue("🔧 Available Functions"));
  
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
  
  console.log("\n" + funcTable.toString());
}

/**
 * Show type-specific information
 */
function displayTypeSpecificInfo(contractData: ContractData) {
  const { basicType, abi } = contractData;
  
  if (basicType === "Token" && contractData.isVerified) {
    console.log(chalk.green("\n💰 Token Contract Detected"));
    console.log("  • Can send/receive tokens");
    console.log("  • Check balances and allowances");
    if (abi.some(f => f.name === "decimals")) {
      console.log("  • Has decimal configuration");
    }
  } else if (basicType === "DEX" && contractData.isVerified) {
    console.log(chalk.blue("\n🔄 DEX Contract Detected"));
    console.log("  • Can swap tokens");
    if (abi.some(f => f.name.includes("Liquidity"))) {
      console.log("  • Supports liquidity operations");
    }
  } else if (basicType === "Farm" && contractData.isVerified) {
    console.log(chalk.magenta("\n🌾 Farm Contract Detected"));
    console.log("  • Can stake/deposit tokens");
    console.log("  • Earn rewards over time");
  } else if (basicType === "Unknown") {
    console.log(chalk.gray("\n❓ Unknown Contract Type"));
    if (!contractData.isVerified) {
      console.log("  • Contract not verified on explorer");
      console.log("  • Cannot determine functionality");
    }
  }
}

// Global error handlers
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

// Show help if no arguments provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
  process.exit(0); // Exit gracefully
}

// Parse CLI arguments
program.parse();
/**
 * @fileoverview Industry-standard logging with Winston
 * Configurable log levels via LOG_LEVEL environment variable
 */

import winston from 'winston';
import chalk from 'chalk';

// Custom format for console output with colors
const consoleFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const ts = new Date(timestamp as string).toLocaleTimeString();
  
  // Color-code log levels
  const coloredLevel = {
    'error': chalk.red('ERROR'),
    'warn': chalk.yellow('WARN'),
    'info': chalk.blue('INFO'),
    'debug': chalk.gray('DEBUG'),
    'silly': chalk.magenta('TRACE')
  }[level] || level.toUpperCase();

  let output = `${chalk.gray(`[${ts}]`)} ${coloredLevel} ${message}`;
  
  // Add metadata if present
  if (Object.keys(meta).length > 0) {
    output += `\n${chalk.gray(JSON.stringify(meta, null, 2))}`;
  }
  
  return output;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // Default to 'info', can be overridden
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  transports: [
    // Console transport with colors
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: false }), // We handle colors manually
        consoleFormat
      )
    })
  ]
});

// Add file logging in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/orbitl-error.log',
    level: 'error',
    format: winston.format.json()
  }));
  
  logger.add(new winston.transports.File({
    filename: 'logs/orbitl-combined.log',
    format: winston.format.json()
  }));
}

// Convenience methods with context
export const log = {
  error: (message: string, meta?: any) => logger.error(message, meta),
  warn: (message: string, meta?: any) => logger.warn(message, meta),
  info: (message: string, meta?: any) => logger.info(message, meta),
  debug: (message: string, meta?: any) => logger.debug(message, meta),
  trace: (message: string, meta?: any) => logger.silly(message, meta),
  
  // Specialized logging methods
  ai: {
    request: (url: string, model: string, toolCount: number) => 
      logger.debug('🤖 AI Request', { url, model, toolCount }),
    response: (hasTools: boolean, responseLength: number) => 
      logger.debug('🤖 AI Response', { hasTools, responseLength }),
    toolCall: (toolName: string, args: any) => 
      logger.debug('🔧 Tool Call', { toolName, args }),
    toolResult: (toolName: string, success: boolean, result: any) => 
      logger.debug('🔧 Tool Result', { toolName, success, result }),
    recursion: (depth: number, maxDepth: number) => 
      logger.debug('🔄 Recursion', { depth, maxDepth })
  },
  
  contract: {
    analyzing: (address: string, network: string) => 
      logger.info('📊 Analyzing Contract', { address, network }),
    analyzed: (address: string, type: string, functionCount: number, verified: boolean) => 
      logger.info('📊 Contract Analyzed', { address, type, functionCount, verified }),
    error: (address: string, error: string) => 
      logger.error('📊 Contract Analysis Failed', { address, error })
  },
  
  chat: {
    userMessage: (message: string) => 
      logger.info('💬 User Message', { message: message.slice(0, 100) + '...' }),
    aiResponse: (response: string) => 
      logger.info('🤖 AI Response', { response: response.slice(0, 100) + '...' }),
    error: (error: string) => 
      logger.error('💬 Chat Error', { error })
  }
};

// Export raw logger for advanced use
export { logger };

// Log startup info
logger.info(`🚀 Orbitl Logger initialized with level: ${logger.level.toUpperCase()}`);

export default log;
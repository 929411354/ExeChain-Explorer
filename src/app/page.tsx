'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationEllipsis,
} from '@/components/ui/pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Search, Copy, Check, ChevronDown, Fuel, Box, ArrowLeftRight, Clock,
  Home, Blocks, FileText, Activity, ArrowRight, ExternalLink, Menu, X,
  Cuboid, Hash, Wallet, Cpu, Zap, TrendingUp, CircleDot, AlertCircle,
  ShieldCheck, FileCode2, Loader2, Code2, Coins, Image, Trophy, ScrollText,
  BookOpen, PenTool, Landmark, Wrench, Play, Binary, RefreshCw, BarChart3,
  Timer, Send, ArrowUpDown, RotateCcw,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

// ============================================================================
// CONSTANTS
// ============================================================================
const RPC_URL = 'https://rpc.exepc.top';
const CHAIN_ID = 8848;
const CHAIN_NAME = 'ExeChain';
const NATIVE_TOKEN = 'EXE';
const BLOCK_TIME_MS = 5000;
const EXE_PRICE = 1.0;
const TOTAL_SUPPLY_EXE = 100_000_000;

// ERC-20 function selectors
const ERC20_NAME_SIG = '0x06fdde03';
const ERC20_SYMBOL_SIG = '0x95d89b41';
const ERC20_DECIMALS_SIG = '0x313ce567';
const ERC20_TOTALSUPPLY_SIG = '0x18160ddd';
const ERC20_BALANCEOF_SIG = '0x70a08231';
const ERC20_APPROVE_SIG = '0x095ea7b3';
const ERC20_TRANSFER_SIG = '0xa9059cbb';
const ERC20_TRANSFERFROM_SIG = '0x23b872dd';

// ERC-721
const ERC721_INTERFACE_ID = '0x80ac58cd';
const ERC721_SUPPORTSINTERFACE_SIG = '0x01ffc9a7';
const ERC721_TOKENURI_SIG = '0xc87b56dd';
const ERC721_TOKENOFOWNERBYINDEX_SIG = '0x7f583870';
const ERC721_TOKENBYINDEX_SIG = '0x4f6ccce7';
const ERC721_BALANCEOF_SIG = '0x70a08231';

// Event topic hashes
const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const APPROVAL_EVENT_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

// Known method signatures for decoding
const KNOWN_METHODS: Record<string, string> = {
  '0xa9059cbb': 'transfer',
  '0x095ea7b3': 'approve',
  '0x23b872dd': 'transferFrom',
  '0x38ed1739': 'swap',
  '0x7ff36ab5': 'swapExactETHForTokens',
  '0x18cbafe5': 'swapExactTokensForTokens',
  '0xe8e33700': 'addLiquidity',
  '0xf305d719': 'addLiquidityETH',
  '0x2e1a7d4d': 'withdraw',
  '0xd0e30db0': 'deposit',
  '0x06fdde03': 'name',
  '0x95d89b41': 'symbol',
  '0x313ce567': 'decimals',
  '0x18160ddd': 'totalSupply',
  '0x70a08231': 'balanceOf',
  '0x01ffc9a7': 'supportsInterface',
  '0xc87b56dd': 'tokenURI',
  '0x7f583870': 'tokenOfOwnerByIndex',
  '0x4f6ccce7': 'tokenByIndex',
  '0xdd62ed3e': 'allowance',
  '0x39509351': 'increaseAllowance',
  '0xa457c2d7': 'decreaseAllowance',
  '0x40c10f19': 'mint',
  '0x42966c68': 'burn',
  '0xa217fddf': 'DEFAULT_ADMIN_ROLE',
};

const KNOWN_EVENTS: Record<string, string> = {
  [TRANSFER_EVENT_TOPIC]: 'Transfer',
  [APPROVAL_EVENT_TOPIC]: 'Approval',
  '0x8be0079ec52a0e4aaa5704b130ded37188b5407e0e9e45c21c8b8d82f55e3460': 'OwnershipTransferred',
  '0x34fcbac00c1b92bc68e7ef0a71e0e4e9106bb8b1c5c0c886c4a4b9e4c78b2b8c': 'Paused',
  '0x5c975abb2ef2272708b0c9ee82187b1d34b56bb8ee085081782564b4b6b9ee6ac': 'Unpaused',
};

// EVM Opcode lookup table
const EVM_OPCODES: Record<number, { name: string; pushSize?: number; input: number; output: number }> = {
  0x00: { name: 'STOP', input: 0, output: 0 },
  0x01: { name: 'ADD', input: 2, output: 1 },
  0x02: { name: 'MUL', input: 2, output: 1 },
  0x03: { name: 'SUB', input: 2, output: 1 },
  0x04: { name: 'DIV', input: 2, output: 1 },
  0x05: { name: 'SDIV', input: 2, output: 1 },
  0x06: { name: 'MOD', input: 2, output: 1 },
  0x07: { name: 'SMOD', input: 2, output: 1 },
  0x08: { name: 'ADDMOD', input: 3, output: 1 },
  0x09: { name: 'MULMOD', input: 3, output: 1 },
  0x0a: { name: 'EXP', input: 2, output: 1 },
  0x0b: { name: 'SIGNEXTEND', input: 2, output: 1 },
  0x10: { name: 'LT', input: 2, output: 1 },
  0x11: { name: 'GT', input: 2, output: 1 },
  0x12: { name: 'SLT', input: 2, output: 1 },
  0x13: { name: 'SGT', input: 2, output: 1 },
  0x14: { name: 'EQ', input: 2, output: 1 },
  0x15: { name: 'ISZERO', input: 1, output: 1 },
  0x16: { name: 'AND', input: 2, output: 1 },
  0x17: { name: 'OR', input: 2, output: 1 },
  0x18: { name: 'XOR', input: 2, output: 1 },
  0x19: { name: 'NOT', input: 1, output: 1 },
  0x1a: { name: 'BYTE', input: 2, output: 1 },
  0x1b: { name: 'SHL', input: 2, output: 1 },
  0x1c: { name: 'SHR', input: 2, output: 1 },
  0x1d: { name: 'SAR', input: 2, output: 1 },
  0x20: { name: 'SHA3', input: 2, output: 1 },
  0x30: { name: 'ADDRESS', input: 0, output: 1 },
  0x31: { name: 'BALANCE', input: 1, output: 1 },
  0x32: { name: 'ORIGIN', input: 0, output: 1 },
  0x33: { name: 'CALLER', input: 0, output: 1 },
  0x34: { name: 'CALLVALUE', input: 0, output: 1 },
  0x35: { name: 'CALLDATALOAD', input: 1, output: 1 },
  0x36: { name: 'CALLDATASIZE', input: 0, output: 1 },
  0x37: { name: 'CALLDATACOPY', input: 3, output: 0 },
  0x38: { name: 'CODESIZE', input: 0, output: 1 },
  0x39: { name: 'CODECOPY', input: 3, output: 0 },
  0x3a: { name: 'GASPRICE', input: 0, output: 1 },
  0x3b: { name: 'EXTCODESIZE', input: 1, output: 1 },
  0x3c: { name: 'EXTCODECOPY', input: 4, output: 0 },
  0x3d: { name: 'RETURNDATASIZE', input: 0, output: 1 },
  0x3e: { name: 'RETURNDATACOPY', input: 3, output: 0 },
  0x40: { name: 'BLOCKHASH', input: 1, output: 1 },
  0x41: { name: 'COINBASE', input: 0, output: 1 },
  0x42: { name: 'TIMESTAMP', input: 0, output: 1 },
  0x43: { name: 'NUMBER', input: 0, output: 1 },
  0x44: { name: 'DIFFICULTY', input: 0, output: 1 },
  0x45: { name: 'GASLIMIT', input: 0, output: 1 },
  0x46: { name: 'CHAINID', input: 0, output: 1 },
  0x47: { name: 'SELFBALANCE', input: 0, output: 1 },
  0x48: { name: 'BASEFEE', input: 0, output: 1 },
  0x50: { name: 'POP', input: 1, output: 0 },
  0x51: { name: 'MLOAD', input: 1, output: 1 },
  0x52: { name: 'MSTORE', input: 2, output: 0 },
  0x53: { name: 'MSTORE8', input: 2, output: 0 },
  0x54: { name: 'SLOAD', input: 1, output: 1 },
  0x55: { name: 'SSTORE', input: 2, output: 0 },
  0x56: { name: 'JUMP', input: 1, output: 0 },
  0x57: { name: 'JUMPI', input: 2, output: 0 },
  0x58: { name: 'PC', input: 0, output: 1 },
  0x59: { name: 'MSIZE', input: 0, output: 1 },
  0x5a: { name: 'GAS', input: 0, output: 1 },
  0x5b: { name: 'JUMPDEST', input: 0, output: 0 },
  0x5f: { name: 'PUSH0', input: 0, output: 1 },
  0xf0: { name: 'CREATE', input: 3, output: 1 },
  0xf1: { name: 'CALL', input: 7, output: 1 },
  0xf2: { name: 'CALLCODE', input: 7, output: 1 },
  0xf3: { name: 'RETURN', input: 2, output: 0 },
  0xf4: { name: 'DELEGATECALL', input: 6, output: 1 },
  0xf5: { name: 'CREATE2', input: 4, output: 1 },
  0xfa: { name: 'STATICCALL', input: 6, output: 1 },
  0xfd: { name: 'REVERT', input: 2, output: 0 },
  0xfe: { name: 'INVALID', input: 0, output: 0 },
  0xff: { name: 'SELFDESTRUCT', input: 1, output: 0 },
};
// Generate PUSH1-PUSH32 entries
for (let i = 1; i <= 32; i++) {
  EVM_OPCODES[0x5f + i] = { name: `PUSH${i}`, pushSize: i, input: 0, output: 1 };
}
// Generate DUP1-DUP16 entries
for (let i = 1; i <= 16; i++) {
  EVM_OPCODES[0x7f + i] = { name: `DUP${i}`, input: i, output: i + 1 };
}
// Generate SWAP1-SWAP16 entries
for (let i = 1; i <= 16; i++) {
  EVM_OPCODES[0x8f + i] = { name: `SWAP${i}`, input: i + 1, output: i + 1 };
}
// Generate LOG0-LOG4 entries
for (let i = 0; i <= 4; i++) {
  EVM_OPCODES[0xa0 + i] = { name: `LOG${i}`, input: i + 2, output: 0 };
}

function disassembleBytecode(bytecode: string): { offset: number; opcode: string; operand: string }[] {
  const clean = bytecode.replace(/^0x/, '');
  const result: { offset: number; opcode: string; operand: string }[] = [];
  let i = 0;
  while (i < clean.length) {
    const byte = parseInt(clean.slice(i, i + 2), 16);
    const offset = i / 2;
    const op = EVM_OPCODES[byte];
    if (!op) {
      result.push({ offset, opcode: `UNKNOWN(0x${byte.toString(16).padStart(2, '0')})`, operand: '' });
      i += 2;
      continue;
    }
    if (op.pushSize !== undefined) {
      const operandHex = clean.slice(i + 2, i + 2 + op.pushSize * 2);
      result.push({ offset, opcode: op.name, operand: operandHex ? `0x${operandHex}` : '' });
      i += 2 + op.pushSize * 2;
    } else {
      result.push({ offset, opcode: op.name, operand: '' });
      i += 2;
    }
  }
  return result;
}

// ============================================================================
// RPC UTILITIES
// ============================================================================
async function rpcCall(method: string, params: unknown[] = []) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: Date.now() + Math.random() }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || 'RPC Error');
  return json.result;
}

function hexToNumber(hex: string): number {
  if (!hex || hex === '0x') return 0;
  return parseInt(hex, 16);
}

function hexToBigInt(hex: string): bigint {
  if (!hex || hex === '0x') return 0n;
  return BigInt(hex);
}

async function ethCall(to: string, data: string): Promise<string> {
  return rpcCall('eth_call', [{ to, data }, 'latest']);
}

// ============================================================================
// LOCALSTORAGE HELPERS
// ============================================================================
const LS_KEY = 'exechain_verified_contracts';
const LS_TOKENS_KEY = 'exechain_discovered_tokens';
const LS_NFTS_KEY = 'exechain_discovered_nfts';

interface VerifiedContractData {
  address: string;
  name: string;
  compiler: string;
  version: string;
  optimization: number;
  sourceCode: string;
  abi: unknown;
  bytecode: string;
  constructorArguments: string | null;
  createdAt: string;
}

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  holderCount: number;
  discoveredAt: string;
  type: 'ERC20' | 'ERC721';
}

interface NFTCollectionInfo {
  address: string;
  name: string;
  symbol: string;
  tokenCount: number;
  discoveredAt: string;
}

function getVerifiedContracts(): Record<string, VerifiedContractData> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function getVerifiedContract(address: string): VerifiedContractData | null {
  const contracts = getVerifiedContracts();
  return contracts[address.toLowerCase()] || null;
}

function saveVerifiedContract(data: VerifiedContractData): void {
  const contracts = getVerifiedContracts();
  contracts[data.address.toLowerCase()] = data;
  localStorage.setItem(LS_KEY, JSON.stringify(contracts));
}

function getDiscoveredTokens(): Record<string, TokenInfo> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_TOKENS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveDiscoveredToken(token: TokenInfo): void {
  const tokens = getDiscoveredTokens();
  tokens[token.address.toLowerCase()] = token;
  localStorage.setItem(LS_TOKENS_KEY, JSON.stringify(tokens));
}

function getDiscoveredNFTs(): Record<string, NFTCollectionInfo> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(LS_NFTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveDiscoveredNFT(nft: NFTCollectionInfo): void {
  const nfts = getDiscoveredNFTs();
  nfts[nft.address.toLowerCase()] = nft;
  localStorage.setItem(LS_NFTS_KEY, JSON.stringify(nfts));
}

function normalizeBytecode(code: string): string {
  if (!code || code === '0x') return '';
  return code.replace(/__\$[a-fA-F0-9]{34}\$__\$/g, '0'.repeat(40));
}

// ============================================================================
// SOLC CDN LOADER
// ============================================================================
const solcCache: Record<string, unknown> = {};

async function loadSolc(version: string): Promise<(input: string) => string> {
  if (solcCache[version]) return solcCache[version] as (input: string) => string;

  return new Promise((resolve, reject) => {
    try {
      const script = document.createElement('script');
      script.src = `https://binaries.soliditylang.org/bin/soljson-${version}.js`;
      script.onload = () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const solcInstance = (window as any)[`soljson-${version}`];
          if (!solcInstance) {
            reject(new Error(`Failed to load solc ${version}`));
            return;
          }
          const compiler = solcInstance.cwrap
            ? (input: string) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const solcMod = (window as any)[`soljson-${version}`];
                const inputStr = JSON.stringify({ ...JSON.parse(input) });
                const ret = solcMod.cwrap('compile', 'string', 'string, number')(inputStr, 0);
                return ret;
              }
            : solcInstance;
          solcCache[version] = compiler;
          resolve(compiler);
        } catch (e) {
          reject(e);
        }
      };
      script.onerror = () => reject(new Error(`Failed to load solc ${version} from CDN`));
      document.head.appendChild(script);
    } catch (e) {
      reject(e);
    }
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
function weiToExe(wei: bigint | string): string {
  const value = typeof wei === 'string' ? BigInt(wei) : wei;
  const divisor = 10n ** 18n;
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  if (fractionalPart === 0n) return integerPart.toLocaleString();
  const fractionalStr = fractionalPart.toString().padStart(18, '0').replace(/0+$/, '').slice(0, 6);
  const intFormatted = integerPart.toLocaleString();
  return `${intFormatted}.${fractionalStr}`;
}

function weiToGwei(wei: string | bigint): string {
  const value = typeof wei === 'string' ? BigInt(wei) : wei;
  return (Number(value) / 1e9).toFixed(2);
}

function shortHash(hash: string, start = 10, end = 6): string {
  if (!hash || hash === '0x') return '--';
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
}

function timeAgo(timestampMs: number): string {
  const seconds = Math.floor(Date.now() / 1000) - Math.floor(timestampMs / 1000);
  if (seconds < 5) return `${seconds} secs ago`;
  if (seconds < 60) return `${seconds} secs ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString();
}

function formatTokenBalance(rawValue: string, decimals: number): string {
  if (!rawValue || rawValue === '0x' || rawValue === '0x0') return '0';
  const value = BigInt(rawValue);
  if (decimals === 0) return value.toLocaleString();
  const divisor = 10n ** BigInt(decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  if (fractionalPart === 0n) return integerPart.toLocaleString();
  const fracStr = fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '').slice(0, 6);
  return `${integerPart.toLocaleString()}.${fracStr}`;
}

function hexToAscii(hex: string): string {
  if (!hex || hex === '0x') return '';
  try {
    const bytes = (hex.startsWith('0x') ? hex.slice(2) : hex).match(/.{1,2}/g) || [];
    return bytes.map((b) => String.fromCharCode(parseInt(b, 16))).join('').replace(/\0+$/, '');
  } catch {
    return '';
  }
}

function parseSearchInput(input: string): string {
  const trimmed = input.trim();
  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
    return trimmed.startsWith('0x') && trimmed.length === 66 ? trimmed : trimmed;
  }
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return trimmed;
  return trimmed;
}

function detectSearchType(input: string): 'block' | 'tx' | 'address' | 'unknown' {
  const trimmed = input.trim();
  if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) return 'tx';
  if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return 'address';
  if (/^\d+$/.test(trimmed)) return 'block';
  return 'unknown';
}


function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => { /* ignore */ });
}

function topicToAddress(topic: string): string {
  if (!topic || topic === '0x') return '0x0000000000000000000000000000000000000000';
  const padded = topic.replace('0x', '').padStart(64, '0');
  return '0x' + padded.slice(24);
}

function getGradientFromAddress(address: string): string {
  const h1 = parseInt(address.slice(2, 6), 16) % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 70%, 55%), hsl(${h2}, 80%, 45%))`;
}

// ============================================================================
// TOKEN / NFT DETECTION FUNCTIONS
// ============================================================================
async function detectToken(address: string): Promise<TokenInfo | null> {
  try {
    const code = await rpcCall('eth_getCode', [address, 'latest']);
    if (!code || code === '0x' || code === '0x0') return null;

    const [nameHex, symbolHex, decimalsHex, totalSupplyHex] = await Promise.all([
      ethCall(address, ERC20_NAME_SIG).catch(() => null),
      ethCall(address, ERC20_SYMBOL_SIG).catch(() => null),
      ethCall(address, ERC20_DECIMALS_SIG).catch(() => null),
      ethCall(address, ERC20_TOTALSUPPLY_SIG).catch(() => null),
    ]);

    if (!nameHex && !symbolHex) return null;

    const name = hexToAscii(nameHex || '0x');
    const symbol = hexToAscii(symbolHex || '0x');
    if (!name && !symbol) return null;

    const decimals = decimalsHex ? hexToNumber(decimalsHex) : 18;
    const totalSupply = totalSupplyHex || '0x0';

    // Check if ERC-721
    const paddedInterfaceId = '0x' + ERC721_INTERFACE_ID.slice(2).padStart(64, '0');
    let isERC721 = false;
    try {
      const result = await ethCall(address, ERC721_SUPPORTSINTERFACE_SIG + paddedInterfaceId.slice(2));
      if (result && result !== '0x' && result.length >= 66) {
        const lastByte = result.slice(result.length - 2);
        if (parseInt(lastByte, 16) === 1) isERC721 = true;
      }
    } catch { /* not ERC-721 */ }

    const token: TokenInfo = {
      address,
      name: name || 'Unknown Token',
      symbol: symbol || '???',
      decimals: isERC721 ? 0 : decimals,
      totalSupply,
      holderCount: 0,
      discoveredAt: new Date().toISOString(),
      type: isERC721 ? 'ERC721' : 'ERC20',
    };

    // Save to localStorage
    saveDiscoveredToken(token);
    return token;
  } catch {
    return null;
  }
}

async function getTokenBalance(tokenAddress: string, walletAddress: string, decimals: number): Promise<string> {
  try {
    const paddedAddress = '0x' + walletAddress.replace('0x', '').padStart(64, '0');
    const result = await ethCall(tokenAddress, ERC20_BALANCEOF_SIG + paddedAddress.slice(2));
    return formatTokenBalance(result, decimals);
  } catch {
    return '0';
  }
}

interface RpcLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  logIndex: string;
  removed: boolean;
}

interface DecodedEvent {
  name: string;
  contract: string;
  topics: string[];
  params: { name: string; value: string; type: string }[];
  raw: RpcLog;
}

function decodeLogs(logs: unknown[], knownTokens?: Record<string, TokenInfo>): DecodedEvent[] {
  const decoded: DecodedEvent[] = [];
  if (!logs || !Array.isArray(logs)) return decoded;

  for (const log of logs) {
    const l = log as RpcLog;
    if (!l || !l.topics || !l.topics[0]) continue;

    const topic0 = l.topics[0];
    const eventName = KNOWN_EVENTS[topic0];
    const tokenInfo = knownTokens?.[l.address?.toLowerCase()];
    const contractLabel = tokenInfo ? `${tokenInfo.name} (${shortHash(l.address)})` : shortHash(l.address);
    const params: { name: string; value: string; type: string }[] = [];

    if (topic0 === TRANSFER_EVENT_TOPIC) {
      const from = topicToAddress(l.topics[1] || '');
      const to = topicToAddress(l.topics[2] || '');
      params.push({ name: 'from', value: from, type: 'address' });
      params.push({ name: 'to', value: to, type: 'address' });

      if (l.data && l.data !== '0x' && l.data.length > 2) {
        if (tokenInfo && tokenInfo.type === 'ERC20') {
          params.push({ name: 'value', value: formatTokenBalance(l.data, tokenInfo.decimals) + ` ${tokenInfo.symbol}`, type: 'uint256' });
        } else if (tokenInfo && tokenInfo.type === 'ERC721') {
          const tokenId = BigInt(l.data).toString();
          params.push({ name: 'tokenId', value: tokenId, type: 'uint256' });
        } else {
          params.push({ name: 'value', value: l.data, type: 'uint256' });
        }
      }

      decoded.push({
        name: eventName || 'Transfer',
        contract: l.address,
        topics: l.topics,
        params,
        raw: l,
      });
    } else if (topic0 === APPROVAL_EVENT_TOPIC) {
      const owner = topicToAddress(l.topics[1] || '');
      const spender = topicToAddress(l.topics[2] || '');
      params.push({ name: 'owner', value: owner, type: 'address' });
      params.push({ name: 'spender', value: spender, type: 'address' });
      if (l.data && l.data !== '0x') {
        params.push({ name: 'value', value: l.data, type: 'uint256' });
      }
      decoded.push({ name: 'Approval', contract: l.address, topics: l.topics, params, raw: l });
    } else {
      decoded.push({
        name: eventName || `Event(${topic0.slice(0, 10)}...)`,
        contract: l.address,
        topics: l.topics,
        params: [],
        raw: l,
      });
    }
  }
  return decoded;
}

function decodeInputData(input: string, abi: unknown): { method: string; params: { name: string; value: string; type: string }[] } {
  if (!input || input === '0x' || input.length < 10) return { method: '', params: [] };

  const sig = input.slice(0, 10);
  const data = input.slice(10);
  const methodName = KNOWN_METHODS[sig] || sig;

  const params: { name: string; value: string; type: string }[] = [];

  // Try to decode known methods
  if (sig === ERC20_TRANSFER_SIG || sig === ERC20_APPROVE_SIG || sig === ERC20_TRANSFERFROM_SIG || sig === ERC20_BALANCEOF_SIG) {
    const names = sig === ERC20_BALANCEOF_SIG ? ['address'] : sig === ERC20_TRANSFERFROM_SIG ? ['from', 'to', 'value'] : ['address', 'value'];
    for (let i = 0; i < names.length; i++) {
      const chunk = data.slice(i * 64, (i + 1) * 64);
      if (chunk.length === 64) {
        if (names[i] === 'address') {
          params.push({ name: names[i], value: topicToAddress('0x' + chunk), type: 'address' });
        } else {
          params.push({ name: names[i], value: BigInt('0x' + chunk).toString(), type: 'uint256' });
        }
      }
    }
  }

  return { method: methodName, params };
}

// ============================================================================
// TYPES
// ============================================================================
interface RpcBlock {
  number: string;
  hash: string;
  parentHash: string;
  nonce: string | null;
  sha3Uncles: string;
  logsBloom: string | null;
  transactionsRoot: string;
  stateRoot: string;
  receiptsRoot: string;
  miner: string;
  difficulty: string;
  totalDifficulty: string;
  extraData: string;
  size: string;
  gasLimit: string;
  gasUsed: string;
  timestamp: string;
  transactions: string[];
  uncles: string[];
  mixHash?: string;
  baseFeePerGas?: string;
}

interface RpcTransaction {
  hash: string;
  nonce: string;
  blockHash: string;
  blockNumber: string | null;
  transactionIndex: string | null;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  gasPrice: string;
  input: string;
  v: string;
  r: string;
  s: string;
  type?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  chainId?: string;
}

interface RpcReceipt {
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  blockNumber: string;
  from: string;
  to: string | null;
  cumulativeGasUsed: string;
  gasUsed: string;
  contractAddress: string | null;
  logs: RpcLog[];
  logsBloom: string;
  status: string;
  effectiveGasPrice: string;
  type: string;
}

interface BlockRow {
  number: number;
  hash: string;
  timestamp: number;
  miner: string;
  txCount: number;
  gasUsed: number;
  gasLimit: number;
  size: number;
  baseFeePerGas?: string;
  reward?: string;
}

interface TxRow {
  hash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gas: string;
  gasUsed: string;
  nonce: number;
  method: string;
  status: 'success' | 'failed';
  fee: string;
  type: string;
}

// ABI item for contract interaction
interface AbiItem {
  type: string;
  name: string;
  inputs: { name: string; type: string }[];
  outputs?: { name: string; type: string }[];
  stateMutability?: string;
  constant?: boolean;
  payable?: boolean;
}

// ============================================================================
// DATA FETCHING HOOKS
// ============================================================================
function useLatestBlockNumber() {
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchBlockNumber = async () => {
      try {
        const hex = await rpcCall('eth_blockNumber');
        if (mounted) {
          setBlockNumber(hexToNumber(hex));
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };
    fetchBlockNumber();
    const interval = setInterval(fetchBlockNumber, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return { blockNumber, loading };
}

function useBlock(blockNumber: number | null) {
  const [block, setBlock] = useState<RpcBlock | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (blockNumber === null) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    rpcCall('eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, false])
      .then((data) => {
        if (mounted) {
          if (!data) setError('Block not found');
          setBlock(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (mounted) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => { mounted = false; };
  }, [blockNumber]);

  return { block, loading, error };
}

function useReceipts(txHashes: string[]) {
  const [receipts, setReceipts] = useState<Map<string, RpcReceipt>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (txHashes.length === 0) return;
    let mounted = true;
    setLoading(true);
    const promises = txHashes.map(async (hash) => {
      try {
        const receipt = await rpcCall('eth_getTransactionReceipt', [hash]);
        return { hash, receipt };
      } catch {
        return { hash, receipt: null };
      }
    });
    Promise.all(promises).then((results) => {
      if (mounted) {
        const map = new Map<string, RpcReceipt>();
        for (const r of results) {
          if (r.receipt) map.set(r.hash, r.receipt);
        }
        setReceipts(map);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [txHashes]);

  return { receipts, loading };
}

function useTransactions(txHashes: string[]) {
  const [transactions, setTransactions] = useState<Map<string, RpcTransaction>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (txHashes.length === 0) return;
    let mounted = true;
    setLoading(true);
    const promises = txHashes.map(async (hash) => {
      try {
        const tx = await rpcCall('eth_getTransactionByHash', [hash]);
        return { hash, tx };
      } catch {
        return { hash, tx: null };
      }
    });
    Promise.all(promises).then((results) => {
      if (mounted) {
        const map = new Map<string, RpcTransaction>();
        for (const r of results) {
          if (r.tx) map.set(r.hash, r.tx);
        }
        setTransactions(map);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [txHashes]);

  return { transactions, loading };
}

function useTransaction(hash: string | null) {
  const [tx, setTx] = useState<RpcTransaction | null>(null);
  const [receipt, setReceipt] = useState<RpcReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hash) return;
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      rpcCall('eth_getTransactionByHash', [hash]),
      rpcCall('eth_getTransactionReceipt', [hash]),
    ])
      .then(([txData, receiptData]) => {
        if (mounted) {
          if (!txData) setError('Transaction not found');
          setTx(txData);
          setReceipt(receiptData);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (mounted) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => { mounted = false; };
  }, [hash]);

  return { tx, receipt, loading, error };
}

function useAddress(address: string | null) {
  const [balance, setBalance] = useState<string | null>(null);
  const [txCount, setTxCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      rpcCall('eth_getBalance', [address, 'latest']),
      rpcCall('eth_getTransactionCount', [address, 'latest']),
    ])
      .then(([bal, count]) => {
        if (mounted) {
          setBalance(bal);
          setTxCount(hexToNumber(count));
          setLoading(false);
        }
      })
      .catch((e) => {
        if (mounted) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => { mounted = false; };
  }, [address]);

  return { balance, txCount, loading, error };
}

// ============================================================================
// BATCH BLOCKS FETCHER
// ============================================================================
async function fetchBlocksRange(startBlock: number, count: number): Promise<BlockRow[]> {
  const hexNumbers = Array.from({ length: count }, (_, i) =>
    `0x${(startBlock - i).toString(16)}`
  );
  const promises = hexNumbers.map((hex) =>
    rpcCall('eth_getBlockByNumber', [hex, false]).catch(() => null)
  );
  const blocks = await Promise.all(promises);
  return blocks
    .filter((b): b is RpcBlock => b !== null)
    .map((b) => ({
      number: hexToNumber(b.number),
      hash: b.hash,
      timestamp: hexToNumber(b.timestamp) * 1000,
      miner: b.miner,
      txCount: b.transactions.length,
      gasUsed: hexToNumber(b.gasUsed),
      gasLimit: hexToNumber(b.gasLimit),
      size: hexToNumber(b.size),
      baseFeePerGas: b.baseFeePerGas,
    }));
}

async function fetchLatestBlocks(count: number): Promise<BlockRow[]> {
  const latestHex = await rpcCall('eth_blockNumber');
  const latestBlock = hexToNumber(latestHex);
  return fetchBlocksRange(latestBlock, count);
}

// ============================================================================
// BUILD TX ROW FROM RPC DATA
// ============================================================================
function buildTxRow(
  tx: RpcTransaction,
  receipt: RpcReceipt | null,
  timestampMs: number
): TxRow {
  const gasUsed = receipt ? hexToNumber(receipt.gasUsed) : 0;
  const gasPrice = tx.gasPrice || receipt?.effectiveGasPrice || '0x0';
  const feeWei = BigInt(gasPrice) * BigInt(gasUsed);
  const status: 'success' | 'failed' =
    receipt && receipt.status === '0x1' ? 'success' : receipt ? 'failed' : 'success';

  let method = 'Transfer';
  const input = tx.input || '0x';
  if (input.length > 10 && input !== '0x') {
    const sig = input.slice(0, 10);
    method = KNOWN_METHODS[sig] || `${sig}`;
  }

  return {
    hash: tx.hash,
    blockNumber: tx.blockNumber ? hexToNumber(tx.blockNumber) : 0,
    timestamp: timestampMs,
    from: tx.from,
    to: tx.to,
    value: tx.value,
    gasPrice,
    gas: tx.gas,
    gasUsed: `0x${gasUsed.toString(16)}`,
    nonce: hexToNumber(tx.nonce),
    method,
    status,
    fee: `0x${feeWei.toString(16)}`,
    type: tx.type || '0x0',
  };
}

// ============================================================================
// COPY BUTTON
// ============================================================================
function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center justify-center rounded p-0.5 hover:bg-gray-100 transition-colors ${className || ''}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-gray-400" />
      )}
    </button>
  );
}

// ============================================================================
// SKELETON LOADERS
// ============================================================================
function TableSkeleton({ rows = 5, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 py-3 px-2">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return (
    <Card className="border border-gray-200">
      <CardContent className="p-4">
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-8 w-32" />
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TOKEN LOGO COMPONENT
// ============================================================================
function TokenLogo({ symbol, address, size = 24 }: { symbol: string; address: string; size?: number }) {
  const initial = (symbol || '?')[0]?.toUpperCase() || '?';
  const gradient = getGradientFromAddress(address);

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(size * 0.45, 10),
        background: gradient,
      }}
    >
      {initial}
    </div>
  );
}

// ============================================================================
// NAVBAR
// ============================================================================
function Navbar({ onNavigate }: { onNavigate: (hash: string) => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('all');
  const searchRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(() => {
    if (!searchInput.trim()) return;
    const trimmed = searchInput.trim();
    const parsed = parseSearchInput(searchInput);
    const type = detectSearchType(parsed);

    // Token/NFT name search
    if (type === 'unknown') {
      const discovered = getDiscoveredTokens();
      const match = Object.values(discovered).find(
        t => t.name.toLowerCase() === trimmed.toLowerCase() || t.symbol.toLowerCase() === trimmed.toLowerCase()
      );
      if (match) {
        onNavigate(`#address/${match.address}`);
        setSearchInput('');
        setMobileMenuOpen(false);
        return;
      }
    }

    if (searchFilter === 'all') {
      if (type === 'block') onNavigate(`#block/${parsed}`);
      else if (type === 'tx') onNavigate(`#tx/${parsed}`);
      else if (type === 'address') onNavigate(`#address/${parsed}`);
      else onNavigate(`#address/${parsed}`);
    } else if (searchFilter === 'blocks') {
      onNavigate(`#block/${parsed}`);
    } else if (searchFilter === 'transactions') {
      onNavigate(`#tx/${parsed}`);
    } else if (searchFilter === 'addresses') {
      onNavigate(`#address/${parsed}`);
    }

    setSearchInput('');
    setMobileMenuOpen(false);
  }, [searchInput, searchFilter, onNavigate]);

  const mainNavItems = [
    { hash: '#home', icon: Home, label: 'Home' },
    { hash: '#blocks', icon: Blocks, label: 'Blocks' },
    { hash: '#txs', icon: FileText, label: 'Transactions' },
    { hash: '#pending-txs', icon: Clock, label: 'Pending' },
    { hash: '#tokens', icon: Coins, label: 'Tokens' },
    { hash: '#nfts', icon: Image, label: 'NFTs' },
    { hash: '#top-accounts', icon: Trophy, label: 'Top Accounts' },
    { hash: '#validators', icon: Landmark, label: 'Validators' },
    { hash: '#verified-contracts', icon: ShieldCheck, label: 'Verified' },
    { hash: '#charts', icon: BarChart3, label: 'Charts' },
  ];

  const toolsItems = [
    { hash: '#broadcast-txn', icon: Send, label: 'Broadcast TXN' },
    { hash: '#unit-converter', icon: ArrowUpDown, label: 'Unit Converter' },
    { hash: '#bytecode-to-opcode', icon: Binary, label: 'Bytecode to Opcode' },
    { hash: '#verify-contract', icon: ShieldCheck, label: 'Verify Contract' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#13b5c1] shadow-md">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center h-16 gap-4">
          <button
            onClick={() => onNavigate('#home')}
            className="flex items-center gap-2 shrink-0"
          >
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <Cuboid className="w-5 h-5 text-[#13b5c1]" strokeWidth={2.5} />
            </div>
            <span className="text-white font-bold text-lg hidden sm:block">{CHAIN_NAME}</span>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-0.5 ml-1 overflow-x-auto">
            {mainNavItems.map((item) => (
              <button
                key={item.hash}
                onClick={() => onNavigate(item.hash)}
                className="px-2.5 py-2 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            ))}
            {/* Tools Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-2.5 py-2 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap">
                  <Wrench className="w-3.5 h-3.5" />
                  Tools
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {toolsItems.map((item) => (
                  <DropdownMenuItem key={item.hash} onClick={() => onNavigate(item.hash)} className="flex items-center gap-2 cursor-pointer">
                    <item.icon className="w-4 h-4 text-gray-500" />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl mx-auto flex">
            <div className="flex w-full bg-white rounded-lg overflow-hidden shadow-sm">
              <Select value={searchFilter} onValueChange={setSearchFilter}>
                <SelectTrigger className="w-auto border-0 rounded-none bg-gray-50 border-r text-xs text-gray-600 h-10 min-w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Filters</SelectItem>
                  <SelectItem value="blocks">Blocks</SelectItem>
                  <SelectItem value="transactions">Transactions</SelectItem>
                  <SelectItem value="addresses">Addresses</SelectItem>
                  <SelectItem value="tokens">Tokens</SelectItem>
                </SelectContent>
              </Select>
              <Input
                ref={searchRef}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by Address / Txn Hash / Block / Token Name"
                className="h-10 border-0 rounded-none text-sm focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
              />
              <button
                onClick={handleSearch}
                className="px-4 bg-[#13b5c1] hover:bg-[#0fa3ae] text-white transition-colors flex items-center"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden text-white p-2"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="lg:hidden pb-3 border-t border-white/20 mt-1 pt-2">
            <nav className="grid grid-cols-2 gap-1">
              {mainNavItems.map((item) => (
                <button
                  key={item.hash}
                  onClick={() => { onNavigate(item.hash); setMobileMenuOpen(false); }}
                  className="px-3 py-2 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded-md text-left transition-colors flex items-center gap-2"
                >
                  <item.icon className="w-4 h-4" /> {item.label}
                </button>
              ))}
              {toolsItems.map((item) => (
                <button
                  key={item.hash}
                  onClick={() => { onNavigate(item.hash); setMobileMenuOpen(false); }}
                  className="px-3 py-2 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded-md text-left transition-colors flex items-center gap-2"
                >
                  <item.icon className="w-4 h-4" /> {item.label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

// ============================================================================
// GAS TRACKER COMPONENT
// ============================================================================
function EnhancedGasTracker() {
  const [gasPrice, setGasPrice] = useState<string | null>(null);
  const [lastBlockGasUsed, setLastBlockGasUsed] = useState<number | null>(null);
  const [lastBlockGasLimit, setLastBlockGasLimit] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchGas = async () => {
      try {
        const [price, latestHex] = await Promise.all([
          rpcCall('eth_gasPrice'),
          rpcCall('eth_blockNumber'),
        ]);
        if (mounted) setGasPrice(price);
        const latestBlock = hexToNumber(latestHex);
        const block = await rpcCall('eth_getBlockByNumber', [`0x${latestBlock.toString(16)}`, false]);
        if (mounted && block) {
          setLastBlockGasUsed(hexToNumber(block.gasUsed));
          setLastBlockGasLimit(hexToNumber(block.gasLimit));
        }
      } catch { /* ignore */ }
    };
    fetchGas();
    const interval = setInterval(fetchGas, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const gwei = gasPrice ? weiToGwei(gasPrice) : '--';
  const slow = gasPrice ? (Number(gwei) * 0.8).toFixed(2) : '--';
  const fast = gasPrice ? (Number(gwei) * 1.2).toFixed(2) : '--';
  const gasUtil = lastBlockGasUsed !== null && lastBlockGasLimit !== null
    ? ((lastBlockGasUsed / lastBlockGasLimit) * 100).toFixed(1) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium uppercase tracking-wide">
        <Fuel className="w-3.5 h-3.5" />
        Gas Tracker
      </div>
      <div className="flex items-center gap-3">
        <div className="text-center">
          <div className="text-[10px] text-gray-400 uppercase">
            <Timer className="w-3 h-3 inline mr-0.5" />~30s
          </div>
          <div className="text-sm font-mono font-semibold text-gray-700">{slow}</div>
          <div className="text-[10px] text-gray-400">Gwei</div>
        </div>
        <div className="h-6 w-px bg-gray-200" />
        <div className="text-center">
          <div className="text-[10px] text-[#13b5c1] uppercase font-medium">
            <Clock className="w-3 h-3 inline mr-0.5" />~15s
          </div>
          <div className="text-sm font-mono font-bold text-[#13b5c1]">{gwei}</div>
          <div className="text-[10px] text-gray-400">Gwei</div>
        </div>
        <div className="h-6 w-px bg-gray-200" />
        <div className="text-center">
          <div className="text-[10px] text-gray-400 uppercase">
            <Zap className="w-3 h-3 inline mr-0.5" />~5s
          </div>
          <div className="text-sm font-mono font-semibold text-gray-700">{fast}</div>
          <div className="text-[10px] text-gray-400">Gwei</div>
        </div>
      </div>
      {gasUtil !== null && (
        <div className="flex items-center gap-2 text-[11px] text-gray-500 pt-1 border-t border-gray-100">
          <span>Last Block Gas:</span>
          <span className="font-mono text-gray-700">{lastBlockGasUsed?.toLocaleString()} / {lastBlockGasLimit?.toLocaleString()}</span>
          <span className="font-mono font-semibold text-[#13b5c1]">({gasUtil}%)</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STATS BAR
// ============================================================================
function StatsBar({ blockNumber }: { blockNumber: number | null }) {
  const marketCap = TOTAL_SUPPLY_EXE * EXE_PRICE;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Card className="border border-gray-200 py-4 px-4">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <TrendingUp className="w-3.5 h-3.5" />
          EXE Price
        </div>
        <div className="text-lg font-semibold text-gray-800">
          ${EXE_PRICE.toFixed(2)}
          <span className="text-xs text-green-500 ml-1">USD</span>
        </div>
      </Card>
      <Card className="border border-gray-200 py-4 px-4">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <Activity className="w-3.5 h-3.5" />
          Market Cap
        </div>
        <div className="text-lg font-semibold text-gray-800">
          ${formatNumber(marketCap)}
        </div>
      </Card>
      <Card className="border border-gray-200 py-4 px-4">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <Blocks className="w-3.5 h-3.5" />
          Block Height
        </div>
        <div className="text-lg font-semibold font-mono text-gray-800">
          {blockNumber !== null ? blockNumber.toLocaleString() : '--'}
        </div>
      </Card>
      <Card className="border border-gray-200 py-4 px-4">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
          <Zap className="w-3.5 h-3.5" />
          Chain Status
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="text-sm font-medium text-green-600">Synced</span>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// BLOCKS TABLE
// ============================================================================
function BlocksTable({
  blocks,
  loading,
  compact = false,
}: {
  blocks: BlockRow[];
  loading: boolean;
  compact?: boolean;
}) {
  if (loading) return <TableSkeleton rows={compact ? 10 : 5} cols={8} />;

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
          <TableHead className="text-xs font-semibold text-gray-500 uppercase">
            {compact ? '' : 'Block'}
          </TableHead>
          <TableHead className="text-xs font-semibold text-gray-500 uppercase">Age</TableHead>
          <TableHead className="text-xs font-semibold text-gray-500 uppercase text-center">
            Txns
          </TableHead>
          <TableHead className="text-xs font-semibold text-gray-500 uppercase">Signer</TableHead>
          <TableHead className="text-xs font-semibold text-gray-500 uppercase">Gas Used</TableHead>
          {!compact && (
            <TableHead className="text-xs font-semibold text-gray-500 uppercase">
              Gas Limit
            </TableHead>
          )}
          {!compact && (
            <TableHead className="text-xs font-semibold text-gray-500 uppercase">
              Block Size
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {blocks.map((block) => (
          <TableRow key={block.number} className="text-sm">
            <TableCell className="font-mono font-medium">
              {compact ? (
                <button
                  onClick={() => (window.location.hash = `#block/${block.number}`)}
                  className="text-[#13b5c1] hover:text-[#0fa3ae] hover:underline"
                >
                  {block.number.toLocaleString()}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Blocks className="w-4 h-4 text-gray-400 shrink-0" />
                  <button
                    onClick={() => (window.location.hash = `#block/${block.number}`)}
                    className="text-[#13b5c1] hover:text-[#0fa3ae] hover:underline font-semibold"
                  >
                    {block.number.toLocaleString()}
                  </button>
                </div>
              )}
            </TableCell>
            <TableCell className="text-gray-500 text-xs whitespace-nowrap">
              {timeAgo(block.timestamp)}
            </TableCell>
            <TableCell className="text-center">
              <button
                onClick={() => (window.location.hash = `#block/${block.number}`)}
                className="inline-flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded px-2 py-0.5 font-mono transition-colors"
              >
                {block.txCount}
                <ArrowRight className="w-3 h-3 ml-1 text-gray-400" />
              </button>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => (window.location.hash = `#address/${block.miner}`)}
                  className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline"
                >
                  {shortHash(block.miner)}
                </button>
                <CopyButton text={block.miner} />
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2 min-w-[120px]">
                <Progress
                  value={(block.gasUsed / block.gasLimit) * 100}
                  className="h-2 flex-1"
                />
                <span className="text-xs text-gray-500 font-mono whitespace-nowrap">
                  {((block.gasUsed / block.gasLimit) * 100).toFixed(1)}%
                </span>
              </div>
            </TableCell>
            {!compact && (
              <TableCell className="text-xs text-gray-500 font-mono">
                {block.gasLimit.toLocaleString()}
              </TableCell>
            )}
            {!compact && (
              <TableCell className="text-xs text-gray-500 font-mono">
                {block.size.toLocaleString()} bytes
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============================================================================
// TRANSACTIONS TABLE
// ============================================================================
function TransactionsTable({
  transactions,
  loading,
}: {
  transactions: TxRow[];
  loading: boolean;
}) {
  if (loading) return <TableSkeleton rows={10} cols={8} />;

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No transactions found</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
          <TableHead className="text-xs font-semibold text-gray-500 uppercase">
            Transaction Hash
          </TableHead>
          <TableHead className="text-xs font-semibold text-gray-500 uppercase">Method</TableHead>
          <TableHead className="text-xs font-semibold text-gray-500 uppercase">Block</TableHead>
          <TableHead className="text-xs font-semibold text-gray-500 uppercase">Age</TableHead>
          <TableHead className="text-xs font-semibold text-gray-500 uppercase">From</TableHead>
          <TableHead className="text-xs font-semibold text-gray-500 uppercase text-center">
            To
          </TableHead>
          <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right">
            Value
          </TableHead>
          <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right">
            Txn Fee
          </TableHead>
          <TableHead className="text-xs font-semibold text-gray-500 uppercase text-center">
            Status
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => (
          <TableRow key={tx.hash} className="text-sm">
            <TableCell>
              <div className="flex items-center gap-1">
                {tx.status === 'success' && (
                  <CircleDot className="w-4 h-4 text-green-500 shrink-0" />
                )}
                {tx.status === 'failed' && (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <button
                  onClick={() => (window.location.hash = `#tx/${tx.hash}`)}
                  className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline"
                >
                  {shortHash(tx.hash)}
                </button>
                <CopyButton text={tx.hash} />
              </div>
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                {tx.method}
              </span>
            </TableCell>
            <TableCell>
              <button
                onClick={() => (window.location.hash = `#block/${tx.blockNumber}`)}
                className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline"
              >
                {tx.blockNumber.toLocaleString()}
              </button>
            </TableCell>
            <TableCell className="text-gray-500 text-xs whitespace-nowrap">
              {timeAgo(tx.timestamp)}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => (window.location.hash = `#address/${tx.from}`)}
                  className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline"
                >
                  {shortHash(tx.from)}
                </button>
                <CopyButton text={tx.from} />
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center justify-center gap-1">
                {tx.to ? (
                  <button
                    onClick={() => (window.location.hash = `#address/${tx.to}`)}
                    className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline"
                  >
                    {shortHash(tx.to)}
                  </button>
                ) : (
                  <span className="text-[11px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200">
                    Contract Creation
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right font-mono text-xs whitespace-nowrap">
              {weiToExe(tx.value) === '0' ? '0' : `${weiToExe(tx.value)}`}{' '}
              <span className="text-gray-400">{NATIVE_TOKEN}</span>
            </TableCell>
            <TableCell className="text-right font-mono text-xs text-gray-500 whitespace-nowrap">
              {weiToExe(tx.fee) === '0' ? '0' : `${weiToExe(tx.fee)}`}
            </TableCell>
            <TableCell className="text-center">
              {tx.status === 'success' ? (
                <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50 text-[11px]">
                  Success
                </Badge>
              ) : (
                <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50 text-[11px]">
                  Failed
                </Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============================================================================
// SIMPLE PAGINATION
// ============================================================================
function SimplePagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const getPages = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            &laquo; Previous
          </button>
        </PaginationItem>
        {getPages().map((page, i) =>
          page === 'ellipsis' ? (
            <PaginationItem key={`e-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={page}>
              <PaginationLink
                isActive={page === currentPage}
                onClick={() => onPageChange(page)}
                className="cursor-pointer font-mono text-sm"
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          )
        )}
        <PaginationItem>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next &raquo;
          </button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

// ============================================================================
// HOME PAGE
// ============================================================================
function HomePage({ onNavigate }: { onNavigate: (hash: string) => void }) {
  const { blockNumber, loading: bnLoading } = useLatestBlockNumber();
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);
  const [loadingTxs, setLoadingTxs] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const latestBlocks = await fetchLatestBlocks(10);
        if (!mounted) return;
        setBlocks(latestBlocks);
        setLoadingBlocks(false);

        const allTxHashes: string[] = [];
        for (const b of latestBlocks) {
          const blockHex = `0x${b.number.toString(16)}`;
          try {
            const fullBlock = await rpcCall('eth_getBlockByNumber', [blockHex, true]);
            if (fullBlock && fullBlock.transactions) {
              const txArray = Array.isArray(fullBlock.transactions)
                ? fullBlock.transactions
                : [fullBlock.transactions];
              for (const tx of txArray) {
                if (typeof tx === 'string') allTxHashes.push(tx);
                else if (tx && tx.hash) allTxHashes.push(tx.hash);
              }
            }
          } catch { /* skip */ }
          if (allTxHashes.length >= 15) break;
        }

        const uniqueHashes = [...new Set(allTxHashes)].slice(0, 15);
        const txPromises = uniqueHashes.map(async (hash) => {
          try {
            const [txData, receiptData] = await Promise.all([
              rpcCall('eth_getTransactionByHash', [hash]),
              rpcCall('eth_getTransactionReceipt', [hash]),
            ]);
            return { tx: txData, receipt: receiptData };
          } catch {
            return null;
          }
        });
        const results = await Promise.all(txPromises);
        if (!mounted) return;

        const txRows: TxRow[] = [];
        for (const r of results) {
          if (r?.tx) {
            let timestamp = Date.now();
            for (const b of latestBlocks) {
              if (b.number === (r.tx.blockNumber ? hexToNumber(r.tx.blockNumber) : -1)) {
                timestamp = b.timestamp;
                break;
              }
            }
            txRows.push(buildTxRow(r.tx, r.receipt, timestamp));
          }
        }
        setTxs(txRows);
        setLoadingTxs(false);
      } catch {
        if (mounted) {
          setLoadingBlocks(false);
          setLoadingTxs(false);
        }
      }
    };
    fetchData();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;
    const refetch = async () => {
      try {
        const latestBlocks = await fetchLatestBlocks(10);
        if (mounted) setBlocks(latestBlocks);
      } catch { /* ignore */ }
    };
    refetch();
    return () => { mounted = false; };
  }, [tick]);

  return (
    <div className="space-y-6">
      <StatsBar blockNumber={blockNumber} />
      <Card className="border border-gray-200">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <EnhancedGasTracker />
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-gray-200">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
              Latest Blocks
            </CardTitle>
            <button
              onClick={() => onNavigate('#blocks')}
              className="text-xs text-[#13b5c1] hover:text-[#0fa3ae] font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <BlocksTable blocks={blocks} loading={loadingBlocks} compact />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-gray-200">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
              Latest Transactions
            </CardTitle>
            <button
              onClick={() => onNavigate('#txs')}
              className="text-xs text-[#13b5c1] hover:text-[#0fa3ae] font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <TransactionsTable transactions={txs} loading={loadingTxs} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// BLOCKS LIST PAGE
// ============================================================================
function BlocksListPage() {
  const { blockNumber, loading: bnLoading } = useLatestBlockNumber();
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 50;
  const totalPages = Math.ceil(10000 / perPage);

  useEffect(() => {
    if (blockNumber === null) return;
    let mounted = true;
    setLoading(true);
    const startBlock = blockNumber - (page - 1) * perPage;
    fetchBlocksRange(startBlock, perPage)
      .then((data) => {
        if (mounted) {
          setBlocks(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [blockNumber, page]);

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
            Blocks
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <BlocksTable blocks={blocks} loading={loading || bnLoading} />
          </div>
        </CardContent>
      </Card>
      <SimplePagination
        currentPage={page}
        totalPages={Math.min(totalPages, Math.floor((blockNumber || 0) / perPage) + 1)}
        onPageChange={setPage}
      />
    </div>
  );
}

// ============================================================================
// BLOCK DETAIL PAGE
// ============================================================================
function BlockDetailPage({ blockNumber }: { blockNumber: number }) {
  const { block, loading, error } = useBlock(blockNumber);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);

  useEffect(() => {
    if (!block) return;
    let mounted = true;
    setLoadingTxs(true);

    const txHashes = block.transactions;
    if (txHashes.length === 0) {
      setTransactions([]);
      setLoadingTxs(false);
      return;
    }

    const promises = txHashes.slice(0, 50).map(async (hash: string) => {
      try {
        const [txData, receiptData] = await Promise.all([
          rpcCall('eth_getTransactionByHash', [hash]),
          rpcCall('eth_getTransactionReceipt', [hash]),
        ]);
        return { tx: txData, receipt: receiptData };
      } catch {
        return null;
      }
    });

    Promise.all(promises).then((results) => {
      if (!mounted) return;
      const timestamp = hexToNumber(block.timestamp) * 1000;
      const rows: TxRow[] = results
        .filter((r): r is NonNullable<typeof r> => r !== null && r.tx !== null)
        .map((r) => buildTxRow(r.tx, r.receipt, timestamp));
      setTransactions(rows);
      setLoadingTxs(false);
    });

    return () => { mounted = false; };
  }, [block]);

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (error || !block) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
          <p className="text-gray-600">{error || 'Block not found'}</p>
        </CardContent>
      </Card>
    );
  }

  const gasUsed = hexToNumber(block.gasUsed);
  const gasLimit = hexToNumber(block.gasLimit);
  const blockSize = hexToNumber(block.size);
  const timestamp = hexToNumber(block.timestamp) * 1000;
  const dateStr = new Date(timestamp).toLocaleString();

  const overviewItems = [
    { label: 'Block Number', value: block.number, mono: true },
    { label: 'Block Hash', value: block.hash, mono: true, copyable: true },
    { label: 'Timestamp', value: `${dateStr} (${timeAgo(timestamp)})`, mono: false },
    { label: 'Transactions', value: `${block.transactions.length} transactions in this block`, mono: false },
    { label: 'Signer / Miner', value: block.miner, mono: true, address: true, copyable: true },
    { label: 'Gas Used', value: `${gasUsed.toLocaleString()} (${((gasUsed / gasLimit) * 100).toFixed(1)}%)`, mono: true },
    { label: 'Gas Limit', value: gasLimit.toLocaleString(), mono: true },
    { label: 'Base Fee Per Gas', value: block.baseFeePerGas ? `${weiToGwei(block.baseFeePerGas)} Gwei (${weiToExe(block.baseFeePerGas)} ${NATIVE_TOKEN})` : 'N/A', mono: false },
    { label: 'Block Size', value: `${blockSize.toLocaleString()} bytes`, mono: true },
    { label: 'Difficulty', value: hexToNumber(block.difficulty).toLocaleString(), mono: true },
    { label: 'Parent Hash', value: block.parentHash, mono: true, copyable: true, blockHash: true },
    { label: 'State Root', value: block.stateRoot, mono: true, copyable: true },
    { label: 'Nonce', value: block.nonce || 'N/A', mono: true },
  ];

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
            Block Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            {overviewItems.map((item, i) => (
              <div
                key={item.label}
                className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3 ${
                  i % 2 === 0 ? 'bg-gray-50/60' : 'bg-white'
                } ${i < overviewItems.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span className="text-xs text-gray-500 font-medium shrink-0 w-40">
                  {item.label}
                </span>
                <span className={`text-sm ${item.mono ? 'font-mono' : ''} break-all`}>
                  {item.address ? (
                    <button
                      onClick={() => (window.location.hash = `#address/${item.value}`)}
                      className="text-[#13b5c1] hover:text-[#0fa3ae] hover:underline text-xs"
                    >
                      {item.value}
                    </button>
                  ) : item.blockHash ? (
                    <button
                      onClick={() => (window.location.hash = `#block/${hexToNumber(item.value)}`)}
                      className="text-[#13b5c1] hover:text-[#0fa3ae] hover:underline text-xs"
                    >
                      {item.value}
                    </button>
                  ) : (
                    <span className={typeof item.value === 'string' && item.value.startsWith('0x') ? 'text-xs' : ''}>
                      {item.value}
                    </span>
                  )}
                </span>
                {item.copyable && <CopyButton text={String(item.value)} />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
            Transactions ({block.transactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <TransactionsTable transactions={transactions} loading={loadingTxs} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// TRANSACTIONS LIST PAGE
// ============================================================================
function TransactionsListPage() {
  const { blockNumber } = useLatestBlockNumber();
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 50;

  useEffect(() => {
    if (blockNumber === null) return;
    let mounted = true;

    const startBlock = blockNumber - (page - 1) * 3;
    const endBlock = startBlock - 3;

    const fetchTxs = async () => {
      setLoading(true);
      const allTxRows: TxRow[] = [];
      for (let b = startBlock; b > endBlock; b--) {
        if (allTxRows.length >= perPage) break;
        try {
          const hexBlock = `0x${b.toString(16)}`;
          const fullBlock = await rpcCall('eth_getBlockByNumber', [hexBlock, true]);
          if (!fullBlock || !fullBlock.transactions) continue;
          const txArray = Array.isArray(fullBlock.transactions) ? fullBlock.transactions : [fullBlock.transactions];
          const timestamp = hexToNumber(fullBlock.timestamp) * 1000;
          for (const txHashOrObj of txArray) {
            if (allTxRows.length >= perPage) break;
            try {
              const hash = typeof txHashOrObj === 'string' ? txHashOrObj : txHashOrObj.hash;
              const [txData, receiptData] = await Promise.all([
                rpcCall('eth_getTransactionByHash', [hash]),
                rpcCall('eth_getTransactionReceipt', [hash]),
              ]);
              if (txData) allTxRows.push(buildTxRow(txData, receiptData, timestamp));
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }
      return allTxRows;
    };

    fetchTxs().then((data) => {
      if (mounted) { setTransactions(data); setLoading(false); }
    });
    return () => { mounted = false; };
  }, [blockNumber, page]);

  const totalPages = blockNumber ? Math.floor(blockNumber / 3) : 1;

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
            Transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <TransactionsTable transactions={transactions} loading={loading} />
          </div>
        </CardContent>
      </Card>
      <SimplePagination currentPage={page} totalPages={Math.min(200, totalPages)} onPageChange={setPage} />
    </div>
  );
}

// ============================================================================
// TRANSACTION DETAIL PAGE (Enhanced with Decoded Input & Event Logs)
// ============================================================================
function TransactionDetailPage({ txHash }: { txHash: string }) {
  const { tx, receipt, loading, error } = useTransaction(txHash);
  const [blockTimestamp, setBlockTimestamp] = useState<number | null>(null);
  const [knownTokens, setKnownTokens] = useState<Record<string, TokenInfo>>({});

  useEffect(() => {
    if (!tx?.blockNumber) return;
    rpcCall('eth_getBlockByNumber', [tx.blockNumber, false])
      .then((block) => { if (block) setBlockTimestamp(hexToNumber(block.timestamp) * 1000); })
      .catch(() => {});
  }, [tx?.blockNumber]);

  useEffect(() => {
    setKnownTokens(getDiscoveredTokens());
  }, []);

  if (loading) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;

  if (error || !tx) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
          <p className="text-gray-600">{error || 'Transaction not found'}</p>
        </CardContent>
      </Card>
    );
  }

  const gasUsed = receipt ? hexToNumber(receipt.gasUsed) : 0;
  const gasPrice = tx.gasPrice || receipt?.effectiveGasPrice || '0x0';
  const feeWei = BigInt(gasPrice) * BigInt(gasUsed);
  const status = receipt && receipt.status === '0x1' ? 'success' : receipt ? 'failed' : 'success';
  const timestamp = blockTimestamp;
  const isContractCreation = !tx.to;
  const input = tx.input || '0x';
  const isSimpleTransfer = input === '0x' || input === '0x0';

  // Decode input data
  const decodedInput = useMemo(() => {
    if (isSimpleTransfer || isContractCreation) return null;
    // Try to get ABI from verified contract
    if (tx.to) {
      const vc = getVerifiedContract(tx.to);
      if (vc?.abi) return decodeInputData(input, vc.abi);
    }
    return decodeInputData(input, null);
  }, [input, tx.to, isSimpleTransfer, isContractCreation]);

  // Decode event logs
  const decodedLogs = useMemo(() => {
    if (!receipt?.logs || receipt.logs.length === 0) return [];
    return decodeLogs(receipt.logs, knownTokens);
  }, [receipt?.logs, knownTokens]);

  const overviewItems: { label: string; value: React.ReactNode }[] = [
    {
      label: 'Transaction Hash',
      value: (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-mono text-xs">{txHash}</span>
          <CopyButton text={txHash} />
        </div>
      ),
    },
    {
      label: 'Status',
      value: status === 'success' ? (
        <Badge className="bg-green-50 text-green-700 border-green-200 hover:bg-green-50 text-[11px]">
          <CircleDot className="w-3 h-3 mr-0.5" /> Success
        </Badge>
      ) : (
        <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50 text-[11px]">
          <AlertCircle className="w-3 h-3 mr-0.5" /> Failed
        </Badge>
      ),
    },
    {
      label: 'Block',
      value: tx.blockNumber ? (
        <button onClick={() => (window.location.hash = `#block/${hexToNumber(tx.blockNumber)}`)}
          className="text-[#13b5c1] hover:text-[#0fa3ae] hover:underline font-mono text-xs">
          {hexToNumber(tx.blockNumber).toLocaleString()}
        </button>
      ) : 'Pending',
    },
    {
      label: 'Timestamp',
      value: timestamp ? `${new Date(timestamp).toLocaleString()} (${timeAgo(timestamp)})` : 'Pending',
    },
    {
      label: 'From',
      value: (
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => (window.location.hash = `#address/${tx.from}`)}
            className="text-[#13b5c1] hover:text-[#0fa3ae] hover:underline font-mono text-xs">{tx.from}</button>
          <CopyButton text={tx.from} />
        </div>
      ),
    },
    {
      label: 'To',
      value: isContractCreation ? (
        <span className="text-[11px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200">Contract Creation</span>
      ) : tx.to ? (
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => (window.location.hash = `#address/${tx.to}`)}
            className="text-[#13b5c1] hover:text-[#0fa3ae] hover:underline font-mono text-xs">{tx.to}</button>
          <CopyButton text={tx.to || ''} />
          {knownTokens[tx.to.toLowerCase()] && (
            <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] ml-1">
              {knownTokens[tx.to.toLowerCase()].symbol}
            </Badge>
          )}
        </div>
      ) : '--',
    },
    {
      label: 'Value',
      value: <span className="font-mono text-sm">{weiToExe(tx.value)} {NATIVE_TOKEN}</span>,
    },
    {
      label: 'Transaction Fee',
      value: <span className="font-mono text-sm text-gray-600">{weiToExe(`0x${feeWei.toString(16)}`)} {NATIVE_TOKEN}</span>,
    },
    {
      label: 'Gas Price',
      value: <span className="font-mono text-sm">{weiToGwei(gasPrice)} Gwei ({weiToExe(gasPrice)} {NATIVE_TOKEN})</span>,
    },
    {
      label: 'Gas Limit',
      value: <span className="font-mono text-sm">{hexToNumber(tx.gas).toLocaleString()}</span>,
    },
    {
      label: 'Gas Used by Transaction',
      value: (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{gasUsed.toLocaleString()}</span>
          <span className="text-xs text-gray-400">({((gasUsed / hexToNumber(tx.gas)) * 100).toFixed(1)}%)</span>
        </div>
      ),
    },
    {
      label: 'Nonce',
      value: <span className="font-mono text-sm">{hexToNumber(tx.nonce)}</span>,
    },
    {
      label: 'Transaction Type',
      value: <span className="text-sm">{tx.type || 'Legacy (0x0)'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
            Transaction Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            {overviewItems.map((item, i) => (
              <div key={item.label}
                className={`flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 px-4 py-3 ${
                  i % 2 === 0 ? 'bg-gray-50/60' : 'bg-white'
                } ${i < overviewItems.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <span className="text-xs text-gray-500 font-medium shrink-0 w-48">{item.label}</span>
                <span className="text-sm">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Decoded Input Data */}
      {!isSimpleTransfer && (
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
              <Code2 className="w-4 h-4 text-gray-500" />
              {decodedInput?.method && decodedInput.method !== input.slice(0, 10)
                ? `Decoded Input Data: ${decodedInput.method}()`
                : 'Input Data'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {decodedInput && decodedInput.params.length > 0 ? (
              <div className="space-y-3">
                {decodedInput.params.map((param, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-1 sm:gap-4 px-4 py-3 bg-gray-50/60 rounded-lg border border-gray-100">
                    <span className="text-xs text-gray-500 font-medium shrink-0 w-32">{param.name}</span>
                    <span className="text-xs text-gray-400 font-mono shrink-0 w-16">{param.type}</span>
                    {param.type === 'address' ? (
                      <button onClick={() => (window.location.hash = `#address/${param.value}`)}
                        className="text-[#13b5c1] hover:text-[#0fa3ae] hover:underline font-mono text-xs">
                        {param.value}
                      </button>
                    ) : (
                      <span className="font-mono text-xs break-all">{param.value}</span>
                    )}
                  </div>
                ))}
                <details className="mt-2">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                    View Raw Input Data
                  </summary>
                  <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <pre className="p-4 overflow-x-auto max-h-64 overflow-y-auto text-xs font-mono leading-relaxed text-gray-600 break-all">
                      {input}
                    </pre>
                  </div>
                </details>
              </div>
            ) : (
              <div>
                <details>
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                    {isContractCreation ? 'Contract Creation Bytecode' : 'Raw Input Data'} (click to expand)
                  </summary>
                  <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                    <pre className="p-4 overflow-x-auto max-h-96 overflow-y-auto text-xs font-mono leading-relaxed text-gray-600 break-all">
                      {input}
                    </pre>
                  </div>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Event Logs */}
      {decodedLogs.length > 0 && (
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
              <ScrollText className="w-4 h-4 text-gray-500" />
              Event Logs ({decodedLogs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {decodedLogs.map((evt, idx) => (
                <div key={idx} className="border border-gray-100 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/80 border-b border-gray-100">
                    <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[11px]">
                      {evt.name}
                    </Badge>
                    <button onClick={() => (window.location.hash = `#address/${evt.contract}`)}
                      className="font-mono text-[11px] text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                      {shortHash(evt.contract)}
                    </button>
                    {knownTokens[evt.contract.toLowerCase()] && (
                      <span className="text-[10px] text-gray-500">
                        ({knownTokens[evt.contract.toLowerCase()].name})
                      </span>
                    )}
                  </div>
                  <div className="px-4 py-2 space-y-1.5">
                    {evt.params.map((param, pi) => (
                      <div key={pi} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-500 font-medium w-16 shrink-0">{param.name}</span>
                        {param.type === 'address' ? (
                          <button onClick={() => (window.location.hash = `#address/${param.value}`)}
                            className="font-mono text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                            {shortHash(param.value)}
                          </button>
                        ) : (
                          <span className="font-mono text-gray-700 break-all">{param.value}</span>
                        )}
                        <span className="text-gray-400">({param.type})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Internal Transactions */}
      <InternalTransactionsCard txHash={txHash} blockNumber={tx.blockNumber ? hexToNumber(tx.blockNumber) : null} />
    </div>
  );
}

// ============================================================================
// TOKEN INFO CARD (for token contract addresses)
// ============================================================================
function TokenInfoCard({ token }: { token: TokenInfo }) {
  const supplyFormatted = token.type === 'ERC20'
    ? formatTokenBalance(token.totalSupply, token.decimals)
    : BigInt(token.totalSupply).toLocaleString();

  return (
    <Card className="border-2 border-[#13b5c1]/30 bg-gradient-to-r from-teal-50/50 to-cyan-50/50">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <TokenLogo symbol={token.symbol} address={token.address} size={48} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-base text-gray-900 truncate">{token.name}</h3>
              <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[10px] shrink-0">
                {token.type}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-3">
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-medium">Symbol</span>
                <p className="text-sm font-mono font-semibold text-gray-800">{token.symbol}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-medium">Decimals</span>
                <p className="text-sm font-mono text-gray-800">{token.decimals}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-medium">Total Supply</span>
                <p className="text-sm font-mono text-gray-800 truncate">{supplyFormatted}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase font-medium">Contract</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => (window.location.hash = `#address/${token.address}`)}
                    className="text-[#13b5c1] hover:text-[#0fa3ae] hover:underline font-mono text-xs truncate">
                    {shortHash(token.address)}
                  </button>
                  <CopyButton text={token.address} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TOKEN HOLDINGS TAB
// ============================================================================
function TokenHoldingsTab({ address }: { address: string }) {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const discovered = getDiscoveredTokens();
    const erc20Tokens = Object.values(discovered).filter(t => t.type === 'ERC20');
    setTokens(erc20Tokens);

    if (erc20Tokens.length === 0) {
      setLoading(false);
      return;
    }

    const fetchBalances = async () => {
      const balMap: Record<string, string> = {};
      await Promise.all(erc20Tokens.map(async (t) => {
        try {
          const bal = await getTokenBalance(t.address, address, t.decimals);
          if (bal !== '0') balMap[t.address.toLowerCase()] = bal;
        } catch { /* skip */ }
      }));
      setBalances(balMap);
      setLoading(false);
    };
    fetchBalances();
  }, [address]);

  const tokensWithBalance = tokens.filter(t => balances[t.address.toLowerCase()] && balances[t.address.toLowerCase()] !== '0');

  if (loading) return <div className="py-8"><TableSkeleton rows={5} cols={4} /></div>;

  if (tokensWithBalance.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <Coins className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No ERC-20 token holdings found for this address</p>
        <p className="text-xs mt-1">Tokens are discovered as they are encountered in transactions</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
          <TableHead className="text-xs font-semibold text-gray-500 uppercase">Token</TableHead>
          <TableHead className="text-xs font-semibold text-gray-500 uppercase">Symbol</TableHead>
          <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right">Balance</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tokensWithBalance.map(t => (
          <TableRow key={t.address} className="text-sm">
            <TableCell>
              <div className="flex items-center gap-2">
                <TokenLogo symbol={t.symbol} address={t.address} size={24} />
                <button onClick={() => (window.location.hash = `#address/${t.address}`)}
                  className="text-[#13b5c1] hover:text-[#0fa3ae] hover:underline text-xs truncate max-w-[200px]">
                  {t.name}
                </button>
              </div>
            </TableCell>
            <TableCell className="font-mono text-xs">{t.symbol}</TableCell>
            <TableCell className="text-right font-mono text-xs">
              {balances[t.address.toLowerCase()]}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ============================================================================
// NFT HOLDINGS TAB
// ============================================================================
function NFTHoldingsTab({ address }: { address: string }) {
  const [nfts, setNfts] = useState<TokenInfo[]>([]);
  const [holdings, setHoldings] = useState<{ token: TokenInfo; tokenIds: string[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const discovered = getDiscoveredTokens();
    const erc721Tokens = Object.values(discovered).filter(t => t.type === 'ERC721');
    setNfts(erc721Tokens);

    if (erc721Tokens.length === 0) {
      setLoading(false);
      return;
    }

    const fetchNFTBalances = async () => {
      const results: { token: TokenInfo; tokenIds: string[] }[] = [];
      await Promise.all(erc721Tokens.map(async (t) => {
        try {
          const paddedAddr = '0x' + address.replace('0x', '').padStart(64, '0');
          const balHex = await ethCall(t.address, ERC721_BALANCEOF_SIG + paddedAddr.slice(2));
          const count = hexToNumber(balHex);
          if (count > 0) {
            const ids: string[] = [];
            for (let i = 0; i < Math.min(count, 20); i++) {
              try {
                const paddedIdx = '0x' + BigInt(i).toString(16).padStart(64, '0');
                const tokenIdHex = await ethCall(t.address, ERC721_TOKENOFOWNERBYINDEX_SIG + paddedAddr.slice(2) + paddedIdx.slice(2));
                if (tokenIdHex && tokenIdHex !== '0x' && tokenIdHex !== '0x0') {
                  ids.push(BigInt(tokenIdHex).toString());
                }
              } catch { /* skip */ }
            }
            if (ids.length > 0) results.push({ token: t, tokenIds: ids });
          }
        } catch { /* skip */ }
      }));
      setHoldings(results);
      setLoading(false);
    };
    fetchNFTBalances();
  }, [address]);

  if (loading) return <div className="py-8"><TableSkeleton rows={5} cols={4} /></div>;

  if (holdings.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <Image className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No NFT holdings found for this address</p>
        <p className="text-xs mt-1">NFT collections are discovered as they are encountered in transactions</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {holdings.map(({ token, tokenIds }) => (
        <div key={token.address} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
          <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <TokenLogo symbol={token.symbol} address={token.address} size={56} />
          </div>
          <div className="p-3">
            <h4 className="font-semibold text-sm truncate">{token.name}</h4>
            <p className="text-xs text-gray-500 mb-2">{token.symbol} · {tokenIds.length} item{tokenIds.length !== 1 ? 's' : ''}</p>
            <div className="flex flex-wrap gap-1">
              {tokenIds.slice(0, 3).map(id => (
                <Badge key={id} className="bg-gray-100 text-gray-600 text-[10px]">#{id}</Badge>
              ))}
              {tokenIds.length > 3 && (
                <Badge className="bg-gray-100 text-gray-500 text-[10px]">+{tokenIds.length - 3}</Badge>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// READ CONTRACT TAB
// ============================================================================
function ReadContractTab({ address }: { address: string }) {
  const [abi, setAbi] = useState<AbiItem[]>([]);
  const [results, setResults] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState<string | null>(null);

  useEffect(() => {
    const vc = getVerifiedContract(address);
    if (vc?.abi && Array.isArray(vc.abi)) {
      setAbi(vc.abi.filter((item: AbiItem) => item.type === 'function' && (item.stateMutability === 'view' || item.stateMutability === 'pure' || item.constant)));
    }
    setLoading(false);
  }, [address]);

  const handleRead = async (method: AbiItem) => {
    setReading(method.name);
    try {
      // Build calldata - for view functions with no inputs
      // We need the function selector from ABI (4-byte)
      // Since we may not have the selector, use known ones or compute
      const selector = Object.entries(KNOWN_METHODS).find(([sig, name]) => name === method.name)?.[0];
      if (!selector) {
        setResults(prev => ({ ...prev, [method.name]: 'Error: Cannot determine function selector' }));
        setReading(null);
        return;
      }
      const result = await ethCall(address, selector);
      if (method.outputs && method.outputs.length > 0) {
        const outType = method.outputs[0].type;
        if (outType === 'uint256' || outType === 'int256') {
          setResults(prev => ({ ...prev, [method.name]: BigInt(result).toString() }));
        } else if (outType === 'bool') {
          setResults(prev => ({ ...prev, [method.name]: BigInt(result) === 1n ? 'true' : 'false' }));
        } else if (outType === 'address') {
          setResults(prev => ({ ...prev, [method.name]: topicToAddress(result) }));
        } else if (outType === 'string' || outType.startsWith('bytes')) {
          setResults(prev => ({ ...prev, [method.name]: result }));
        } else {
          setResults(prev => ({ ...prev, [method.name]: result }));
        }
      } else {
        setResults(prev => ({ ...prev, [method.name]: result }));
      }
    } catch (e) {
      setResults(prev => ({ ...prev, [method.name]: `Error: ${e instanceof Error ? e.message : 'Failed'}` }));
    }
    setReading(null);
  };

  if (loading) return <div className="py-8"><TableSkeleton rows={5} cols={3} /></div>;

  if (abi.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No readable functions available</p>
        <p className="text-xs mt-1">Contract source code must be verified to enable Read Contract</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto">
      {abi.map((method) => (
        <div key={method.name} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">view</Badge>
              <span className="font-mono text-sm font-medium text-gray-800">{method.name}</span>
              <span className="text-xs text-gray-400">({method.inputs.map(i => `${i.type} ${i.name}`).join(', ')})</span>
            </div>
            {method.inputs.length === 0 && (
              <Button size="sm" variant="outline" className="text-xs h-7"
                onClick={() => handleRead(method)} disabled={reading === method.name}>
                {reading === method.name ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Query'}
              </Button>
            )}
          </div>
          {results[method.name] !== undefined && (
            <div className="px-4 py-3 bg-green-50/50">
              <span className="text-[10px] text-gray-500 uppercase">Result:</span>
              <div className="mt-1 font-mono text-xs text-gray-800 break-all">{results[method.name]}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// WRITE CONTRACT TAB
// ============================================================================
function WriteContractTab({ address }: { address: string }) {
  const [abi, setAbi] = useState<AbiItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const vc = getVerifiedContract(address);
    if (vc?.abi && Array.isArray(vc.abi)) {
      setAbi(vc.abi.filter((item: AbiItem) => item.type === 'function' && !item.constant && item.stateMutability !== 'view' && item.stateMutability !== 'pure'));
    }
    setLoading(false);
  }, [address]);

  if (loading) return <div className="py-8"><TableSkeleton rows={5} cols={3} /></div>;

  if (abi.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <PenTool className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No write functions available</p>
        <p className="text-xs mt-1">Contract source code must be verified to enable Write Contract</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 flex items-start gap-2 mb-4">
        <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
        <div className="text-xs text-yellow-800">
          <p className="font-medium mb-1">MetaMask Required</p>
          <p>Write contract interactions require a Web3 wallet (e.g., MetaMask) connected to the {CHAIN_NAME} network. Ensure your wallet is configured with Chain ID: {CHAIN_ID}.</p>
        </div>
      </div>
      {abi.map((method) => (
        <div key={method.name} className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-50/80 border-b border-gray-100">
            <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">
              {method.stateMutability === 'payable' ? 'payable' : 'write'}
            </Badge>
            <span className="font-mono text-sm font-medium text-gray-800">{method.name}</span>
            <span className="text-xs text-gray-400">({method.inputs.map(i => `${i.type} ${i.name}`).join(', ')})</span>
          </div>
          <div className="px-4 py-3 space-y-2">
            {method.inputs.map((input, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <Label className="text-xs text-gray-600 shrink-0 w-24 font-mono">{input.name}</Label>
                <Input placeholder={input.type} className="text-xs font-mono h-8" disabled />
                <span className="text-[10px] text-gray-400">{input.type}</span>
              </div>
            ))}
            <Button size="sm" className="text-xs h-8 bg-[#13b5c1] hover:bg-[#0fa3ae] text-white mt-1" disabled>
              <Wallet className="w-3 h-3 mr-1" /> Write
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// ADDRESS DETAIL PAGE (Enhanced with Token Holdings, NFT, Read/Write Contract)
// ============================================================================
function AddressDetailPage({ address }: { address: string }) {
  const { balance, txCount, loading, error } = useAddress(address);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loadingTxs, setLoadingTxs] = useState(true);
  const [tab, setTab] = useState('transactions');
  const [txTab, setTxTab] = useState('all');
  const [page, setPage] = useState(1);
  const perPage = 50;
  const [verifiedContract, setVerifiedContract] = useState<{
    name: string; compiler: string; version: string; optimization: number;
    sourceCode: string; abi: unknown; createdAt: string;
  } | null>(null);
  const [loadingContract, setLoadingContract] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loadingToken, setLoadingToken] = useState(true);
  const [isContract, setIsContract] = useState(false);

  useEffect(() => {
    if (!address) return;
    setLoadingContract(true);
    const timer = setTimeout(() => {
      const stored = getVerifiedContract(address);
      if (stored) setVerifiedContract(stored);
      setLoadingContract(false);
    }, 50);
    return () => clearTimeout(timer);
  }, [address]);

  useEffect(() => {
    if (!address) return;
    setLoadingToken(true);
    // Check if contract
    rpcCall('eth_getCode', [address, 'latest']).then((code) => {
      if (code && code !== '0x' && code !== '0x0') {
        setIsContract(true);
        // Check known tokens first
        const known = getDiscoveredTokens()[address.toLowerCase()];
        if (known) {
          setTokenInfo(known);
          setLoadingToken(false);
        } else {
          detectToken(address).then((t) => {
            if (t) setTokenInfo(t);
            setLoadingToken(false);
          }).catch(() => setLoadingToken(false));
        }
      } else {
        setIsContract(false);
        setLoadingToken(false);
      }
    }).catch(() => setLoadingToken(false));
  }, [address]);

  useEffect(() => {
    if (txCount === null) return;
    let mounted = true;
    const fetchAddressTxs = async () => {
      setLoadingTxs(true);
      const latestHex = await rpcCall('eth_blockNumber');
      const latestBlock = hexToNumber(latestHex);
      const allTxRows: TxRow[] = [];
      const startBlock = latestBlock - (page - 1) * 5;

      for (let b = startBlock; b >= 0 && b > startBlock - 5; b--) {
        if (allTxRows.length >= perPage) break;
        try {
          const hexBlock = `0x${b.toString(16)}`;
          const fullBlock = await rpcCall('eth_getBlockByNumber', [hexBlock, true]);
          if (!fullBlock || !fullBlock.transactions) continue;
          const txArray = Array.isArray(fullBlock.transactions) ? fullBlock.transactions : [fullBlock.transactions];
          const timestamp = hexToNumber(fullBlock.timestamp) * 1000;
          for (const txObj of txArray) {
            if (allTxRows.length >= perPage * 2) break;
            try {
              const hash = typeof txObj === 'string' ? txObj : txObj.hash;
              const [txData, receiptData] = await Promise.all([
                rpcCall('eth_getTransactionByHash', [hash]),
                rpcCall('eth_getTransactionReceipt', [hash]),
              ]);
              if (txData && (txData.from?.toLowerCase() === address.toLowerCase() || txData.to?.toLowerCase() === address.toLowerCase())) {
                allTxRows.push(buildTxRow(txData, receiptData, timestamp));
              }
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }
      return allTxRows;
    };

    fetchAddressTxs().then((data) => {
      if (mounted) { setTransactions(data); setLoadingTxs(false); }
    });
    return () => { mounted = false; };
  }, [address, txCount, page]);

  const filteredTxs = useMemo(() => {
    if (txTab === 'sent') return transactions.filter((tx) => tx.from.toLowerCase() === address.toLowerCase());
    if (txTab === 'received') return transactions.filter((tx) => tx.to?.toLowerCase() === address.toLowerCase());
    return transactions;
  }, [transactions, txTab, address]);

  if (loading) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;

  if (error) {
    return (
      <Card className="border border-gray-200">
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
          <p className="text-gray-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const overviewItems = [
    {
      label: 'Address',
      value: (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-mono text-xs">{address}</span>
          <CopyButton text={address} />
        </div>
      ),
    },
    {
      label: 'Balance',
      value: (
        <span className="font-mono text-sm font-semibold">
          {balance ? weiToExe(balance) : '0'} {NATIVE_TOKEN}
        </span>
      ),
    },
    {
      label: 'Transactions',
      value: <span className="font-mono text-sm">{txCount ?? '--'}</span>,
    },
    ...(isContract ? [{
      label: 'Contract',
      value: <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[11px]"><Cuboid className="w-3 h-3 mr-1" />Smart Contract</Badge>,
    }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Token Info Card */}
      {tokenInfo && <TokenInfoCard token={tokenInfo} />}

      {/* Overview */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
            Address Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            {overviewItems.map((item, i) => (
              <div key={item.label}
                className={`flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 px-4 py-3 ${
                  i % 2 === 0 ? 'bg-gray-50/60' : 'bg-white'
                } ${i < overviewItems.length - 1 ? 'border-b border-gray-100' : ''}`}>
                <span className="text-xs text-gray-500 font-medium shrink-0 w-40">{item.label}</span>
                <span className="text-sm">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <Card className="border border-gray-200">
          <CardHeader>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="transactions"><FileText className="w-4 h-4 mr-1.5" />Transactions</TabsTrigger>
              <TabsTrigger value="token-holdings"><Coins className="w-4 h-4 mr-1.5" />Token Holdings</TabsTrigger>
              {tokenInfo && tokenInfo.type === 'ERC20' && (
                <TabsTrigger value="token-transfers"><ArrowLeftRight className="w-4 h-4 mr-1.5" />Token Transfers</TabsTrigger>
              )}
              <TabsTrigger value="nft-holdings"><Image className="w-4 h-4 mr-1.5" />NFT Holdings</TabsTrigger>
              <TabsTrigger value="contract"><FileCode2 className="w-4 h-4 mr-1.5" />Contract</TabsTrigger>
              {verifiedContract?.abi && (
                <TabsTrigger value="read-contract"><BookOpen className="w-4 h-4 mr-1.5" />Read Contract</TabsTrigger>
              )}
              {verifiedContract?.abi && (
                <TabsTrigger value="write-contract"><PenTool className="w-4 h-4 mr-1.5" />Write Contract</TabsTrigger>
              )}
            </TabsList>
          </CardHeader>
        </Card>

        <TabsContent value="transactions">
          <Card className="border border-gray-200">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />Transactions
                </CardTitle>
                <Tabs value={txTab} onValueChange={setTxTab}>
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="sent">Sent</TabsTrigger>
                    <TabsTrigger value="received">Received</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <TransactionsTable transactions={filteredTxs} loading={loadingTxs} />
              </div>
            </CardContent>
          </Card>
          <SimplePagination currentPage={page} totalPages={100} onPageChange={setPage} />
        </TabsContent>

        <TabsContent value="token-holdings">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
                <Coins className="w-4 h-4 text-gray-500" />
                ERC-20 Token Holdings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <TokenHoldingsTab address={address} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {tokenInfo && tokenInfo.type === 'ERC20' && (
          <TabsContent value="token-transfers">
            <Card className="border border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
                  <ArrowLeftRight className="w-4 h-4 text-gray-500" />
                  Token Transfers ({tokenInfo.symbol})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <TokenTransfersTab tokenAddress={address} decimals={tokenInfo.decimals} symbol={tokenInfo.symbol} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="nft-holdings">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
                <Image className="w-4 h-4 text-gray-500" />
                NFT Holdings (ERC-721)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <NFTHoldingsTab address={address} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contract">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />Contract
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingContract ? (
                <div className="space-y-3"><Skeleton className="h-5 w-48" /><Skeleton className="h-4 w-64" /><Skeleton className="h-[200px] w-full" /></div>
              ) : verifiedContract ? (
                <div className="space-y-5">
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-green-50/50 border-b border-gray-100">
                      <ShieldCheck className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-semibold text-green-700">✓ Contract Source Code Verified</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3 bg-gray-50/60 border-b border-gray-100">
                      <span className="text-xs text-gray-500 font-medium shrink-0 w-40">Contract Name</span>
                      <span className="text-sm font-semibold font-mono">{verifiedContract.name}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3 border-b border-gray-100">
                      <span className="text-xs text-gray-500 font-medium shrink-0 w-40">Compiler</span>
                      <span className="text-sm text-gray-700">{verifiedContract.compiler} {verifiedContract.version}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3 border-b border-gray-100">
                      <span className="text-xs text-gray-500 font-medium shrink-0 w-40">Optimization Enabled</span>
                      <span className="text-sm text-gray-700">{verifiedContract.optimization > 0 ? `Yes (${verifiedContract.optimization} runs)` : 'No'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3">
                      <span className="text-xs text-gray-500 font-medium shrink-0 w-40">Verified On</span>
                      <span className="text-sm text-gray-700">{verifiedContract.createdAt ? new Date(verifiedContract.createdAt).toLocaleString() : '--'}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Code2 className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Contract Source Code</span>
                      <CopyButton text={verifiedContract.sourceCode} />
                    </div>
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-[#f8f9fa]">
                      <pre className="p-4 overflow-x-auto max-h-[600px] overflow-y-auto text-sm font-mono leading-relaxed">
                        <code>{verifiedContract.sourceCode}</code>
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 mb-1 font-medium">Contract Source Code Not Verified</p>
                  <p className="text-sm text-gray-400 mb-5">Are you the contract creator? Verify and publish your source code to make it publicly available.</p>
                  <Button onClick={() => (window.location.hash = `#verify-contract?address=${address}`)}
                    className="bg-[#13b5c1] hover:bg-[#0fa3ae] text-white">
                    <ShieldCheck className="w-4 h-4 mr-2" />Verify & Publish Source Code
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {verifiedContract?.abi && (
          <TabsContent value="read-contract">
            <Card className="border border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
                  <BookOpen className="w-4 h-4 text-gray-500" />
                  Read Contract
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReadContractTab address={address} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {verifiedContract?.abi && (
          <TabsContent value="write-contract">
            <Card className="border border-gray-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
                  <PenTool className="w-4 h-4 text-gray-500" />
                  Write Contract
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WriteContractTab address={address} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ============================================================================
// TOKENS TRACKER PAGE
// ============================================================================
function TokensTrackerPage() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'symbol' | 'discovered'>('discovered');

  useEffect(() => {
    const discovered = getDiscoveredTokens();
    const erc20List = Object.values(discovered).filter(t => t.type === 'ERC20');
    setTokens(erc20List);
    setLoading(false);
  }, []);

  const sorted = useMemo(() => {
    return [...tokens].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'symbol') return a.symbol.localeCompare(b.symbol);
      return new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime();
    });
  }, [tokens, sortBy]);

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
              <Coins className="w-5 h-5 text-[#13b5c1]" />
              ERC-20 Token Tracker
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Sort by:</span>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discovered">Recently Added</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="symbol">Symbol</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={8} cols={5} />
          ) : sorted.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Coins className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium mb-1">No ERC-20 Tokens Discovered</p>
              <p className="text-sm">Tokens are automatically discovered when their contracts are interacted with</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">#</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Token</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Symbol</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Decimals</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right">Total Supply</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Contract</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((t, idx) => (
                  <TableRow key={t.address} className="text-sm hover:bg-gray-50/50">
                    <TableCell className="text-gray-400 text-xs">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TokenLogo symbol={t.symbol} address={t.address} size={24} />
                        <span className="font-medium text-gray-800 truncate max-w-[200px]">{t.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{t.symbol}</TableCell>
                    <TableCell className="font-mono text-xs">{t.decimals}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatTokenBalance(t.totalSupply, t.decimals)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button onClick={() => (window.location.hash = `#address/${t.address}`)}
                          className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                          {shortHash(t.address)}
                        </button>
                        <CopyButton text={t.address} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// NFT COLLECTIONS PAGE
// ============================================================================
function NFTCollectionsPage() {
  const [nfts, setNfts] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const discovered = getDiscoveredTokens();
    const erc721List = Object.values(discovered).filter(t => t.type === 'ERC721');
    setNfts(erc721List);
    setLoading(false);
  }, []);

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
            <Image className="w-5 h-5 text-[#13b5c1]" />
            NFT Collections (ERC-721)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="border border-gray-100"><CardContent className="p-0"><Skeleton className="h-32 w-full" /><Skeleton className="h-6 w-3/4 mx-3 mt-3" /><Skeleton className="h-4 w-1/2 mx-3 mt-2" /></CardContent></Card>
              ))}
            </div>
          ) : nfts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Image className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium mb-1">No NFT Collections Discovered</p>
              <p className="text-sm">NFT collections are automatically discovered when their contracts are interacted with</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {nfts.map((nft) => (
                <Card key={nft.address} className="border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => (window.location.hash = `#address/${nft.address}`)}>
                  <div className="h-36 bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative">
                    <TokenLogo symbol={nft.symbol} address={nft.address} size={64} />
                    <Badge className="absolute top-2 right-2 bg-purple-50 text-purple-700 border-purple-200 text-[10px]">ERC-721</Badge>
                  </div>
                  <CardContent className="p-3">
                    <h4 className="font-semibold text-sm truncate mb-0.5">{nft.name}</h4>
                    <p className="text-xs text-gray-500 mb-2">{nft.symbol}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">Supply: {BigInt(nft.totalSupply).toLocaleString()}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[10px] text-[#13b5c1]">{shortHash(nft.address)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// TOP ACCOUNTS PAGE
// ============================================================================
function TopAccountsPage() {
  const { blockNumber } = useLatestBlockNumber();
  const [accounts, setAccounts] = useState<{ address: string; balance: string; txCount: number; isContract: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'balance' | 'txCount'>('balance');

  useEffect(() => {
    if (blockNumber === null) return;
    let mounted = true;
    const fetchTopAccounts = async () => {
      setLoading(true);
      const addrMap = new Map<string, { balance: bigint; txCount: number; isContract: boolean }>();

      // Scan recent blocks to find unique addresses
      const blocksToScan = 20;
      const latest = blockNumber;
      for (let b = latest; b >= latest - blocksToScan && b >= 0; b--) {
        try {
          const hexBlock = `0x${b.toString(16)}`;
          const fullBlock = await rpcCall('eth_getBlockByNumber', [hexBlock, true]);
          if (!fullBlock || !fullBlock.transactions) continue;
          const txArray = Array.isArray(fullBlock.transactions) ? fullBlock.transactions : [fullBlock.transactions];
          for (const txObj of txArray) {
            const tx = txObj as RpcTransaction;
            if (!tx) continue;
            const addAddr = (addr: string) => {
              const key = addr.toLowerCase();
              if (!addrMap.has(key)) addrMap.set(key, { balance: 0n, txCount: 0, isContract: false });
              const existing = addrMap.get(key)!;
              existing.txCount += 1;
            };
            if (tx.from) addAddr(tx.from);
            if (tx.to) addAddr(tx.to);
            if (fullBlock.miner) addAddr(fullBlock.miner);
          }
        } catch { /* skip */ }
      }

      // Fetch balances for all found addresses
      const entries = Array.from(addrMap.entries());
      const balancePromises = entries.map(async ([addr]) => {
        try {
          const bal = await rpcCall('eth_getBalance', [addr, 'latest']);
          let isContract = false;
          try {
            const code = await rpcCall('eth_getCode', [addr, 'latest']);
            if (code && code !== '0x' && code !== '0x0') isContract = true;
          } catch { /* skip */ }
          return { address: addr, balance: BigInt(bal), ...addrMap.get(addr)!, isContract };
        } catch {
          return { address: addr, balance: 0n, ...addrMap.get(addr)!, isContract: false };
        }
      });

      const results = await Promise.all(balancePromises);
      if (mounted) {
        setAccounts(results);
        setLoading(false);
      }
    };
    fetchTopAccounts();
    return () => { mounted = false; };
  }, [blockNumber]);

  const sorted = useMemo(() => {
    return [...accounts].sort((a, b) => {
      if (sortBy === 'balance') return b.balance > a.balance ? 1 : -1;
      return b.txCount - a.txCount;
    });
  }, [accounts, sortBy]);

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
              <Trophy className="w-5 h-5 text-[#13b5c1]" />
              Top Accounts
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Sort by:</span>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balance">Balance</SelectItem>
                  <SelectItem value="txCount">Tx Count</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Top addresses discovered from recent blocks on {CHAIN_NAME}</p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={10} cols={5} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase w-12">#</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Address</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Type</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right">Balance</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase text-center">Tx Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.slice(0, 100).map((acc, idx) => {
                  const tokenInfo = getDiscoveredTokens()[acc.address.toLowerCase()];
                  return (
                    <TableRow key={acc.address} className="text-sm hover:bg-gray-50/50">
                      <TableCell className="text-gray-400 text-xs">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {tokenInfo && <TokenLogo symbol={tokenInfo.symbol} address={acc.address} size={20} />}
                          {acc.isContract && !tokenInfo && <Cuboid className="w-4 h-4 text-gray-400 shrink-0" />}
                          <button onClick={() => (window.location.hash = `#address/${acc.address}`)}
                            className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                            {shortHash(acc.address)}
                          </button>
                          <CopyButton text={acc.address} />
                        </div>
                      </TableCell>
                      <TableCell>
                        {acc.isContract ? (
                          <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px]">Contract</Badge>
                        ) : (
                          <Badge className="bg-gray-50 text-gray-600 border-gray-200 text-[10px]">EOA</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {weiToExe(`0x${acc.balance.toString(16)}`)} <span className="text-gray-400">{NATIVE_TOKEN}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center bg-gray-100 text-gray-700 text-xs rounded px-2 py-0.5 font-mono">
                          {acc.txCount}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// VERIFY CONTRACT PAGE
// ============================================================================
const SOLC_VERSIONS = [
  '0.8.24', '0.8.20', '0.8.17', '0.8.0',
  '0.7.6', '0.6.12', '0.5.17', '0.4.24',
];

function VerifyContractPage({ prefillAddress }: { prefillAddress?: string }) {
  const [address, setAddress] = useState(prefillAddress || '');
  const [contractName, setContractName] = useState('');
  const [compilerVersion, setCompilerVersion] = useState('0.8.24');
  const [optimizationUsed, setOptimizationUsed] = useState(true);
  const [optimizationRuns, setOptimizationRuns] = useState('200');
  const [constructorArguments, setConstructorArguments] = useState('');
  const [sourceCode, setSourceCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; details?: string[] } | null>(null);

  useEffect(() => {
    if (prefillAddress) setAddress(prefillAddress);
  }, [prefillAddress]);

  const handleVerify = async () => {
    if (!address.trim() || !contractName.trim() || !sourceCode.trim()) {
      setResult({ success: false, message: 'Please fill in all required fields (Address, Contract Name, Source Code).' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const addr = address.trim().toLowerCase();
      const deployedBytecode = await rpcCall('eth_getCode', [addr, 'latest']) as string;
      if (!deployedBytecode || deployedBytecode === '0x' || deployedBytecode === '0x0') {
        setResult({ success: false, message: 'No contract bytecode found at this address.' });
        setLoading(false);
        return;
      }

      let compiledBytecode = '';
      let compiledAbi: unknown[] = [];

      const versionMap: Record<string, string> = {
        '0.8.24': 'v0.8.24+commit.e11b9ed9',
        '0.8.20': 'v0.8.20+commit.a1b79de6',
        '0.8.17': 'v0.8.17+commit.8df45f5f',
        '0.8.0': 'v0.8.0+commit.c7dfd78e',
        '0.7.6': 'v0.7.6+commit.7338295f',
        '0.6.12': 'v0.6.12+commit.27d51765',
        '0.5.17': 'v0.5.17+commit.d19bba13',
        '0.4.24': 'v0.4.24+commit.e67f0147',
      };
      const binaryVersion = versionMap[compilerVersion] || `v${compilerVersion}+commit.unknown`;
      
      const compile = await loadSolc(binaryVersion);

      const solcInput = {
        language: 'Solidity',
        sources: { 'Contract.sol': { content: sourceCode } },
        settings: {
          outputSelection: { '*': { '*': ['*'] } },
          optimizer: { enabled: !!optimizationUsed, runs: optimizationRuns ? parseInt(optimizationRuns) : 200 },
        },
      };

      const inputJSON = JSON.stringify(solcInput);
      const output = JSON.parse(compile(inputJSON));

      if (output.errors) {
        const errors = output.errors.filter((e: { severity: string }) => e.severity === 'error');
        if (errors.length > 0) {
          setResult({ success: false, message: 'Compilation failed', details: errors.map((e: { formattedMessage?: string; message?: string }) => e.formattedMessage || e.message) });
          setLoading(false);
          return;
        }
      }

      const contractFile = output.contracts?.['Contract.sol'];
      if (!contractFile) {
        setResult({ success: false, message: 'No contracts found in source. Check your Solidity code.' });
        setLoading(false);
        return;
      }

      let targetContract = contractFile[contractName.trim()];
      if (!targetContract) {
        const contractKeys = Object.keys(contractFile);
        if (contractKeys.length === 0) {
          setResult({ success: false, message: `Contract "${contractName}" not found in compiled output.` });
          setLoading(false);
          return;
        }
        targetContract = contractFile[contractKeys[0]];
      }

      compiledBytecode = (targetContract as { evm?: { deployedBytecode?: { object?: string } } }).evm?.deployedBytecode?.object || '';
      compiledAbi = (targetContract as { abi?: unknown[] }).abi || [];

      if (!compiledBytecode) {
        setResult({ success: false, message: 'Compilation succeeded but no bytecode was produced.' });
        setLoading(false);
        return;
      }

      const normalizedDeployed = normalizeBytecode(deployedBytecode.toLowerCase());
      const normalizedCompiled = normalizeBytecode('0x' + compiledBytecode.toLowerCase());
      let fullCompiledBytecode = normalizedCompiled;
      if (constructorArguments && constructorArguments.trim()) {
        fullCompiledBytecode = normalizedCompiled + constructorArguments.trim().replace(/^0x/, '');
      }

      if (fullCompiledBytecode !== normalizedDeployed) {
        setResult({ success: false, message: 'Bytecode mismatch - the compiled bytecode does not match the on-chain bytecode.', details: [`Compiled length: ${fullCompiledBytecode.length}`, `Deployed length: ${normalizedDeployed.length}`] });
        setLoading(false);
        return;
      }

      saveVerifiedContract({
        address: addr, name: contractName.trim(), compiler: 'solc', version: output.version || compilerVersion,
        optimization: optimizationUsed ? (parseInt(optimizationRuns) || 200) : 0, sourceCode, abi: compiledAbi,
        bytecode: deployedBytecode, constructorArguments: constructorArguments.trim() || null,
        createdAt: new Date().toISOString(),
      });

      setResult({ success: true, message: 'Contract verified successfully! Source code published to local storage.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setResult({ success: false, message: `Verification error: ${msg}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
            <ShieldCheck className="w-5 h-5 text-[#13b5c1]" />
            Verify & Publish Contract Source Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-6">
            Verify and publish your contract source code on {CHAIN_NAME} Explorer. Verified contracts are stored in your browser&apos;s local storage.
          </p>
          <div className="space-y-2 mb-5">
            <Label htmlFor="vc-address" className="text-sm font-medium text-gray-700">Contract Address <span className="text-red-500">*</span></Label>
            <Input id="vc-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x..." className="font-mono text-sm" />
          </div>
          <div className="space-y-2 mb-5">
            <Label htmlFor="vc-name" className="text-sm font-medium text-gray-700">Contract Name <span className="text-red-500">*</span></Label>
            <Input id="vc-name" value={contractName} onChange={(e) => setContractName(e.target.value)} placeholder="MyToken" className="text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Compiler</Label>
              <Select value="solc" disabled><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="solc">Single part solc</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Compiler Version</Label>
              <Select value={compilerVersion} onValueChange={setCompilerVersion}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{SOLC_VERSIONS.map((v) => (<SelectItem key={v} value={v}>{v}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Optimization</Label>
              <div className="flex items-center gap-3">
                <Switch checked={optimizationUsed} onCheckedChange={setOptimizationUsed} />
                <span className="text-sm text-gray-600">{optimizationUsed ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
            {optimizationUsed && (
              <div className="space-y-2">
                <Label htmlFor="vc-runs" className="text-sm font-medium text-gray-700">Optimization Runs</Label>
                <Input id="vc-runs" type="number" value={optimizationRuns} onChange={(e) => setOptimizationRuns(e.target.value)} className="text-sm font-mono" />
              </div>
            )}
          </div>
          <div className="space-y-2 mb-5">
            <Label htmlFor="vc-constructor" className="text-sm font-medium text-gray-700">Constructor Arguments <span className="text-xs text-gray-400 font-normal ml-1">(ABI-encoded, optional)</span></Label>
            <Textarea id="vc-constructor" value={constructorArguments} onChange={(e) => setConstructorArguments(e.target.value)} placeholder="0x000000000000000000000000..." className="text-sm font-mono min-h-[80px]" rows={3} />
          </div>
          <div className="space-y-2 mb-6">
            <Label htmlFor="vc-source" className="text-sm font-medium text-gray-700">Source Code <span className="text-red-500">*</span></Label>
            <Textarea id="vc-source" value={sourceCode} onChange={(e) => setSourceCode(e.target.value)}
              placeholder="// SPDX-License-Identifier: MIT&#10;pragma solidity ^0.8.24;&#10;&#10;contract MyToken { ... }"
              className="text-sm font-mono min-h-[300px]" rows={16} />
          </div>
          {result && (
            <div className={`rounded-lg border p-4 mb-5 ${result.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <div className="flex items-start gap-2">
                {result.success ? <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
                <div>
                  <p className="text-sm font-medium">{result.message}</p>
                  {result.details && Array.isArray(result.details) && (
                    <ul className="mt-2 space-y-1">{result.details.map((d, i) => (<li key={i} className="text-xs text-red-600 font-mono break-all">• {d}</li>))}</ul>
                  )}
                </div>
              </div>
            </div>
          )}
          <Button onClick={handleVerify} disabled={loading || !address.trim() || !contractName.trim() || !sourceCode.trim()}
            className="bg-[#13b5c1] hover:bg-[#0fa3ae] text-white px-8">
            {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Verifying & Compiling...</>) : (<><ShieldCheck className="w-4 h-4 mr-2" />Verify & Publish</>)}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// INTERNAL TRANSACTIONS CARD
// ============================================================================
function InternalTransactionsCard({ txHash, blockNumber }: { txHash: string; blockNumber: number | null }) {
  const [traces, setTraces] = useState<{ from: string; to: string; value: string; type: string; index: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [traceAvailable, setTraceAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!txHash) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    setTraceAvailable(null);

    rpcCall('debug_traceTransaction', [txHash, { tracer: 'callTracer' }])
      .then((result) => {
        if (!mounted) return;
        setTraceAvailable(true);
        const calls: { from: string; to: string; value: string; type: string; index: number }[] = [];
        if (result && typeof result === 'object') {
          const extractCalls = (node: Record<string, unknown>, depth: number) => {
            if (node.to && node.from) {
              calls.push({
                from: node.from as string,
                to: node.to as string,
                value: (node.value as string) || '0x0',
                type: (node.type as string) || 'call',
                index: calls.length,
              });
            }
            if (Array.isArray(node.calls)) {
              for (const child of node.calls) {
                extractCalls(child as Record<string, unknown>, depth + 1);
              }
            }
          };
          extractCalls(result, 0);
        }
        setTraces(calls);
        setLoading(false);
      })
      .catch(() => {
        if (mounted) {
          setTraceAvailable(false);
          setLoading(false);
          setError('Debug API not available. Internal transaction tracing requires the debug_traceTransaction RPC endpoint to be enabled.');
        }
      });

    return () => { mounted = false; };
  }, [txHash]);

  return (
    <Card className="border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
          <ArrowLeftRight className="w-4 h-4 text-gray-500" />
          Internal Transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <TableSkeleton rows={3} cols={5} />
        ) : error || !traceAvailable ? (
          <div className="text-center py-6 text-gray-400">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{error || 'Internal transactions not available'}</p>
            <p className="text-xs mt-1 text-gray-300">The debug API (debug_traceTransaction) must be enabled on the node</p>
          </div>
        ) : traces.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <p className="text-sm">No internal transactions found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                <TableHead className="text-xs font-semibold text-gray-500 uppercase w-12">#</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase">Parent Txn Hash</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase">Block</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase">From</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase text-center">To</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right">Value</TableHead>
                <TableHead className="text-xs font-semibold text-gray-500 uppercase text-center">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {traces.map((trace, idx) => (
                <TableRow key={idx} className="text-sm">
                  <TableCell className="text-gray-400 text-xs">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button onClick={() => (window.location.hash = `#tx/${txHash}`)} className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                        {shortHash(txHash)}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {blockNumber !== null ? (
                      <button onClick={() => (window.location.hash = `#block/${blockNumber}`)} className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                        {blockNumber.toLocaleString()}
                      </button>
                    ) : '--'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <button onClick={() => (window.location.hash = `#address/${trace.from}`)} className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                        {shortHash(trace.from)}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => (window.location.hash = `#address/${trace.to}`)} className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                        {shortHash(trace.to)}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {weiToExe(trace.value) === '0' ? '0' : `${weiToExe(trace.value)}`} <span className="text-gray-400">{NATIVE_TOKEN}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">{trace.type}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// TOKEN TRANSFERS TAB
// ============================================================================
function TokenTransfersTab({ tokenAddress, decimals, symbol }: { tokenAddress: string; decimals: number; symbol: string }) {
  const [transfers, setTransfers] = useState<{ txHash: string; from: string; to: string; value: string; blockNumber: number; timestamp: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const perPage = 50;
  const [totalResults, setTotalResults] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    const fetchTransfers = async () => {
      try {
        const latestHex = await rpcCall('eth_blockNumber');
        const latestBlock = hexToNumber(latestHex);
        const fromBlock = latestBlock - 5000;

        const logs = await rpcCall('eth_getLogs', [{
          fromBlock: `0x${Math.max(0, fromBlock).toString(16)}`,
          toBlock: 'latest',
          address: tokenAddress,
          topics: [TRANSFER_EVENT_TOPIC],
        }]) as RpcLog[];

        if (!mounted) return;

        const allTransfers = (logs || [])
          .map((log) => ({
            txHash: log.transactionHash,
            from: topicToAddress(log.topics[1] || '0x'),
            to: topicToAddress(log.topics[2] || '0x'),
            value: log.data || '0x0',
            blockNumber: hexToNumber(log.blockNumber),
            timestamp: 0,
          }));

        setTotalResults(allTransfers.length);

        // Fetch timestamps for paged results
        const paged = allTransfers.slice((page - 1) * perPage, page * perPage);
        const blockNumbers = [...new Set(paged.map(t => t.blockNumber))];

        const blockTimestamps: Record<number, number> = {};
        await Promise.all(blockNumbers.map(async (bn) => {
          try {
            const block = await rpcCall('eth_getBlockByNumber', [`0x${bn.toString(16)}`, false]);
            if (block) blockTimestamps[bn] = hexToNumber(block.timestamp) * 1000;
          } catch { /* skip */ }
        }));

        if (mounted) {
          setTransfers(paged.map(t => ({ ...t, timestamp: blockTimestamps[t.blockNumber] || 0 })));
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Failed to fetch token transfers');
          setLoading(false);
        }
      }
    };

    fetchTransfers();
    return () => { mounted = false; };
  }, [tokenAddress, page]);

  if (loading) return <div className="py-8"><TableSkeleton rows={5} cols={5} /></div>;

  if (error) {
    return (
      <div className="text-center py-8 text-gray-400">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (transfers.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <ArrowLeftRight className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No token transfers found in the last 5000 blocks</p>
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
            <TableHead className="text-xs font-semibold text-gray-500 uppercase">TX Hash</TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase">Age</TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase">From</TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase text-center">To</TableHead>
            <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transfers.map((t, idx) => (
            <TableRow key={`${t.txHash}-${idx}`} className="text-sm">
              <TableCell>
                <button onClick={() => (window.location.hash = `#tx/${t.txHash}`)} className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                  {shortHash(t.txHash)}
                </button>
              </TableCell>
              <TableCell className="text-gray-500 text-xs whitespace-nowrap">
                {t.timestamp ? timeAgo(t.timestamp) : '--'}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <button onClick={() => (window.location.hash = `#address/${t.from}`)} className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                    {shortHash(t.from)}
                  </button>
                </div>
              </TableCell>
              <TableCell className="text-center">
                <button onClick={() => (window.location.hash = `#address/${t.to}`)} className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                  {shortHash(t.to)}
                </button>
              </TableCell>
              <TableCell className="text-right font-mono text-xs">
                {formatTokenBalance(t.value, decimals)} <span className="text-gray-400">{symbol}</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="mt-4">
        <SimplePagination currentPage={page} totalPages={Math.max(1, Math.ceil(totalResults / perPage))} onPageChange={setPage} />
      </div>
    </div>
  );
}

// ============================================================================
// PENDING TRANSACTIONS PAGE
// ============================================================================
function PendingTransactionsPage() {
  const [pendingTxs, setPendingTxs] = useState<{ from: string; to: string; value: string; gasPrice: string; nonce: number; hash: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchPending = useCallback(async () => {
    try {
      const result = await rpcCall('txpool_content');
      if (!result || typeof result !== 'object') {
        setPendingTxs([]);
        setError(null);
        return;
      }
      const txs: { from: string; to: string; value: string; gasPrice: string; nonce: number; hash: string }[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pool = result as Record<string, any>;
      for (const addr of Object.keys(pool)) {
        const pending = pool[addr]?.pending || {};
        const queued = pool[addr]?.queued || {};
        for (const nonceStr of Object.keys(pending)) {
          const tx = pending[nonceStr];
          txs.push({
            from: addr,
            to: tx.to || '0x',
            value: tx.value || '0x0',
            gasPrice: tx.gasPrice || '0x0',
            nonce: parseInt(nonceStr),
            hash: tx.hash || '',
          });
        }
        for (const nonceStr of Object.keys(queued)) {
          const tx = queued[nonceStr];
          txs.push({
            from: addr,
            to: tx.to || '0x',
            value: tx.value || '0x0',
            gasPrice: tx.gasPrice || '0x0',
            nonce: parseInt(nonceStr),
            hash: tx.hash || '',
          });
        }
      }
      setPendingTxs(txs);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError('TxPool API is not enabled on this node. Pending transactions require the --txpool.api flag on the Geth node.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
    const interval = setInterval(fetchPending, 5000);
    return () => clearInterval(interval);
  }, [fetchPending]);

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
              <Clock className="w-5 h-5 text-[#13b5c1]" />
              Pending Transactions
            </CardTitle>
            <div className="flex items-center gap-2">
              <button onClick={fetchPending} className="flex items-center gap-1 text-xs text-[#13b5c1] hover:text-[#0fa3ae]">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
              <span className="text-xs text-gray-400">Auto-refresh every 5s · Last: {lastRefresh.toLocaleTimeString()}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : error ? (
            <div className="text-center py-10 text-gray-400">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{error}</p>
            </div>
          ) : pendingTxs.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No pending transactions in the mempool</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">From</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase text-center">To</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right">Value</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase text-right">Gas Price</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase text-center">Nonce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingTxs.map((tx, idx) => (
                  <TableRow key={`${tx.from}-${tx.nonce}-${idx}`} className="text-sm">
                    <TableCell>
                      <button onClick={() => (window.location.hash = `#address/${tx.from}`)} className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                        {shortHash(tx.from)}
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      {tx.to && tx.to !== '0x' && tx.to !== '0x0000000000000000000000000000000000000000' ? (
                        <button onClick={() => (window.location.hash = `#address/${tx.to}`)} className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                          {shortHash(tx.to)}
                        </button>
                      ) : (
                        <span className="text-[11px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200">Contract Creation</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {weiToExe(tx.value)} <span className="text-gray-400">{NATIVE_TOKEN}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {weiToGwei(tx.gasPrice)} Gwei
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs">{tx.nonce}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// VERIFIED CONTRACTS LIST PAGE
// ============================================================================
function VerifiedContractsPage() {
  const [contracts, setContracts] = useState<VerifiedContractData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getVerifiedContracts();
    const list = Object.values(stored);
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setContracts(list);
    setLoading(false);
  }, []);

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
            <ShieldCheck className="w-5 h-5 text-[#13b5c1]" />
            Verified Contracts
          </CardTitle>
          <p className="text-xs text-gray-500 mt-1">All contracts with verified source code stored in your browser</p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : contracts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShieldCheck className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium mb-1">No Verified Contracts</p>
              <p className="text-sm">Contracts you verify will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase w-12">#</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Contract Name</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Address</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Compiler</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase text-center">Optimization</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Verified Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c, idx) => (
                  <TableRow key={c.address} className="text-sm hover:bg-gray-50/50">
                    <TableCell className="text-gray-400 text-xs">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Cuboid className="w-4 h-4 text-[#13b5c1] shrink-0" />
                        <span className="font-medium text-gray-800">{c.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button onClick={() => (window.location.hash = `#address/${c.address}`)} className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                          {shortHash(c.address)}
                        </button>
                        <CopyButton text={c.address} />
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-gray-600">{c.compiler} {c.version}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={c.optimization > 0 ? 'bg-green-50 text-green-700 border-green-200 text-[10px]' : 'bg-gray-50 text-gray-600 border-gray-200 text-[10px]'}>
                        {c.optimization > 0 ? `Yes (${c.optimization})` : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '--'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// BROADCAST TRANSACTION TOOL PAGE
// ============================================================================
function BroadcastTxnPage() {
  const [rawTx, setRawTx] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; txHash?: string } | null>(null);

  const handleBroadcast = async () => {
    if (!rawTx.trim()) {
      setResult({ success: false, message: 'Please enter a raw transaction hex.' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const hexInput = rawTx.trim().startsWith('0x') ? rawTx.trim() : `0x${rawTx.trim()}`;
      const txHash = await rpcCall('eth_sendRawTransaction', [hexInput]) as string;
      setResult({ success: true, message: 'Transaction broadcast successfully!', txHash });
    } catch (e) {
      setResult({ success: false, message: e instanceof Error ? e.message : 'Failed to broadcast transaction' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
            <Send className="w-5 h-5 text-[#13b5c1]" />
            Broadcast Transaction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">Broadcast a signed raw transaction to the {CHAIN_NAME} network.</p>
          <div className="space-y-2">
            <Label htmlFor="raw-tx" className="text-sm font-medium text-gray-700">Raw Transaction Hex</Label>
            <Textarea id="raw-tx" value={rawTx} onChange={(e) => setRawTx(e.target.value)}
              placeholder="0x02f8... (signed transaction hex)"
              className="text-sm font-mono min-h-[120px]" rows={6} />
          </div>
          <Button onClick={handleBroadcast} disabled={loading || !rawTx.trim()}
            className="bg-[#13b5c1] hover:bg-[#0fa3ae] text-white px-8">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Broadcasting...</> : <><Send className="w-4 h-4 mr-2" />Broadcast Transaction</>}
          </Button>
          {result && (
            <div className={`rounded-lg border p-4 ${result.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              <div className="flex items-start gap-2">
                {result.success ? <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
                <div>
                  <p className="text-sm font-medium">{result.message}</p>
                  {result.txHash && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-500">TX Hash:</span>
                      <button onClick={() => (window.location.hash = `#tx/${result.txHash}`)} className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                        {result.txHash}
                      </button>
                      <CopyButton text={result.txHash} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// UNIT CONVERTER TOOL PAGE
// ============================================================================
function UnitConverterPage() {
  const [wei, setWei] = useState('');
  const [gwei, setGwei] = useState('');
  const [exe, setExe] = useState('');

  const handleWeiChange = (val: string) => {
    setWei(val);
    if (val && !isNaN(Number(val))) {
      const weiVal = BigInt(val);
      setGwei((Number(weiVal) / 1e9).toString());
      setExe(weiToExe(`0x${weiVal.toString(16)}`));
    } else {
      setGwei('');
      setExe('');
    }
  };

  const handleGweiChange = (val: string) => {
    setGwei(val);
    if (val && !isNaN(Number(val))) {
      const weiVal = BigInt(Math.floor(Number(val) * 1e9));
      setWei(weiVal.toString());
      setExe(weiToExe(`0x${weiVal.toString(16)}`));
    } else {
      setWei('');
      setExe('');
    }
  };

  const handleExeChange = (val: string) => {
    setExe(val);
    if (val && !isNaN(Number(val))) {
      const parts = val.split('.');
      const intPart = BigInt(parts[0] || '0');
      let fracWei = 0n;
      if (parts[1]) {
        const frac = parts[1].padEnd(18, '0').slice(0, 18);
        fracWei = BigInt(frac);
      }
      const totalWei = intPart * 10n ** 18n + fracWei;
      setWei(totalWei.toString());
      setGwei((Number(totalWei) / 1e9).toString());
    } else {
      setWei('');
      setGwei('');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
            <ArrowUpDown className="w-5 h-5 text-[#13b5c1]" />
            Unit Converter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-gray-500">Convert between Wei, Gwei, and {NATIVE_TOKEN} units.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <Label htmlFor="wei-input" className="text-sm font-medium text-gray-700">Wei</Label>
              <Input id="wei-input" type="text" value={wei} onChange={(e) => handleWeiChange(e.target.value)}
                placeholder="1000000000000000000" className="font-mono text-sm" />
              <span className="text-[10px] text-gray-400">Smallest unit of {NATIVE_TOKEN}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gwei-input" className="text-sm font-medium text-gray-700">Gwei</Label>
              <Input id="gwei-input" type="text" value={gwei} onChange={(e) => handleGweiChange(e.target.value)}
                placeholder="1000000000" className="font-mono text-sm" />
              <span className="text-[10px] text-gray-400">Gigawei (1 Gwei = 10⁹ Wei)</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exe-input" className="text-sm font-medium text-gray-700">{NATIVE_TOKEN}</Label>
              <Input id="exe-input" type="text" value={exe} onChange={(e) => handleExeChange(e.target.value)}
                placeholder="1.0" className="font-mono text-sm" />
              <span className="text-[10px] text-gray-400">1 {NATIVE_TOKEN} = 10¹⁸ Wei</span>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <h4 className="text-xs font-semibold text-gray-600 mb-2">Common Conversions</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono text-gray-500">
              <div>1 Wei = 0.000000001 Gwei</div>
              <div>1 Gwei = 1,000,000,000 Wei</div>
              <div>1 {NATIVE_TOKEN} = 1,000,000,000 Gwei</div>
              <div>1 {NATIVE_TOKEN} = 10¹⁸ Wei</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// BYTECODE TO OPCODE DISASSEMBLER PAGE
// ============================================================================
function BytecodeToOpcodePage() {
  const [bytecode, setBytecode] = useState('');
  const [output, setOutput] = useState<{ offset: number; opcode: string; operand: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleDisassemble = () => {
    setError(null);
    if (!bytecode.trim()) {
      setError('Please enter bytecode.');
      return;
    }
    const hex = bytecode.trim();
    if (!/^0x[0-9a-fA-F]*$/.test(hex)) {
      setError('Invalid bytecode. Must be a hex string starting with 0x.');
      return;
    }
    try {
      const result = disassembleBytecode(hex);
      setOutput(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disassembly failed');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
            <Binary className="w-5 h-5 text-[#13b5c1]" />
            Bytecode to Opcode Disassembler
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">Disassemble EVM bytecode into human-readable opcodes.</p>
          <div className="space-y-2">
            <Label htmlFor="bytecode-input" className="text-sm font-medium text-gray-700">Bytecode (0x-prefixed)</Label>
            <Textarea id="bytecode-input" value={bytecode} onChange={(e) => setBytecode(e.target.value)}
              placeholder="0x6080604052..."
              className="text-sm font-mono min-h-[100px]" rows={4} />
          </div>
          <Button onClick={handleDisassemble} disabled={!bytecode.trim()}
            className="bg-[#13b5c1] hover:bg-[#0fa3ae] text-white px-8">
            <Binary className="w-4 h-4 mr-2" />Disassemble
          </Button>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">{error}</div>
          )}
          {output.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">{output.length} opcodes</span>
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => navigator.clipboard.writeText(output.map(l => `${l.offset.toString().padStart(6)} ${l.opcode.padEnd(20)} ${l.operand}`).join('\n'))}>
                  <Copy className="w-3 h-3 mr-1" />Copy All
                </Button>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-[#1e1e2e] max-h-[500px] overflow-y-auto">
                <pre className="p-4 text-sm font-mono leading-relaxed">
                  <code>
                    {output.map((line, idx) => (
                      <div key={idx} className="flex gap-4">
                        <span className="text-gray-500 select-none w-12 text-right shrink-0">{line.offset}</span>
                        <span className={line.opcode.startsWith('PUSH') ? 'text-yellow-300' : line.opcode === 'JUMPDEST' ? 'text-green-400' : ['STOP', 'RETURN', 'REVERT', 'INVALID', 'SELFDESTRUCT'].includes(line.opcode) ? 'text-red-400' : 'text-cyan-300'}>
                          {line.opcode}
                        </span>
                        {line.operand && <span className="text-gray-400">{line.operand.length > 40 ? line.operand.slice(0, 20) + '...' + line.operand.slice(-20) : line.operand}</span>}
                      </div>
                    ))}
                  </code>
                </pre>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Opcode Reference */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
            <BookOpen className="w-4 h-4 text-gray-500" />
            Common EVM Opcodes Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
            {[
              ['STOP', '0x00', 'Halts execution'],
              ['ADD / SUB / MUL / DIV', '0x01-0x04', 'Arithmetic ops'],
              ['LT / GT / EQ', '0x10-0x14', 'Comparison ops'],
              ['AND / OR / XOR / NOT', '0x16-0x19', 'Bitwise ops'],
              ['SHA3', '0x20', 'Keccak-256 hash'],
              ['ADDRESS / CALLER', '0x30/0x33', 'Context info'],
              ['CALLVALUE', '0x34', 'ETH value sent'],
              ['PUSH1 - PUSH32', '0x60-0x7f', 'Push N bytes'],
              ['DUP1 - DUP16', '0x80-0x8f', 'Duplicate stack'],
              ['SWAP1 - SWAP16', '0x90-0x9f', 'Swap stack items'],
              ['SLOAD / SSTORE', '0x54/0x55', 'Storage access'],
              ['MLOAD / MSTORE', '0x51/0x52', 'Memory access'],
              ['JUMP / JUMPI', '0x56/0x57', 'Control flow'],
              ['JUMPDEST', '0x5b', 'Jump target'],
              ['CALL', '0xf1', 'Message call'],
              ['DELEGATECALL', '0xf4', 'Delegate call'],
              ['STATICCALL', '0xfa', 'Static call'],
              ['CREATE / CREATE2', '0xf0/0xf5', 'Contract creation'],
              ['RETURN / REVERT', '0xf3/0xfd', 'Return output'],
              ['SELFDESTRUCT', '0xff', 'Destroy contract'],
              ['LOG0 - LOG4', '0xa0-0xa4', 'Event emission'],
            ].map(([op, code, desc]) => (
              <div key={op} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded border border-gray-100">
                <span className="text-gray-600 w-36 truncate">{op}</span>
                <span className="text-[#13b5c1]">{code}</span>
                <span className="text-gray-400 hidden sm:inline">- {desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// NETWORK STATISTICS / CHARTS PAGE
// ============================================================================
function NetworkChartsPage() {
  const [blockData, setBlockData] = useState<{ number: number; blockTime: number; gasUsed: number; gasLimit: number; txCount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchChart = async () => {
      try {
        const latestHex = await rpcCall('eth_blockNumber');
        const latestBlock = hexToNumber(latestHex);
        const blocks: { number: number; blockTime: number; gasUsed: number; gasLimit: number; txCount: number }[] = [];
        let prevTimestamp = 0;

        for (let i = 0; i < 50; i++) {
          const b = latestBlock - i;
          if (b < 0) break;
          try {
            const block = await rpcCall('eth_getBlockByNumber', [`0x${b.toString(16)}`, false]);
            if (block) {
              const ts = hexToNumber(block.timestamp) * 1000;
              blocks.push({
                number: b,
                blockTime: prevTimestamp > 0 ? Math.max(0, (ts - prevTimestamp) / 1000) : 0,
                gasUsed: hexToNumber(block.gasUsed),
                gasLimit: hexToNumber(block.gasLimit),
                txCount: block.transactions.length,
              });
              prevTimestamp = ts;
            }
          } catch { /* skip */ }
        }
        blocks.reverse();
        if (mounted) {
          setBlockData(blocks);
          setLoading(false);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    };
    fetchChart();
    return () => { mounted = false; };
  }, []);

  const chartData = blockData.map(b => ({
    block: b.number,
    blockTime: b.blockTime > 60 ? 0 : b.blockTime,
    gasUsed: Math.round((b.gasUsed / b.gasLimit) * 100),
    txCount: b.txCount,
  }));

  if (loading) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>;

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
            <BarChart3 className="w-5 h-5 text-[#13b5c1]" />
            Network Statistics
          </CardTitle>
          <p className="text-xs text-gray-500 mt-1">Data from the last 50 blocks on {CHAIN_NAME}</p>
        </CardHeader>
        <CardContent />
      </Card>

      {/* Block Time Distribution */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Clock className="w-4 h-4 text-gray-500" />
            Block Time Distribution (seconds)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="block" tick={{ fontSize: 10 }} tickFormatter={(v) => `#${v}`} />
                <YAxis tick={{ fontSize: 10 }} label={{ value: 'seconds', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(value: number) => [`${value}s`, 'Block Time']}
                  labelFormatter={(label) => `Block #${label}`}
                />
                <Bar dataKey="blockTime" fill="#13b5c1" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.blockTime > 10 ? '#ef4444' : entry.blockTime > 5 ? '#f59e0b' : '#13b5c1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Gas Usage Trend */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <Fuel className="w-4 h-4 text-gray-500" />
            Gas Usage Trend (% of Gas Limit)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="block" tick={{ fontSize: 10 }} tickFormatter={(v) => `#${v}`} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} label={{ value: '%', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(value: number) => [`${value}%`, 'Gas Used']}
                  labelFormatter={(label) => `Block #${label}`}
                />
                <Line type="monotone" dataKey="gasUsed" stroke="#13b5c1" strokeWidth={2} dot={{ fill: '#13b5c1', r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Count per Block */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <FileText className="w-4 h-4 text-gray-500" />
            Transactions per Block
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="block" tick={{ fontSize: 10 }} tickFormatter={(v) => `#${v}`} />
                <YAxis tick={{ fontSize: 10 }} label={{ value: 'txns', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <RechartsTooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(value: number) => [`${value}`, 'Transactions']}
                  labelFormatter={(label) => `Block #${label}`}
                />
                <Bar dataKey="txCount" fill="#0d9488" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// VALIDATORS PAGE
// ============================================================================
function ValidatorsPage() {
  const [signers, setSigners] = useState<string[]>([]);
  const [signerStats, setSignerStats] = useState<{ address: string; blocksProposed: number; isCurrentSigner: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchValidators = async () => {
      try {
        const signerList = await rpcCall('clique_getSigners') as string[];
        if (!mounted) return;

        if (!Array.isArray(signerList) || signerList.length === 0) {
          setError('No validators found or clique_getSigners is not available on this node.');
          setLoading(false);
          return;
        }

        setSigners(signerList);

        // Scan recent 100 blocks to count proposals
        const latestHex = await rpcCall('eth_blockNumber');
        const latestBlock = hexToNumber(latestHex);
        const scanBlocks = Math.min(100, latestBlock);
        const statsMap = new Map<string, number>();

        for (let b = latestBlock; b >= latestBlock - scanBlocks && b >= 0; b--) {
          try {
            const block = await rpcCall('eth_getBlockByNumber', [`0x${b.toString(16)}`, false]);
            if (block && block.miner) {
              const key = block.miner.toLowerCase();
              statsMap.set(key, (statsMap.get(key) || 0) + 1);
            }
          } catch { /* skip */ }
        }

        // Get current signer (latest block miner)
        const latestBlockData = await rpcCall('eth_getBlockByNumber', [`0x${latestBlock.toString(16)}`, false]);
        const currentSigner = latestBlockData?.miner?.toLowerCase() || '';

        const stats = signerList.map(addr => ({
          address: addr,
          blocksProposed: statsMap.get(addr.toLowerCase()) || 0,
          isCurrentSigner: addr.toLowerCase() === currentSigner,
        }));

        stats.sort((a, b) => b.blocksProposed - a.blocksProposed);

        if (mounted) {
          setSignerStats(stats);
          setLoading(false);
        }
      } catch (e) {
        if (mounted) {
          setError('Failed to fetch validators. The clique_getSigners API may not be available.');
          setLoading(false);
        }
      }
    };

    fetchValidators();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
              <Landmark className="w-5 h-5 text-[#13b5c1]" />
              Validators (Signers)
            </CardTitle>
            <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-xs">
              {signerStats.length} Validator{signerStats.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <p className="text-xs text-gray-500 mt-1">Clique PoA validators on {CHAIN_NAME} · Block proposal stats from last 100 blocks</p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : error ? (
            <div className="text-center py-10 text-gray-400">
              <Landmark className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase w-12">#</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase">Signer Address</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase text-center">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-500 uppercase text-center">Proposed Blocks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signerStats.map((v, idx) => (
                  <TableRow key={v.address} className="text-sm hover:bg-gray-50/50">
                    <TableCell className="text-gray-400 text-xs">{idx + 1}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0" style={{ background: getGradientFromAddress(v.address) }}>
                          {idx + 1}
                        </div>
                        <button onClick={() => (window.location.hash = `#address/${v.address}`)} className="font-mono text-xs text-[#13b5c1] hover:text-[#0fa3ae] hover:underline">
                          {shortHash(v.address, 14, 6)}
                        </button>
                        <CopyButton text={v.address} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {v.isCurrentSigner ? (
                        <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                          <Zap className="w-3 h-3 mr-0.5" />Active
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-50 text-gray-500 border-gray-200 text-[10px]">Standby</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="inline-flex items-center justify-center bg-gray-100 text-gray-700 text-xs rounded px-2 py-0.5 font-mono min-w-[40px]">
                          {v.blocksProposed}
                        </span>
                        <Progress value={signerStats[0] ? (v.blocksProposed / signerStats[0].blocksProposed) * 100 : 0} className="h-2 w-20" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// FOOTER
// ============================================================================
function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-auto">
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#13b5c1] rounded-md flex items-center justify-center">
              <Cuboid className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-medium text-gray-600">{CHAIN_NAME} Explorer © 2024</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> Chain ID: {CHAIN_ID}</span>
            <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> Clique PoA</span>
            <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Powered by Geth</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================
type ViewType =
  | { page: 'home' }
  | { page: 'blocks' }
  | { page: 'txs' }
  | { page: 'block'; blockNumber: number }
  | { page: 'tx'; txHash: string }
  | { page: 'address'; address: string }
  | { page: 'verify-contract'; prefillAddress?: string }
  | { page: 'tokens' }
  | { page: 'nfts' }
  | { page: 'top-accounts' }
  | { page: 'pending-txs' }
  | { page: 'verified-contracts' }
  | { page: 'broadcast-txn' }
  | { page: 'unit-converter' }
  | { page: 'bytecode-to-opcode' }
  | { page: 'charts' }
  | { page: 'validators' };

function parseHash(hash: string): ViewType {
  if (!hash || hash === '#' || hash === '#home') return { page: 'home' };
  if (hash === '#blocks') return { page: 'blocks' };
  if (hash === '#txs') return { page: 'txs' };
  if (hash === '#tokens') return { page: 'tokens' };
  if (hash === '#nfts') return { page: 'nfts' };
  if (hash === '#top-accounts') return { page: 'top-accounts' };
  if (hash === '#pending-txs') return { page: 'pending-txs' };
  if (hash === '#verified-contracts') return { page: 'verified-contracts' };
  if (hash === '#broadcast-txn') return { page: 'broadcast-txn' };
  if (hash === '#unit-converter') return { page: 'unit-converter' };
  if (hash === '#bytecode-to-opcode') return { page: 'bytecode-to-opcode' };
  if (hash === '#charts') return { page: 'charts' };
  if (hash === '#validators') return { page: 'validators' };
  if (hash === '#verify-contract' || hash.startsWith('#verify-contract?')) {
    const addressMatch = hash.match(/[?&]address=(0x[a-fA-F0-9]+)/);
    return { page: 'verify-contract', prefillAddress: addressMatch ? addressMatch[1] : undefined };
  }
  const blockMatch = hash.match(/^#block\/(\d+)$/);
  if (blockMatch) return { page: 'block', blockNumber: parseInt(blockMatch[1]) };
  const txMatch = hash.match(/^#tx\/(0x[a-fA-F0-9]+)$/);
  if (txMatch) return { page: 'tx', txHash: txMatch[1] };
  const addressMatch = hash.match(/^#address\/(0x[a-fA-F0-9]+)$/);
  if (addressMatch) return { page: 'address', address: addressMatch[1] };
  return { page: 'home' };
}

export default function ExplorerApp() {
  const [view, setView] = useState<ViewType>({ page: 'home' });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Handle path-based URLs from wallets (e.g. TokenPocket)
    // /tx/0x... -> #tx/0x..., /address/0x... -> #address/0x..., /block/123 -> #block/123
    const pathname = window.location.pathname.replace(/\.html$/, '');
    const pathMappings: Record<string, (arg: string) => string> = {
      '/tx': (h) => `#tx/${h}`,
      '/address': (a) => `#address/${a}`,
      '/block': (n) => `#block/${n}`,
      '/block/:number': (n) => `#block/${n}`,
    };

    if (pathname && pathname !== '/' && !window.location.hash) {
      const segments = pathname.split('/').filter(Boolean);
      if (segments.length >= 2) {
        const route = `/${segments[0]}`;
        const param = segments.slice(1).join('/');
        if (route === '/tx' && /^0x[a-fA-F0-9]+$/.test(param)) {
          window.location.replace(`${window.location.pathname}#tx/${param}`);
          return;
        } else if (route === '/address' && /^0x[a-fA-F0-9]+$/.test(param)) {
          window.location.replace(`${window.location.pathname}#address/${param}`);
          return;
        } else if (route === '/block' && /^\d+$/.test(param)) {
          window.location.replace(`${window.location.pathname}#block/${param}`);
          return;
        }
      }
      // Single-segment paths like /blocks, /tokens, etc.
      const singlePathMap: Record<string, string> = {
        '/blocks': '#blocks',
        '/txs': '#txs',
        '/transactions': '#txs',
        '/tokens': '#tokens',
        '/nfts': '#nfts',
        '/top-accounts': '#top-accounts',
        '/pending-txs': '#pending-txs',
        '/pending': '#pending-txs',
        '/verified-contracts': '#verified-contracts',
        '/verified': '#verified-contracts',
        '/broadcast-txn': '#broadcast-txn',
        '/broadcast': '#broadcast-txn',
        '/unit-converter': '#unit-converter',
        '/converter': '#unit-converter',
        '/bytecode-to-opcode': '#bytecode-to-opcode',
        '/charts': '#charts',
        '/validators': '#validators',
        '/verify-contract': '#verify-contract',
        '/verify': '#verify-contract',
      };
      const hashTarget = singlePathMap[pathname];
      if (hashTarget) {
        window.location.replace(`${window.location.pathname}${hashTarget}`);
        return;
      }
    }

    const handleHashChange = () => {
      setView(parseHash(window.location.hash));
      setRefreshKey((k) => k + 1);
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = useCallback((hash: string) => {
    window.location.hash = hash;
  }, []);

  const pageTitle = useMemo(() => {
    switch (view.page) {
      case 'home': return `${CHAIN_NAME} Explorer`;
      case 'blocks': return `Blocks | ${CHAIN_NAME}`;
      case 'txs': return `Transactions | ${CHAIN_NAME}`;
      case 'block': return `Block #${view.blockNumber} | ${CHAIN_NAME}`;
      case 'tx': return `Transaction | ${CHAIN_NAME}`;
      case 'address': return `Address ${shortHash(view.address)} | ${CHAIN_NAME}`;
      case 'verify-contract': return `Verify Contract | ${CHAIN_NAME}`;
      case 'tokens': return `Tokens | ${CHAIN_NAME}`;
      case 'nfts': return `NFTs | ${CHAIN_NAME}`;
      case 'top-accounts': return `Top Accounts | ${CHAIN_NAME}`;
      case 'pending-txs': return `Pending Transactions | ${CHAIN_NAME}`;
      case 'verified-contracts': return `Verified Contracts | ${CHAIN_NAME}`;
      case 'broadcast-txn': return `Broadcast TXN | ${CHAIN_NAME}`;
      case 'unit-converter': return `Unit Converter | ${CHAIN_NAME}`;
      case 'bytecode-to-opcode': return `Bytecode to Opcode | ${CHAIN_NAME}`;
      case 'charts': return `Network Statistics | ${CHAIN_NAME}`;
      case 'validators': return `Validators | ${CHAIN_NAME}`;
    }
  }, [view]);

  useEffect(() => { document.title = pageTitle; }, [pageTitle]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <TooltipProvider>
        <Navbar onNavigate={handleNavigate} />
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 py-6" key={refreshKey}>
          {view.page === 'home' && <HomePage onNavigate={handleNavigate} />}
          {view.page === 'blocks' && <BlocksListPage />}
          {view.page === 'txs' && <TransactionsListPage />}
          {view.page === 'block' && <BlockDetailPage blockNumber={view.blockNumber} />}
          {view.page === 'tx' && <TransactionDetailPage txHash={view.txHash} />}
          {view.page === 'address' && <AddressDetailPage address={view.address} />}
          {view.page === 'verify-contract' && <VerifyContractPage prefillAddress={view.prefillAddress} />}
          {view.page === 'tokens' && <TokensTrackerPage />}
          {view.page === 'nfts' && <NFTCollectionsPage />}
          {view.page === 'top-accounts' && <TopAccountsPage />}
          {view.page === 'pending-txs' && <PendingTransactionsPage />}
          {view.page === 'verified-contracts' && <VerifiedContractsPage />}
          {view.page === 'broadcast-txn' && <BroadcastTxnPage />}
          {view.page === 'unit-converter' && <UnitConverterPage />}
          {view.page === 'bytecode-to-opcode' && <BytecodeToOpcodePage />}
          {view.page === 'charts' && <NetworkChartsPage />}
          {view.page === 'validators' && <ValidatorsPage />}
        </main>
        <Footer />
      </TooltipProvider>
    </div>
  );
}

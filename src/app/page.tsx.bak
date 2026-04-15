'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// solc is loaded dynamically from CDN to avoid bundling issues in static export
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
  ShieldCheck, FileCode2, Loader2, Code2,
} from 'lucide-react';
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

// ============================================================================
// LOCALSTORAGE VERIFIED CONTRACTS
// ============================================================================
const LS_KEY = 'exechain_verified_contracts';

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

// Normalize bytecode for comparison (remove library placeholders)
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
                const cb = (_filename: string, contents: string) => contents;
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

function navigateTo(hash: string) {
  window.location.hash = hash;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => { /* ignore */ });
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
  logs: unknown[];
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
    const knownMethods: Record<string, string> = {
      '0xa9059cbb': 'Transfer',
      '0x095ea7b3': 'Approve',
      '0x23b872dd': 'TransferFrom',
      '0x38ed1739': 'Swap',
      '0x7ff36ab5': 'SwapExactETH',
      '0x18cbafe5': 'SwapExactTokens',
      '0xe8e33700': 'AddLiquidity',
      '0xf305d719': 'AddLiquidityETH',
      '0x2e1a7d4d': 'Withdraw',
      '0xd0e30db0': 'Deposit',
    };
    method = knownMethods[sig] || `${sig}`;
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
// NAVBAR
// ============================================================================
function Navbar({ onNavigate }: { onNavigate: (hash: string) => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('all');
  const searchRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback(() => {
    if (!searchInput.trim()) return;
    const parsed = parseSearchInput(searchInput);
    const type = detectSearchType(parsed);

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

  return (
    <header className="sticky top-0 z-50 bg-[#13b5c1] shadow-md">
      <div className="max-w-[1400px] mx-auto px-4">
        <div className="flex items-center h-16 gap-4">
          {/* Logo */}
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
          <nav className="hidden md:flex items-center gap-1 ml-2">
            <button
              onClick={() => onNavigate('#home')}
              className="px-3 py-2 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded-md transition-colors flex items-center gap-1.5"
            >
              <Home className="w-4 h-4" />
              Home
            </button>
            <button
              onClick={() => onNavigate('#blocks')}
              className="px-3 py-2 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded-md transition-colors flex items-center gap-1.5"
            >
              <Blocks className="w-4 h-4" />
              Blocks
            </button>
            <button
              onClick={() => onNavigate('#txs')}
              className="px-3 py-2 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded-md transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              Transactions
            </button>
            <button
              onClick={() => onNavigate('#verify-contract')}
              className="px-3 py-2 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded-md transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              Verify Contract
            </button>
          </nav>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl mx-auto flex">
            <div className="flex w-full bg-white rounded-lg overflow-hidden shadow-sm">
              <Select value={searchFilter} onValueChange={setSearchFilter}>
                <SelectTrigger className="w-auto border-0 rounded-none bg-gray-50 border-r text-xs text-gray-600 h-10 min-w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Filters</SelectItem>
                  <SelectItem value="blocks">Blocks</SelectItem>
                  <SelectItem value="transactions">Transactions</SelectItem>
                  <SelectItem value="addresses">Addresses</SelectItem>
                </SelectContent>
              </Select>
              <Input
                ref={searchRef}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by Address / Txn Hash / Block"
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
            className="md:hidden text-white p-2"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-3 border-t border-white/20 mt-1 pt-2">
            <nav className="flex flex-col gap-1">
              <button
                onClick={() => { onNavigate('#home'); setMobileMenuOpen(false); }}
                className="px-3 py-2 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded-md text-left transition-colors flex items-center gap-2"
              >
                <Home className="w-4 h-4" /> Home
              </button>
              <button
                onClick={() => { onNavigate('#blocks'); setMobileMenuOpen(false); }}
                className="px-3 py-2 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded-md text-left transition-colors flex items-center gap-2"
              >
                <Blocks className="w-4 h-4" /> Blocks
              </button>
              <button
                onClick={() => { onNavigate('#txs'); setMobileMenuOpen(false); }}
                className="px-3 py-2 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded-md text-left transition-colors flex items-center gap-2"
              >
                <FileText className="w-4 h-4" /> Transactions
              </button>
              <button
                onClick={() => { onNavigate('#verify-contract'); setMobileMenuOpen(false); }}
                className="px-3 py-2 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded-md text-left transition-colors flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" /> Verify Contract
              </button>
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
function GasTracker() {
  const [gasPrice, setGasPrice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchGas = async () => {
      try {
        const price = await rpcCall('eth_gasPrice');
        if (mounted) setGasPrice(price);
      } catch { /* ignore */ }
    };
    fetchGas();
    const interval = setInterval(fetchGas, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const gwei = gasPrice ? weiToGwei(gasPrice) : '--';
  const slow = gasPrice ? (Number(gwei) * 0.8).toFixed(2) : '--';
  const fast = gasPrice ? (Number(gwei) * 1.2).toFixed(2) : '--';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium uppercase tracking-wide">
        <Fuel className="w-3.5 h-3.5" />
        Gas Tracker
      </div>
      <div className="flex items-center gap-3">
        <div className="text-center">
          <div className="text-[10px] text-gray-400 uppercase">Slow</div>
          <div className="text-sm font-mono font-semibold text-gray-700">{slow}</div>
          <div className="text-[10px] text-gray-400">Gwei</div>
        </div>
        <div className="h-6 w-px bg-gray-200" />
        <div className="text-center">
          <div className="text-[10px] text-[#13b5c1] uppercase font-medium">Standard</div>
          <div className="text-sm font-mono font-bold text-[#13b5c1]">{gwei}</div>
          <div className="text-[10px] text-gray-400">Gwei</div>
        </div>
        <div className="h-6 w-px bg-gray-200" />
        <div className="text-center">
          <div className="text-[10px] text-gray-400 uppercase">Fast</div>
          <div className="text-sm font-mono font-semibold text-gray-700">{fast}</div>
          <div className="text-[10px] text-gray-400">Gwei</div>
        </div>
      </div>
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
                  onClick={() => navigateTo(`#block/${block.number}`)}
                  className="text-[#13b5c1] hover:text-[#0fa3ae] hover:underline"
                >
                  {block.number.toLocaleString()}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <Blocks className="w-4 h-4 text-gray-400 shrink-0" />
                  <button
                    onClick={() => navigateTo(`#block/${block.number}`)}
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
                onClick={() => navigateTo(`#block/${block.number}`)}
                className="inline-flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded px-2 py-0.5 font-mono transition-colors"
              >
                {block.txCount}
                <ArrowRight className="w-3 h-3 ml-1 text-gray-400" />
              </button>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => navigateTo(`#address/${block.miner}`)}
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
                  onClick={() => navigateTo(`#tx/${tx.hash}`)}
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
                onClick={() => navigateTo(`#block/${tx.blockNumber}`)}
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
                  onClick={() => navigateTo(`#address/${tx.from}`)}
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
                    onClick={() => navigateTo(`#address/${tx.to}`)}
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

        // Get all tx hashes from all blocks
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

        // Fetch tx details and receipts
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

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  // Re-fetch on tick change
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
      {/* Stats Bar */}
      <StatsBar blockNumber={blockNumber} />

      {/* Gas Tracker */}
      <Card className="border border-gray-200">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <GasTracker />
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" />
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Latest Blocks */}
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

      {/* Latest Transactions */}
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
      {/* Overview */}
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
                      onClick={() => navigateTo(`#address/${item.value}`)}
                      className="text-[#13b5c1] hover:text-[#0fa3ae] hover:underline text-xs"
                    >
                      {item.value}
                    </button>
                  ) : item.blockHash ? (
                    <button
                      onClick={() => navigateTo(`#block/${hexToNumber(item.value)}`)}
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

      {/* Transactions */}
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
          const txArray = Array.isArray(fullBlock.transactions)
            ? fullBlock.transactions
            : [fullBlock.transactions];
          const timestamp = hexToNumber(fullBlock.timestamp) * 1000;

          for (const txHashOrObj of txArray) {
            if (allTxRows.length >= perPage) break;
            try {
              const hash = typeof txHashOrObj === 'string' ? txHashOrObj : txHashOrObj.hash;
              const [txData, receiptData] = await Promise.all([
                rpcCall('eth_getTransactionByHash', [hash]),
                rpcCall('eth_getTransactionReceipt', [hash]),
              ]);
              if (txData) {
                allTxRows.push(buildTxRow(txData, receiptData, timestamp));
              }
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }
      return allTxRows;
    };

    fetchTxs().then((data) => {
      if (mounted) {
        setTransactions(data);
        setLoading(false);
      }
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
// TRANSACTION DETAIL PAGE
// ============================================================================
function TransactionDetailPage({ txHash }: { txHash: string }) {
  const { tx, receipt, loading, error } = useTransaction(txHash);
  const [blockTimestamp, setBlockTimestamp] = useState<number | null>(null);

  useEffect(() => {
    if (!tx?.blockNumber) return;
    rpcCall('eth_getBlockByNumber', [tx.blockNumber, false])
      .then((block) => {
        if (block) setBlockTimestamp(hexToNumber(block.timestamp) * 1000);
      })
      .catch(() => {});
  }, [tx?.blockNumber]);

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

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
        <button
          onClick={() => navigateTo(`#block/${hexToNumber(tx.blockNumber)}`)}
          className="text-[#13b5c1] hover:text-[#0fa3ae] hover:underline font-mono text-xs"
        >
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
          <button
            onClick={() => navigateTo(`#address/${tx.from}`)}
            className="text-[#13b5c1] hover:text-[#0fa3ae] hover:underline font-mono text-xs"
          >
            {tx.from}
          </button>
          <CopyButton text={tx.from} />
        </div>
      ),
    },
    {
      label: 'To',
      value: isContractCreation ? (
        <span className="text-[11px] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200">
          Contract Creation
        </span>
      ) : tx.to ? (
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => navigateTo(`#address/${tx.to}`)}
            className="text-[#13b5c1] hover:text-[#0fa3ae] hover:underline font-mono text-xs"
          >
            {tx.to}
          </button>
          <CopyButton text={tx.to} />
        </div>
      ) : '--',
    },
    {
      label: 'Value',
      value: (
        <span className="font-mono text-sm">
          {weiToExe(tx.value)} {NATIVE_TOKEN}
        </span>
      ),
    },
    {
      label: 'Transaction Fee',
      value: (
        <span className="font-mono text-sm text-gray-600">
          {weiToExe(`0x${feeWei.toString(16)}`)} {NATIVE_TOKEN}
        </span>
      ),
    },
    {
      label: 'Gas Price',
      value: (
        <span className="font-mono text-sm">
          {weiToGwei(gasPrice)} Gwei ({weiToExe(gasPrice)} {NATIVE_TOKEN})
        </span>
      ),
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
          <span className="text-xs text-gray-400">
            ({((gasUsed / hexToNumber(tx.gas)) * 100).toFixed(1)}%)
          </span>
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
      {/* Overview */}
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
              <div
                key={item.label}
                className={`flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 px-4 py-3 ${
                  i % 2 === 0 ? 'bg-gray-50/60' : 'bg-white'
                } ${i < overviewItems.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span className="text-xs text-gray-500 font-medium shrink-0 w-48">
                  {item.label}
                </span>
                <span className="text-sm">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Internal Transactions */}
      <Card className="border border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
            Internal Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No internal transactions found</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// ADDRESS DETAIL PAGE
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

  // Fetch verified contract info from localStorage
  useEffect(() => {
    if (!address) return;
    setLoadingContract(true);
    // Use setTimeout to avoid blocking render
    const timer = setTimeout(() => {
      const stored = getVerifiedContract(address);
      if (stored) {
        setVerifiedContract(stored);
      }
      setLoadingContract(false);
    }, 50);
    return () => clearTimeout(timer);
  }, [address]);

  useEffect(() => {
    if (txCount === null) return;
    let mounted = true;

    // Scan recent blocks for transactions related to this address
    const fetchAddressTxs = async () => {
      setLoadingTxs(true);
      const latestHex = await rpcCall('eth_blockNumber');
      const latestBlock = hexToNumber(latestHex);
      const allTxRows: TxRow[] = [];
      const blocksToScan = 10 + (page - 1) * 5;
      const startBlock = latestBlock - (page - 1) * 5;

      for (let b = startBlock; b >= 0 && b > startBlock - 5; b--) {
        if (allTxRows.length >= perPage) break;
        try {
          const hexBlock = `0x${b.toString(16)}`;
          const fullBlock = await rpcCall('eth_getBlockByNumber', [hexBlock, true]);
          if (!fullBlock || !fullBlock.transactions) continue;
          const txArray = Array.isArray(fullBlock.transactions)
            ? fullBlock.transactions
            : [fullBlock.transactions];
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
      if (mounted) {
        setTransactions(data);
        setLoadingTxs(false);
      }
    });

    return () => { mounted = false; };
  }, [address, txCount, page]);

  const filteredTxs = useMemo(() => {
    if (txTab === 'sent') return transactions.filter((tx) => tx.from.toLowerCase() === address.toLowerCase());
    if (txTab === 'received') return transactions.filter((tx) => tx.to?.toLowerCase() === address.toLowerCase());
    return transactions;
  }, [transactions, txTab, address]);

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

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
  ];

  return (
    <div className="space-y-6">
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
              <div
                key={item.label}
                className={`flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 px-4 py-3 ${
                  i % 2 === 0 ? 'bg-gray-50/60' : 'bg-white'
                } ${i < overviewItems.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <span className="text-xs text-gray-500 font-medium shrink-0 w-40">
                  {item.label}
                </span>
                <span className="text-sm">{item.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Transactions / Contract */}
      <Tabs value={tab} onValueChange={setTab}>
        <Card className="border border-gray-200">
          <CardHeader>
            <TabsList>
              <TabsTrigger value="transactions">
                <FileText className="w-4 h-4 mr-1.5" />
                Transactions
              </TabsTrigger>
              <TabsTrigger value="contract">
                <FileCode2 className="w-4 h-4 mr-1.5" />
                Contract
              </TabsTrigger>
            </TabsList>
          </CardHeader>
        </Card>

        <TabsContent value="transactions">
          <Card className="border border-gray-200">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
                  Transactions
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

        <TabsContent value="contract">
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <span className="w-1 h-5 bg-[#13b5c1] rounded-full" />
                Contract
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingContract ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-[200px] w-full" />
                </div>
              ) : verifiedContract ? (
                <div className="space-y-5">
                  {/* Contract Info */}
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-green-50/50 border-b border-gray-100">
                      <ShieldCheck className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-semibold text-green-700">
                        ✓ Contract Source Code Verified
                      </span>
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
                      <span className="text-sm text-gray-700">
                        {verifiedContract.optimization > 0 ? `Yes (${verifiedContract.optimization} runs)` : 'No'}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3">
                      <span className="text-xs text-gray-500 font-medium shrink-0 w-40">Verified On</span>
                      <span className="text-sm text-gray-700">
                        {verifiedContract.createdAt ? new Date(verifiedContract.createdAt).toLocaleString() : '--'}
                      </span>
                    </div>
                  </div>

                  {/* Source Code */}
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
                  <p className="text-sm text-gray-400 mb-5">
                    Are you the contract creator? Verify and publish your source code to make it publicly available.
                  </p>
                  <Button
                    onClick={() => navigateTo(`#verify-contract?address=${address}`)}
                    className="bg-[#13b5c1] hover:bg-[#0fa3ae] text-white"
                  >
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Verify & Publish Source Code
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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

      // 1. Get deployed bytecode from chain via RPC
      const deployedBytecode = await rpcCall('eth_getCode', [addr, 'latest']) as string;
      if (!deployedBytecode || deployedBytecode === '0x' || deployedBytecode === '0x0') {
        setResult({ success: false, message: 'No contract bytecode found at this address.' });
        setLoading(false);
        return;
      }

      // 2. Load solc from CDN and compile source code
      let compiledBytecode = '';
      let compiledAbi: unknown[] = [];

      // Map solc version to the binary filename version
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
        sources: {
          'Contract.sol': {
            content: sourceCode,
          },
        },
        settings: {
          outputSelection: {
            '*': {
              '*': ['*'],
            },
          },
          optimizer: {
            enabled: !!optimizationUsed,
            runs: optimizationRuns ? parseInt(optimizationRuns) : 200,
          },
        },
      };

      const inputJSON = JSON.stringify(solcInput);
      const output = JSON.parse(compile(inputJSON));

      if (output.errors) {
        const errors = output.errors.filter((e: { severity: string }) => e.severity === 'error');
        if (errors.length > 0) {
          setResult({
            success: false,
            message: 'Compilation failed',
            details: errors.map((e: { formattedMessage?: string; message?: string }) => e.formattedMessage || e.message),
          });
          setLoading(false);
          return;
        }
      }

      // Find the contract in the output
      const contractFile = output.contracts?.['Contract.sol'];
      if (!contractFile) {
        setResult({ success: false, message: `No contracts found in source. Check your Solidity code.` });
        setLoading(false);
        return;
      }

      let targetContract = contractFile[contractName.trim()];
      if (!targetContract) {
        // Try to find any contract
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

      // 3. Normalize and compare bytecodes
      const normalizedDeployed = normalizeBytecode(deployedBytecode.toLowerCase());
      const normalizedCompiled = normalizeBytecode('0x' + compiledBytecode.toLowerCase());

      let fullCompiledBytecode = normalizedCompiled;
      if (constructorArguments && constructorArguments.trim()) {
        fullCompiledBytecode = normalizedCompiled + constructorArguments.trim().replace(/^0x/, '');
      }

      if (fullCompiledBytecode !== normalizedDeployed) {
        setResult({
          success: false,
          message: 'Bytecode mismatch - the compiled bytecode does not match the on-chain bytecode. Please check compiler version, optimization settings, and constructor arguments.',
          details: [
            `Compiled length: ${fullCompiledBytecode.length}`,
            `Deployed length: ${normalizedDeployed.length}`,
          ],
        });
        setLoading(false);
        return;
      }

      // 4. Save to localStorage
      saveVerifiedContract({
        address: addr,
        name: contractName.trim(),
        compiler: 'solc',
        version: output.version || compilerVersion,
        optimization: optimizationUsed ? (parseInt(optimizationRuns) || 200) : 0,
        sourceCode,
        abi: compiledAbi,
        bytecode: deployedBytecode,
        constructorArguments: constructorArguments.trim() || null,
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
            Verify and publish your contract source code on {CHAIN_NAME} Explorer. The compiled bytecode will be compared against the deployed bytecode on-chain. Verified contracts are stored in your browser's local storage.
          </p>

          {/* Contract Address */}
          <div className="space-y-2 mb-5">
            <Label htmlFor="vc-address" className="text-sm font-medium text-gray-700">
              Contract Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="vc-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="font-mono text-sm"
            />
          </div>

          {/* Contract Name */}
          <div className="space-y-2 mb-5">
            <Label htmlFor="vc-name" className="text-sm font-medium text-gray-700">
              Contract Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="vc-name"
              value={contractName}
              onChange={(e) => setContractName(e.target.value)}
              placeholder="MyToken"
              className="text-sm"
            />
          </div>

          {/* Compiler & Version row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Compiler</Label>
              <Select value="solc" disabled>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solc">Single part solc</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">Currently only solc (Single part) is supported</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Compiler Version</Label>
              <Select value={compilerVersion} onValueChange={setCompilerVersion}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOLC_VERSIONS.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Optimization */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Optimization</Label>
              <div className="flex items-center gap-3">
                <Switch
                  checked={optimizationUsed}
                  onCheckedChange={setOptimizationUsed}
                />
                <span className="text-sm text-gray-600">
                  {optimizationUsed ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
            {optimizationUsed && (
              <div className="space-y-2">
                <Label htmlFor="vc-runs" className="text-sm font-medium text-gray-700">
                  Optimization Runs
                </Label>
                <Input
                  id="vc-runs"
                  type="number"
                  value={optimizationRuns}
                  onChange={(e) => setOptimizationRuns(e.target.value)}
                  className="text-sm font-mono"
                />
              </div>
            )}
          </div>

          {/* Constructor Arguments */}
          <div className="space-y-2 mb-5">
            <Label htmlFor="vc-constructor" className="text-sm font-medium text-gray-700">
              Constructor Arguments
              <span className="text-xs text-gray-400 font-normal ml-1">(ABI-encoded, optional)</span>
            </Label>
            <Textarea
              id="vc-constructor"
              value={constructorArguments}
              onChange={(e) => setConstructorArguments(e.target.value)}
              placeholder="0x000000000000000000000000..."
              className="text-sm font-mono min-h-[80px]"
              rows={3}
            />
          </div>

          {/* Source Code */}
          <div className="space-y-2 mb-6">
            <Label htmlFor="vc-source" className="text-sm font-medium text-gray-700">
              Source Code <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="vc-source"
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              placeholder="// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MyToken { ... }"
              className="text-sm font-mono min-h-[300px]"
              rows={16}
            />
          </div>

          {/* Result Messages */}
          {result && (
            <div className={`rounded-lg border p-4 mb-5 ${
              result.success
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium">{result.message}</p>
                  {result.details && Array.isArray(result.details) && (
                    <ul className="mt-2 space-y-1">
                      {result.details.map((d, i) => (
                        <li key={i} className="text-xs text-red-600 font-mono break-all">• {d}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Verify Button */}
          <Button
            onClick={handleVerify}
            disabled={loading || !address.trim() || !contractName.trim() || !sourceCode.trim()}
            className="bg-[#13b5c1] hover:bg-[#0fa3ae] text-white px-8"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying & Compiling...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 mr-2" />
                Verify & Publish
              </>
            )}
          </Button>
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
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" /> Chain ID: {CHAIN_ID}
            </span>
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3" /> Clique PoA
            </span>
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" /> Powered by Geth
            </span>
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
  | { page: 'verify-contract'; prefillAddress?: string };

function parseHash(hash: string): ViewType {
  if (!hash || hash === '#' || hash === '#home') return { page: 'home' };
  if (hash === '#blocks') return { page: 'blocks' };
  if (hash === '#txs') return { page: 'txs' };
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
    const handleHashChange = () => {
      const hash = window.location.hash;
      setView(parseHash(hash));
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
    }
  }, [view]);

  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

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
        </main>
        <Footer />
      </TooltipProvider>
    </div>
  );
}

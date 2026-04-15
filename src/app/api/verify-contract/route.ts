import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { VerifiedContract } from '@prisma/client';
import { execSync } from 'child_process';

const RPC_URL = 'https://rpc.exepc.top';

// Get deployed bytecode from chain
async function getDeployedBytecode(address: string): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getCode',
      params: [address, 'latest'],
      id: 1,
    }),
  });
  const json = await res.json();
  return (json.result as string) || '';
}

// Normalize bytecode for comparison (remove library placeholders)
function normalizeBytecode(code: string): string {
  if (!code || code === '0x') return '';
  return code.replace(/__\$[a-fA-F0-9]{34}\$__\$/g, '0'.repeat(40));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      address,
      sourceCode,
      contractName,
      compilerVersion,
      optimizationUsed,
      optimizationRuns,
      constructorArguments,
    } = body;

    if (!address || !sourceCode || !contractName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: address, sourceCode, contractName' },
        { status: 400 }
      );
    }

    const addr = address.toLowerCase();

    // 1. Get deployed bytecode from chain
    const deployedBytecode = await getDeployedBytecode(addr);
    if (!deployedBytecode || deployedBytecode === '0x' || deployedBytecode === '0x0') {
      return NextResponse.json(
        { success: false, error: 'No contract bytecode found at this address' },
        { status: 400 }
      );
    }

    // 2. Compile the source code using solc
    let compiledBytecode = '';
    let compiledAbi: any[] = [];
    let compiler = 'solc';
    let version = compilerVersion || '0.8.24';

    try {
      // Use solc-js for compilation
      const solc = require('solc');

      // Build solc input
      const input = {
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
            runs: optimizationRuns || 200,
          },
        },
      };

      const inputJSON = JSON.stringify(input);
      const output = JSON.parse(solc.compile(inputJSON));

      if (output.errors) {
        const errors = output.errors.filter((e: any) => e.severity === 'error');
        if (errors.length > 0) {
          return NextResponse.json({
            success: false,
            error: 'Compilation failed',
            details: errors.map((e: any) => e.formattedMessage || e.message),
          });
        }
      }

      // Find the contract in the output
      const contractFile = output.contracts?.['Contract.sol'];
      if (!contractFile || !contractFile[contractName]) {
        // Try to find any contract
        const allContracts = output.contracts?.['Contract.sol'] || {};
        const contractKeys = Object.keys(allContracts);
        if (contractKeys.length === 0) {
          return NextResponse.json({
            success: false,
            error: `Contract "${contractName}" not found in compiled output. Available: ${Object.keys(output.contracts || {}).join(', ')}`,
          });
        }
        // Use the first found contract
        const foundContract = allContracts[contractKeys[0]];
        compiledBytecode = foundContract.evm?.deployedBytecode?.object || '';
        compiledAbi = foundContract.abi || [];
      } else {
        compiledBytecode = contractFile[contractName].evm?.deployedBytecode?.object || '';
        compiledAbi = contractFile[contractName].abi || [];
      }

      if (!compiledBytecode) {
        return NextResponse.json({
          success: false,
          error: 'Compilation succeeded but no bytecode was produced',
        });
      }

      version = output.version || version;
    } catch (compileError: any) {
      return NextResponse.json({
        success: false,
        error: 'Compilation error: ' + compileError.message,
      });
    }

    // 3. Normalize and compare bytecodes
    const normalizedDeployed = normalizeBytecode(deployedBytecode.toLowerCase());
    const normalizedCompiled = normalizeBytecode('0x' + compiledBytecode.toLowerCase());

    // Append constructor arguments if provided
    let fullCompiledBytecode = normalizedCompiled;
    if (constructorArguments) {
      fullCompiledBytecode = normalizedCompiled + constructorArguments.replace(/^0x/, '');
    }

    const isMatch = fullCompiledBytecode === normalizedDeployed;

    if (!isMatch) {
      return NextResponse.json({
        success: false,
        error: 'Bytecode mismatch',
        details: 'The compiled bytecode does not match the on-chain bytecode. Please check compiler version, optimization settings, and constructor arguments.',
        compiledLength: fullCompiledBytecode.length,
        deployedLength: normalizedDeployed.length,
      });
    }

    // 4. Save to database
    const existing = await db.verifiedContract.findUnique({ where: { address: addr } });
    if (existing) {
      await db.verifiedContract.update({
        where: { address: addr },
        data: {
          name: contractName,
          compiler,
          version,
          optimization: optimizationUsed ? (optimizationRuns || 200) : 0,
          sourceCode,
          abi: JSON.stringify(compiledAbi),
          bytecode: deployedBytecode,
          constructorArguments: constructorArguments || null,
          isVerified: true,
        },
      });
    } else {
      await db.verifiedContract.create({
        data: {
          address: addr,
          name: contractName,
          compiler,
          version,
          optimization: optimizationUsed ? (optimizationRuns || 200) : 0,
          sourceCode,
          abi: JSON.stringify(compiledAbi),
          bytecode: deployedBytecode,
          constructorArguments: constructorArguments || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Contract verified successfully!',
      address: addr,
      contractName,
      compilerVersion: version,
    });
  } catch (error: any) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

// GET: retrieve verified contract
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      // Return all verified contracts
      const contracts = await db.verifiedContract.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      return NextResponse.json({ success: true, contracts });
    }

    const contract = await db.verifiedContract.findUnique({
      where: { address: address.toLowerCase() },
    });

    if (!contract) {
      return NextResponse.json({ success: false, error: 'Contract not verified' });
    }

    return NextResponse.json({
      success: true,
      contract: {
        ...contract,
        abi: JSON.parse(contract.abi),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

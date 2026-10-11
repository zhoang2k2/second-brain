import { NextRequest } from 'next/server';
import { proxyToRuntime } from '../../../../src/lib/api/proxy';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyToRuntime(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyToRuntime(request, path);
}

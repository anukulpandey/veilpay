import type { PublicClient } from "viem";

/** getLogs in chunks so public RPC block-range caps don't bite. */
export async function getLogsChunked(
  client: PublicClient,
  params: {
    address: `0x${string}`;
    event: any;
    args?: Record<string, unknown>;
    fromBlock: bigint;
  },
  chunk = 2000n,
) {
  const latest = await client.getBlockNumber();
  const logs: any[] = [];
  for (let from = params.fromBlock; from <= latest; from += chunk + 1n) {
    const to = from + chunk > latest ? latest : from + chunk;
    logs.push(
      ...(await client.getLogs({
        address: params.address,
        event: params.event,
        args: params.args as any,
        fromBlock: from,
        toBlock: to,
      })),
    );
  }
  return logs;
}

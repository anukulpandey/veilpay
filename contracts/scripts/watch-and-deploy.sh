#!/bin/bash
# Polls the Fuji deployer balance; deploys the full VeilPay stack once funded.
set -e
export PATH="$HOME/.nvm/versions/node/v22.13.0/bin:$PATH"
cd "$(dirname "$0")/.."

ADDR=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(".fuji-keys.json")).deployer.address)')
RPC="https://api.avax-test.network/ext/bc/C/rpc"
NEED_WEI="500000000000000000" # 0.5 AVAX

echo "watching $ADDR on Fuji for >= 0.5 AVAX..."
for i in $(seq 1 480); do # up to 4 hours
  BAL=$(curl -s -X POST -H 'content-type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getBalance\",\"params\":[\"$ADDR\",\"latest\"]}" \
    "$RPC" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(BigInt(JSON.parse(d).result).toString())}catch{console.log(0)}})')
  if [ "$(echo "$BAL >= $NEED_WEI" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const [a,,b]=d.trim().split(" ");console.log(BigInt(a)>=BigInt(b)?1:0)})')" = "1" ]; then
    echo "funded! balance=$BAL wei — deploying..."
    npx hardhat run scripts/deploy.ts --network fuji
    npx hardhat run scripts/fund-demo.ts --network fuji
    (cd ../web && node scripts/sync.mjs && npx vite build)
    echo "FUJI DEPLOY COMPLETE"
    exit 0
  fi
  sleep 30
done
echo "timed out waiting for funds"
exit 1

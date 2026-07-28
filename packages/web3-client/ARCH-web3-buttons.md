# [ARCH] - Web3 Buttons

## Description

`Web3ConnectBtn` wraps actions that require a wallet connection. If disconnected, it shows a translated toast with a connect-wallet action and retries the click after connection. When `registerRequired` is set, it also compares the connected wallet against the registered onchain address for the current organization before running the action

## Behavior

- Connected: calls `onClick` directly
- Disconnected: shows a translated info toast with a connect action, opens the wallet-connect modal from the toast button, and retries once connected
- Registered flow: if `registerRequired` is passed, the button reads the organization wallet from chain and blocks the action with a translated mismatch toast when the connected wallet does not match

## Related files

- `<monorepo>/apps/app/src/components/Web3ConnectBtn/Web3ConnectBtn.tsx`
- `<monorepo>/packages/ui/src/components/sonner.tsx`

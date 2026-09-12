"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  WagmiProvider,
  useAccount,
  useConnect,
  useDisconnect,
  useSwitchChain,
  type Connector,
} from "wagmi";
import { FUND_CHAIN_ID, FUND_CHAIN_NAME, wagmiConfig } from "@/lib/wagmi";
import { WalletModal } from "./WalletModal";

export type Identity = {
  address: string;
  label: string;
  identityVerified: boolean;
  refusalReason?: string;
};

type WalletCtx = {
  // --- the real wallet -----------------------------------------------------
  address?: string;
  isConnected: boolean;
  connectorName: string | null;
  chainId?: number;
  /** connected, but to something other than the chain the fund is deployed on */
  wrongChain: boolean;
  connectors: readonly Connector[];
  connect: (connector: Connector) => void;
  disconnect: () => void;
  switchToFundChain: () => void;
  connecting: boolean;
  connectError: string | null;
  /** the wallet has neither answered nor refused for an unreasonable time */
  stalled: boolean;

  // --- the identity registry ----------------------------------------------
  identities: Identity[];
  /** false when the IdentityRegistry is not deployed, so nothing can be decided */
  registryLive: boolean;
  /** the registry's entry for the connected address, or null when unknown */
  liveIdentity: Identity | null;

  // --- the sample identities, as an explicit preview -----------------------
  preview: Identity | null;
  setPreview: (address: string | null) => void;

  // --- the verdict ---------------------------------------------------------
  classFrozen: boolean;
  classFrozenReason: string | null;
  /** why a subscription would be refused, or null if it would not be */
  blockedReason: string | null;
  /** true when a real wallet is connected but the registry cannot answer for it */
  undecidable: boolean;

  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
};

const Ctx = createContext<WalletCtx | null>(null);

export function useWallet(): WalletCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used inside <WalletProvider>");
  return v;
}

export const FUND_CHAIN = { id: FUND_CHAIN_ID, name: FUND_CHAIN_NAME };

/**
 * Real wallet connection over wagmi, plus the sample identities kept as an
 * explicit preview.
 *
 * These are two different things and the UI must never let them blur. The
 * connection is a real account in a real extension. The preview is a fixture
 * used to demonstrate the refusal reasons the compliance contract would give,
 * which matters because the IdentityRegistry is not deployed yet — so for a
 * genuinely connected address there is no registry to ask, and the honest
 * answer is that the question cannot be decided rather than a green tick.
 */
export function WalletProvider({
  identities,
  classFrozen,
  classFrozenReason,
  registryLive,
  children,
}: {
  identities: Identity[];
  classFrozen: boolean;
  classFrozenReason: string | null;
  registryLive: boolean;
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletState
          identities={identities}
          classFrozen={classFrozen}
          classFrozenReason={classFrozenReason}
          registryLive={registryLive}
        >
          {children}
        </WalletState>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function WalletState({
  identities,
  classFrozen,
  classFrozenReason,
  registryLive,
  children,
}: {
  identities: Identity[];
  classFrozen: boolean;
  classFrozenReason: string | null;
  registryLive: boolean;
  children: React.ReactNode;
}) {
  const { address, isConnected, connector, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const [modalOpen, setModalOpen] = useState(false);
  const [previewAddress, setPreviewAddress] = useState<string | null>(null);

  const preview = useMemo(
    () =>
      previewAddress
        ? (identities.find((i) => i.address === previewAddress) ?? null)
        : null,
    [previewAddress, identities],
  );

  /**
   * What the registry says about the connected address. Only meaningful when
   * the registry is actually deployed — otherwise this stays null and the UI
   * says it cannot tell, which is the truth.
   */
  const liveIdentity = useMemo<Identity | null>(() => {
    if (!registryLive || !address) return null;
    const hit = identities.find(
      (i) => i.address.toLowerCase() === address.toLowerCase(),
    );
    return (
      hit ?? {
        address,
        label: "This wallet",
        identityVerified: false,
        refusalReason:
          "ComplianceRefused: this address has no verified identity in the IdentityRegistry",
      }
    );
  }, [registryLive, address, identities]);

  const subject = liveIdentity ?? preview;

  const blockedReason = useMemo(() => {
    if (!subject) return null;
    if (classFrozen) {
      return `ComplianceRefused: the share class is frozen — ${
        classFrozenReason ?? "MandatePolicy.inBreach() is true"
      }`;
    }
    if (!subject.identityVerified) {
      return (
        subject.refusalReason ??
        "ComplianceRefused: identity is not verified in the IdentityRegistry"
      );
    }
    return null;
  }, [subject, classFrozen, classFrozenReason]);

  /**
   * Connect, and do NOT demand the right chain as a condition of connecting.
   *
   * Passing `chainId` here makes wagmi ask the wallet to switch networks as part
   * of the connection, so someone who declines that prompt fails the whole
   * connection and lands back on an unchanged button with no explanation. Far
   * better to accept the connection and then offer the switch: `wrongChain`
   * drives a one-click control in the header and on /shares.
   *
   * The modal is not closed here either. It closes when the connection actually
   * succeeds, so a rejected request leaves the error on screen instead of
   * dismissing the only surface that could explain it.
   */
  const doConnect = useCallback(
    (c: Connector) => {
      connect({ connector: c });
    },
    [connect],
  );

  useEffect(() => {
    if (isConnected) setModalOpen(false);
  }, [isConnected]);

  /**
   * A watchdog, because the worst failure here is silence.
   *
   * `eth_requestAccounts` can hang forever rather than reject: the extension's
   * inpage script is alive and takes the request, but its background worker is
   * dead, so nothing ever comes back. wagmi has no timeout for that, so without
   * this the modal sits on a disabled spinner indefinitely and the person is
   * told nothing at all.
   */
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!isPending) {
      setStalled(false);
      return;
    }
    const t = window.setTimeout(() => setStalled(true), 12000);
    return () => window.clearTimeout(t);
  }, [isPending]);

  const value: WalletCtx = {
    address,
    isConnected,
    connectorName: connector?.name ?? null,
    chainId,
    wrongChain:
      isConnected && chainId !== undefined && chainId !== FUND_CHAIN_ID,
    connectors,
    connect: doConnect,
    disconnect: () => {
      disconnect();
      setPreviewAddress(null);
    },
    switchToFundChain: () => switchChain({ chainId: FUND_CHAIN_ID }),
    connecting: isPending,
    connectError: error ? error.message : null,
    stalled,

    identities,
    registryLive,
    liveIdentity,

    preview,
    setPreview: setPreviewAddress,

    classFrozen,
    classFrozenReason,
    blockedReason,
    undecidable: isConnected && !registryLive && !preview,

    modalOpen,
    openModal: () => setModalOpen(true),
    closeModal: () => setModalOpen(false),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Mounted here so every chrome that can call openModal has the picker
          on the page, whichever layout it is sitting in. */}
      <WalletModal />
    </Ctx.Provider>
  );
}

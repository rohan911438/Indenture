"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { walletById, type WalletOption } from "./wallets";

export type Identity = {
  address: string;
  label: string;
  identityVerified: boolean;
  refusalReason?: string;
};

export type Connection = {
  wallet: WalletOption;
  identity: Identity;
};

type WalletCtx = {
  connection: Connection | null;
  identities: Identity[];
  classFrozen: boolean;
  classFrozenReason: string | null;
  /** why the connected identity cannot subscribe, or null if it can */
  blockedReason: string | null;
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  connect: (walletId: string, identityAddress?: string) => void;
  switchIdentity: (address: string) => void;
  disconnect: () => void;
};

const Ctx = createContext<WalletCtx | null>(null);

export function useWallet(): WalletCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet must be used inside <WalletProvider>");
  return v;
}

export function WalletProvider({
  identities,
  classFrozen,
  classFrozenReason,
  children,
}: {
  identities: Identity[];
  classFrozen: boolean;
  classFrozenReason: string | null;
  children: React.ReactNode;
}) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const pickIdentity = useCallback(
    (address?: string): Identity => {
      if (address) {
        const hit = identities.find((i) => i.address === address);
        if (hit) return hit;
      }
      return (
        identities.find((i) => i.identityVerified) ??
        identities[0] ?? {
          address: "0x0000000000000000000000000000000000000000",
          label: "Unknown",
          identityVerified: false,
        }
      );
    },
    [identities],
  );

  const connect = useCallback(
    (walletId: string, identityAddress?: string) => {
      setConnection({
        wallet: walletById(walletId),
        identity: pickIdentity(identityAddress),
      });
      setModalOpen(false);
    },
    [pickIdentity],
  );

  const switchIdentity = useCallback(
    (address: string) => {
      setConnection((c) =>
        c ? { ...c, identity: pickIdentity(address) } : c,
      );
    },
    [pickIdentity],
  );

  const blockedReason = useMemo(() => {
    if (!connection) return null;
    if (classFrozen)
      return `ComplianceRefused: share class is frozen — ${
        classFrozenReason ?? "MandatePolicy.inBreach() is true"
      }`;
    if (!connection.identity.identityVerified)
      return (
        connection.identity.refusalReason ??
        "ComplianceRefused: identity is not verified in the IdentityRegistry"
      );
    return null;
  }, [connection, classFrozen, classFrozenReason]);

  const value: WalletCtx = {
    connection,
    identities,
    classFrozen,
    classFrozenReason,
    blockedReason,
    modalOpen,
    openModal: () => setModalOpen(true),
    closeModal: () => setModalOpen(false),
    connect,
    switchIdentity,
    disconnect: () => setConnection(null),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

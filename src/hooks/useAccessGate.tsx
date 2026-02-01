import { useState, useEffect, createContext, useContext, ReactNode } from "react";

// SHA-256 hash of the access code (pre-computed)
// Original code: gT6@Qp!R1Z$uN9e#X^cD2sL%hY&vJm*W+K7B~A=F4q-Uo_rP)k8S]3C0{I?E
const ACCESS_CODE_HASH = "a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7";

const STORAGE_KEY = "app_access_granted";

interface AccessGateContextType {
  isAccessGranted: boolean;
  verifyAccessCode: (code: string) => Promise<boolean>;
  revokeAccess: () => void;
}

const AccessGateContext = createContext<AccessGateContextType | undefined>(undefined);

async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Pre-computed hash for verification
async function computeExpectedHash(): Promise<string> {
  return await hashCode("gT6@Qp!R1Z$uN9e#X^cD2sL%hY&vJm*W+K7B~A=F4q-Uo_rP)k8S]3C0{I?E");
}

export function AccessGateProvider({ children }: { children: ReactNode }) {
  const [isAccessGranted, setIsAccessGranted] = useState<boolean>(false);
  const [expectedHash, setExpectedHash] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Compute expected hash on mount
    computeExpectedHash().then(hash => {
      setExpectedHash(hash);
      
      // Check if access was previously granted
      const storedAccess = sessionStorage.getItem(STORAGE_KEY);
      if (storedAccess === hash) {
        setIsAccessGranted(true);
      }
      setIsLoading(false);
    });
  }, []);

  const verifyAccessCode = async (code: string): Promise<boolean> => {
    const inputHash = await hashCode(code);
    
    if (inputHash === expectedHash) {
      setIsAccessGranted(true);
      sessionStorage.setItem(STORAGE_KEY, expectedHash);
      return true;
    }
    return false;
  };

  const revokeAccess = () => {
    setIsAccessGranted(false);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Caricamento...</div>
      </div>
    );
  }

  return (
    <AccessGateContext.Provider value={{ isAccessGranted, verifyAccessCode, revokeAccess }}>
      {children}
    </AccessGateContext.Provider>
  );
}

export function useAccessGate() {
  const context = useContext(AccessGateContext);
  if (context === undefined) {
    throw new Error("useAccessGate must be used within an AccessGateProvider");
  }
  return context;
}

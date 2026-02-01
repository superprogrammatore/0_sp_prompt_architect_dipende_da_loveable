import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccessGate } from "@/hooks/useAccessGate";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AccessGateLogout() {
  const { revokeAccess } = useAccessGate();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={revokeAccess}
          className="h-8 w-8 md:h-9 md:w-9"
        >
          <KeyRound className="w-3.5 h-3.5 md:w-4 md:h-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Esci dall'accesso riservato</p>
      </TooltipContent>
    </Tooltip>
  );
}

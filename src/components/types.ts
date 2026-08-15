import type { Dispatch } from "react";
import type { AgentRole, AppState } from "../core/types";
import type { AppAction } from "../core/reducer";

export interface ViewProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  runAgent: (role: AgentRole) => Promise<void>;
  loadingRole?: AgentRole;
}

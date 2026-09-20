import React, { createContext, useContext, useState, useEffect } from "react";
import { spokeOps, SpokeUser } from "@/telemetry/spokeOpsClient.ts";

export type ControlPlaneRole = "platform_operator" | "admin" | "viewer";

export interface ControlPlaneUser extends SpokeUser {
  displayName: string;
  avatarUrl?: string;
  activeRole: ControlPlaneRole;
}

interface AuthContextType {
  user: ControlPlaneUser;
  activeRole: ControlPlaneRole;
  setActiveRole: (role: ControlPlaneRole) => void;
  isAdmin: boolean;
  isOperator: boolean;
  isViewer: boolean;
  checkPermission: (requiredRole: "operator" | "admin", resourceId: string) => boolean;
}

const ROLE_DEFINITIONS: Record<ControlPlaneRole, { roles: string[]; displayName: string }> = {
  platform_operator: {
    roles: ["platform_operator"],
    displayName: "Lead Platform Operator"
  },
  admin: {
    roles: ["admin", "platform_operator"],
    displayName: "Principal Control Plane Admin"
  },
  viewer: {
    roles: ["viewer"],
    displayName: "Read-Only Observer"
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRoleState] = useState<ControlPlaneRole>(() => {
    try {
      const saved = localStorage.getItem("hub_operator_role");
      return (saved as ControlPlaneRole) || "platform_operator";
    } catch {
      return "platform_operator";
    }
  });

  const setActiveRole = (role: ControlPlaneRole) => {
    setActiveRoleState(role);
    try {
      localStorage.setItem("hub_operator_role", role);
    } catch {
      // ignore localStorage error
    }
  };

  const user: ControlPlaneUser = {
    uid: "usr_hub_op_01",
    email: "operator@hub-spoke.net",
    displayName: ROLE_DEFINITIONS[activeRole].displayName,
    roles: ROLE_DEFINITIONS[activeRole].roles,
    activeRole
  };

  // Step 1 of directive: Initialize SpokeOps telemetry when user state resolves or role changes
  useEffect(() => {
    if (user) {
      spokeOps.init({
        uid: user.uid,
        email: user.email || "anonymous@hub-spoke.net",
        roles: user.roles || ["platform_operator"]
      });
    }
  }, [user.uid, user.email, activeRole]);

  const isAdmin = activeRole === "admin";
  const isOperator = activeRole === "platform_operator" || activeRole === "admin";
  const isViewer = activeRole === "viewer";

  /**
   * Evaluates RBAC permissions and logs an audit event on denial
   */
  const checkPermission = (requiredRole: "operator" | "admin", resourceId: string): boolean => {
    let allowed = false;
    if (requiredRole === "operator") {
      allowed = isOperator;
    } else if (requiredRole === "admin") {
      allowed = isAdmin;
    }

    if (!allowed) {
      spokeOps.logAudit({
        action: "permission_denied",
        resourceType: "control_plane_route",
        resourceId,
        status: "denied",
        metadata: {
          requiredRole,
          currentRoles: user.roles,
          userEmail: user.email
        }
      });
    }

    return allowed;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeRole,
        setActiveRole,
        isAdmin,
        isOperator,
        isViewer,
        checkPermission
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};

import React from 'react';
import { AuditSeverity } from '../../types/telemetry';
import { Badge } from '../common/Badge';
import { CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

interface SeverityBadgeProps {
  status: AuditSeverity;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ status }) => {
  switch (status) {
    case 'success':
      return (
        <Badge variant="success" size="xs">
          <CheckCircle2 className="w-3 h-3 mr-0.5 inline" />
          SUCCESS
        </Badge>
      );
    case 'warning':
      return (
        <Badge variant="warning" size="xs">
          <AlertTriangle className="w-3 h-3 mr-0.5 inline" />
          WARNING
        </Badge>
      );
    case 'denied':
      return (
        <Badge variant="danger" size="xs" pulse>
          <ShieldAlert className="w-3 h-3 mr-0.5 inline" />
          DENIED
        </Badge>
      );
    default:
      return <Badge variant="neutral" size="xs">{status}</Badge>;
  }
};

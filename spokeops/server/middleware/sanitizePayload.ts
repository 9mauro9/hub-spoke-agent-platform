import { Request, Response, NextFunction } from 'express';

const SENSITIVE_KEY_REGEX = /(password|passwd|passphrase|token|auth|bearer|secret|apikey|api_key|privatekey|private_key|clientsecret|client_secret|cvv|creditcard|credit_card|ssn)/i;
const CREDIT_CARD_REGEX = /\b(?:\d[ -]*?){13,16}\b/g;

/**
 * Recursively redacts sensitive keys and values from arbitrary objects
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Redact credit card number patterns in strings
    return obj.replace(CREDIT_CARD_REGEX, '****-****-****-****');
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        sanitized[key] = '[REDACTED_BY_SPOKEOPS_OWASP]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else if (typeof value === 'string') {
        sanitized[key] = value.replace(CREDIT_CARD_REGEX, '****-****-****-****');
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * OWASP sanitization middleware to redact sensitive keys in incoming requests
 */
export function sanitizePayloadMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === 'object') {
    // Sanitize metadata specifically or entire body
    if (req.body.auditEvent?.metadata) {
      req.body.auditEvent.metadata = sanitizeObject(req.body.auditEvent.metadata);
    }
    if (req.body.metadata) {
      req.body.metadata = sanitizeObject(req.body.metadata);
    }
  }
  next();
}

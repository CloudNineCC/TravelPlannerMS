import { Request, Response, NextFunction } from 'express'
import { verifyJWT, UserInfo } from './jwt-helper.js'

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserInfo
    }
  }
}

export function jwtMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip middleware for health and auth routes
  if (req.path === '/health' || req.path.startsWith('/auth/')) {
    return next()
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  // Verify token
  const userInfo = verifyJWT(token)
  if (!userInfo) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  // Attach user info to request
  req.user = userInfo
  next()
}


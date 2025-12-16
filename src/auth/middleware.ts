import { Request, Response, NextFunction } from 'express'
import { verifyJWT, UserInfo } from './jwt-helper.js'

declare global {
  namespace Express {
    interface Request {
      user?: UserInfo
    }
  }
}

export function jwtMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health' || req.path.startsWith('/auth/')) {
    return next()
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.substring(7)

  const userInfo = verifyJWT(token)
  if (!userInfo) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  req.user = userInfo
  next()
}

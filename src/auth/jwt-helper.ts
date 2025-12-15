import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface UserInfo {
  id: string
  email: string
  name?: string
  picture?: string
}

export function generateJWT(userInfo: UserInfo): string {
  const payload = {
    sub: userInfo.id,
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    iat: Math.floor(Date.now() / 1000)
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '24h'
  })
}

export function verifyJWT(token: string): UserInfo | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    return {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture
    }
  } catch (error) {
    return null
  }
}

export function extractUserInfo(token: string): UserInfo | null {
  return verifyJWT(token)
}


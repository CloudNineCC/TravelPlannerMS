import { Router, Request, Response } from 'express'
import { OAuth2Client } from 'google-auth-library'
import { generateJWT, UserInfo } from '../auth/jwt-helper.js'

const router = Router()

const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim()
const client = new OAuth2Client(GOOGLE_CLIENT_ID)

router.post('/google-login', async (req: Request, res: Response) => {
  try {
    const { credential } = req.body

    if (!credential) {
      return res.status(400).json({ error: 'Missing credential' })
    }

    const parts = credential.split('.')
    const payload_preview = JSON.parse(Buffer.from(parts[1], 'base64').toString())

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    })

    const payload = ticket.getPayload()
    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const userInfo: UserInfo = {
      id: payload.sub,
      email: payload.email || '',
      name: payload.name,
      picture: payload.picture
    }

    const token = generateJWT(userInfo)

    res.json({
      token,
      user: userInfo
    })
  } catch (error: any) {
    console.error('Google login error:', error)
    res.status(401).json({ error: 'Failed to verify Google token' })
  }
})

router.post('/verify', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' })
    }

    const token = authHeader.substring(7)
    const { verifyJWT } = await import('../auth/jwt-helper.js')
    const userInfo = verifyJWT(token)

    if (!userInfo) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    res.json({ valid: true, user: userInfo })
  } catch (error: any) {
    res.status(401).json({ error: 'Token verification failed' })
  }
})

export default router

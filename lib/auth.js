import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { readJwtSecret } from '@/lib/jwt-secret'

const ALGORITHM = 'HS256'

// Se lee en cada uso y no al cargar el módulo: si falta, el error aparece en la
// petición que lo necesita, con un mensaje claro, y no rompe el build.
function jwtSecret() {
  return readJwtSecret(process.env.JWT_SECRET)
}

export function signToken(payload) {
  return jwt.sign(payload, jwtSecret(), { expiresIn: '7d', algorithm: ALGORITHM })
}

export function verifyToken(token) {
  // Un secreto mal configurado tiene que fallar fuerte, no parecer un token inválido.
  const secret = jwtSecret()
  try {
    return jwt.verify(token, secret, { algorithms: [ALGORITHM] })
  } catch {
    return null
  }
}

export function getTokenFromRequest(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

export function requireAdmin(request) {
  const token = getTokenFromRequest(request)
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const payload = verifyToken(token)
  if (!payload) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }
  return payload
}

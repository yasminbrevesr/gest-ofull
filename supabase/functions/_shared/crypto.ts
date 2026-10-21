// Criptografia dos tokens do Mercado Livre (AES-GCM) e utilitários de OAuth.
import { requireEnv } from './env.ts'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
let cachedKey: Promise<CryptoKey> | null = null

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A chave AES vem do segredo ML_TOKEN_ENCRYPTION_KEY (mínimo de 32 caracteres). */
function encryptionKey(): Promise<CryptoKey> {
  cachedKey ??= (async () => {
    const secret = requireEnv('ML_TOKEN_ENCRYPTION_KEY')
    if (secret.length < 32) throw new Error('ML_TOKEN_ENCRYPTION_KEY precisa ter pelo menos 32 caracteres')
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret))
    return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
  })()
  return cachedKey
}

/** Formato: v1:<iv base64>:<dados base64> */
export async function encryptSecret(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(), encoder.encode(plain))
  return `v1:${toBase64(iv)}:${toBase64(new Uint8Array(data))}`
}

export async function decryptSecret(value: string): Promise<string> {
  const [version, iv, data] = value.split(':')
  if (version !== 'v1' || !iv || !data) throw new Error('Token criptografado em formato desconhecido')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, await encryptionKey(), fromBase64(data))
  return decoder.decode(plain)
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomToken(bytes = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)))
}

/** code_challenge do PKCE (S256). */
export async function pkceChallenge(verifier: string): Promise<string> {
  return toBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))))
}

/** Comparação em tempo constante (evita descobrir o segredo pelo tempo de resposta). */
export function timingSafeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a)
  const y = encoder.encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

/** Só para testes: troca a chave em uso. */
export function _resetKeyCache() {
  cachedKey = null
}

import { assert, assertEquals, assertNotEquals, assertRejects } from 'jsr:@std/assert@1'
import { _resetKeyCache, decryptSecret, encryptSecret, pkceChallenge, timingSafeEqual } from './crypto.ts'

Deno.test('criptografa e descriptografa o token', async () => {
  Deno.env.set('ML_TOKEN_ENCRYPTION_KEY', 'uma-chave-de-teste-com-mais-de-32-caracteres')
  _resetKeyCache()
  const encrypted = await encryptSecret('APP_USR-123')
  assert(encrypted.startsWith('v1:'))
  assertNotEquals(encrypted, await encryptSecret('APP_USR-123')) // IV aleatório
  assertEquals(await decryptSecret(encrypted), 'APP_USR-123')

  Deno.env.set('ML_TOKEN_ENCRYPTION_KEY', 'outra-chave-de-teste-com-mais-de-32-caracteres')
  _resetKeyCache()
  await assertRejects(() => decryptSecret(encrypted))
})

Deno.test('recusa chave curta', async () => {
  Deno.env.set('ML_TOKEN_ENCRYPTION_KEY', 'curta')
  _resetKeyCache()
  await assertRejects(() => encryptSecret('x'))
})

Deno.test('PKCE S256 = base64url(sha256(verifier)), sem "="', async () => {
  // Valor conferido com o Node: createHash('sha256').update(v).digest('base64url')
  assertEquals(await pkceChallenge('dBjftJeZ4CVP-mJ92K9qq7xsVbtUkStZXb6tVRuSZ1E'), 'jWfjSn0xUmK7R0Py_7SwRI01EaRbvOwM1uccLR5BYE8')
})

Deno.test('comparação em tempo constante', () => {
  assert(timingSafeEqual('abc', 'abc'))
  assert(!timingSafeEqual('abc', 'abd'))
  assert(!timingSafeEqual('abc', 'abcd'))
})

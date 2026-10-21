import { assertEquals } from 'jsr:@std/assert@1'
import { failureDecision, MAX_ATTEMPTS, retryDelayMinutes } from './events.ts'
import { HttpError } from './http.ts'
import { MlApiError } from './ml-api.ts'
import { ReconnectRequiredError } from './ml-auth.ts'

Deno.test('espera entre tentativas dobra até 1 hora', () => {
  assertEquals([1, 2, 3, 4, 7, 10].map(retryDelayMinutes), [1, 2, 4, 8, 60, 60])
})

Deno.test('erro temporário volta para a fila; definitivo vira erro', () => {
  assertEquals(failureDecision(new MlApiError(429, 'muitas requisições'), 1).status, 'pending')
  assertEquals(failureDecision(new MlApiError(503, 'fora do ar'), 3).status, 'pending')
  assertEquals(failureDecision(new MlApiError(0, 'sem rede'), 2).status, 'pending')
  assertEquals(failureDecision(new Error('falha desconhecida'), 1).status, 'pending')
  assertEquals(failureDecision(new MlApiError(404, 'não encontrado'), 1).status, 'error')
  assertEquals(failureDecision(new ReconnectRequiredError(), 1).status, 'error')
  assertEquals(failureDecision(new HttpError(404, 'Conecte sua conta'), 1).status, 'error')
})

Deno.test('desiste depois do limite de tentativas', () => {
  assertEquals(failureDecision(new MlApiError(503, 'fora do ar'), MAX_ATTEMPTS).status, 'error')
})

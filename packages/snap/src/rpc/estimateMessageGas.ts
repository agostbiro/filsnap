import { Message, MessageSchemaPartial } from 'iso-rpc'
import { z } from 'zod'
import type { SnapContext, SnapResponse } from '../types'
import { serializeError } from '../utils'

// Default max fee in attoFIL (0.1 FIL)
const DEFAULT_MAX_FEE = '100000000000000000'
// Schemas
export const estimateParams = z.object({
  message: MessageSchemaPartial.omit({ from: true }),
  maxFee: z.string().optional(),
})

// Types
export type EstimateParams = z.infer<typeof estimateParams>
export interface EstimateMessageGasRequest {
  method: 'fil_getGasForMessage'
  params: EstimateParams
}
export interface MessageGasEstimate {
  gasfeecap: string
  gaslimit: number
  gaspremium: string
}
export type EstimateMessageGasResponse = SnapResponse<MessageGasEstimate>

/**
 * Get the gas estimate for a message
 *
 * @param ctx - Snap context
 * @param params - Estimate params
 */
export async function estimateMessageGas(
  ctx: SnapContext,
  params: EstimateParams
): Promise<EstimateMessageGasResponse> {
  const { rpc, keypair } = ctx
  const _params = estimateParams.safeParse(params)
  if (!_params.success) {
    return serializeError(
      `Invalid params ${_params.error.message}`,
      _params.error
    )
  }

  const { message, maxFee } = _params.data
  const msg = new Message({
    to: message.to,
    from: keypair.address,
    value: message.value,
  })
  const { error, result } = await rpc.gasEstimate(
    msg,
    maxFee == null ? DEFAULT_MAX_FEE : maxFee
  )
  if (error != null) {
    return serializeError('RPC call to "GasEstimateMessageGas" failed', error)
  }

  return {
    result: {
      gasfeecap: result.GasFeeCap,
      gaslimit: result.GasLimit,
      gaspremium: result.GasPremium,
    },
  }
}

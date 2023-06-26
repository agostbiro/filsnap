/* eslint-disable no-console */
import type { SnapsGlobalObject } from '@metamask/snaps-types'
import { copyable, heading, panel, text } from '@metamask/snaps-ui'
import * as Constants from './constants'
import * as Schemas from './schemas'
import type {
  Json,
  MessageStatus,
  Network,
  SnapConfig,
  SnapResponseError,
} from './types'

/**
 * Get default configuration by network name
 *
 * @param networkName - Network name
 * @returns SnapConfig
 */
export function configFromNetwork(networkName?: Network): SnapConfig {
  switch (networkName) {
    case 'mainnet': {
      console.log('Filecoin mainnet network selected')
      return Constants.mainnetConfig
    }
    case 'testnet': {
      console.log('Filecoin testnet network selected')
      return Constants.testnetConfig
    }
    default: {
      return Constants.mainnetConfig
    }
  }
}

/**
 * Get configuration from snap
 * If configuration is not present in state, it will be initialized with default values
 *
 * @param snap - Snaps global object
 */
export async function configFromSnap(
  snap: SnapsGlobalObject
): Promise<SnapConfig> {
  const state = await snap.request({
    method: 'snap_manageState',
    params: { operation: 'get' },
  })

  const result = Schemas.metamaskState.safeParse(state)

  if (result.success) {
    return result.data.filecoin.config
  } else {
    await snap.request({
      method: 'snap_manageState',
      params: { newState: Constants.initialState, operation: 'update' },
    })

    return Constants.initialState.filecoin.config
  }
}

/**
 * Extracts all JSON-serializable properties from an object.
 *
 * @param object - The object in question.
 * @returns An object containing all the JSON-serializable properties.
 */
function serializeObject(object: Record<PropertyKey, unknown>): Json {
  // eslint-disable-next-line unicorn/no-array-reduce
  return Object.getOwnPropertyNames(object).reduce<Record<string, Json>>(
    (acc, key) => {
      const value = object[key]
      const r = Schemas.json.safeParse(value)
      if (r.success) {
        acc[key] = r.data
      }

      return acc
    },
    {}
  )
}

/**
 * A type guard for Record<PropertyKey, unknown>.
 *
 * @param value - The value to check.
 * @returns Whether the specified value has a runtime type of `object` and is
 * neither `null` nor an `Array`.
 */
export function isObject(
  value: unknown
): value is Record<PropertyKey, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Serialize an error into a SnapError.
 * If the error is an object, it will be serialized into a JSON object.
 *
 * @param msg - Error message
 * @param data - Error data
 */
export function serializeError(msg: string, data?: unknown): SnapResponseError {
  const _data = isObject(data) ? serializeObject(data) : null
  // @ts-expect-error - no types
  const hasMessage = _data?.message != null && typeof _data.message === 'string'
  // @ts-expect-error - no types
  const _msg = (hasMessage ? _data.message : '') as string
  return {
    error: {
      message: msg + (hasMessage ? ` - ${_msg}` : ''),
      data: _data,
    },
  }
}

interface Message {
  message: string
  value: unknown | undefined
}

/**
 * Create a UI message from an array of messages
 *
 * @param messages - Array of messages
 * @returns A string containing all the messages
 */
export function createUIMessage(messages: Message[]): string {
  return messages
    .map(({ message, value }) => message + ' ' + String(value))
    .join('\n')
}

interface ConfirmationDialogContent {
  prompt: string
  description?: string
  textAreaContent?: string
}

/**
 * Show a confirmation dialog to the user
 *
 * @see https://docs.metamask.io/snaps/reference/rpc-api/#confirmation-dialog
 * @param snap - The snap itself
 * @param message - The message to show
 */
export async function showConfirmationDialog(
  snap: SnapsGlobalObject,
  message: ConfirmationDialogContent
): Promise<boolean> {
  return (await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'confirmation',
      content: panel([
        heading(message.prompt),
        text(message.description ?? ''),
        copyable(message.textAreaContent ?? ''),
      ]),
    },
  })) as boolean
}

/**
 * Update the messages in the state
 *
 * @param snap - The snap itself
 * @param message - The message to update
 */
export async function updateMessageInState(
  snap: SnapsGlobalObject,
  message: MessageStatus
): Promise<void> {
  const _state = await snap.request({
    method: 'snap_manageState',
    params: { operation: 'get' },
  })

  const state = Schemas.metamaskState.parse(_state)

  const index = state.filecoin.messages.findIndex(
    (msg) => msg.cid === message.cid
  )
  if (index >= 0) {
    state.filecoin.messages[index] = message
  } else {
    state.filecoin.messages.push(message)
  }
  await snap.request({
    method: 'snap_manageState',
    params: { newState: state, operation: 'update' },
  })
}

/* eslint-disable jsdoc/require-returns */
import type {
  OnInstallHandler,
  OnRpcRequestHandler,
  OnUserInputHandler,
} from '@metamask/snaps-sdk';
import { UserInputEventType, heading, panel, text } from '@metamask/snaps-sdk';

const fetchChainStack = async (apiKey: string, address: string) => {
  return fetch('https://api.chainstack.com/v1/faucet/sepolia', {
    body: JSON.stringify({ address }),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
  });
};

/**
 * Handle installation of the snap. This handler is called when the snap is
 * installed, and can be used to perform any initialization that is required.'
 *
 * This handler is optional. If it is not provided, the snap will be installed
 * as usual.
 *
 * @see https://docs.metamask.io/snaps/reference/exports/#oninstall
 */
export const onInstall: OnInstallHandler = async () => {
  const interfaceId = await snap.request({
    method: 'snap_createInterface',
    params: {
      ui: panel([
        heading('Chainstack Snap'),
        text(
          'Enter your public API key to receive up to 0.5 testnet ETH from the Chainstack Faucet.',
        ),
      ]),
    },
  });

  return snap.request({
    method: 'snap_dialog',
    params: {
      type: 'prompt',
      id: interfaceId,
    },
  });
};

export const onUserInput: OnUserInputHandler = async ({ event }) => {
  console.log('User input event', event);
  // Not sure about this line
  if (event.type === UserInputEventType.InputChangeEvent) {
    console.log('The submitted values are', event.value);

    const apiKey = event.value;

    await snap.request({
      method: 'snap_manageState',
      params: {
        operation: 'update',
        newState: { apiKey },
      },
    });
  }
};

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({ request }) => {
  console.log('onRpcRequest', request.method);
  switch (request.method) {
    case 'sendETH': {
      try {
        console.log('sendETH request', request.params);
        const persistedData = await snap.request({
          method: 'snap_manageState',
          params: { operation: 'get' },
        });

        if (!persistedData) {
          throw new Error('API key not found.');
        }

        const { apiKey } = persistedData as { apiKey: string };
        const { address } = request.params as { address: string };

        const response = await fetchChainStack(apiKey, address);

        if (response.ok) {
          return snap.request({
            method: 'snap_dialog',
            params: {
              type: 'alert',
              content: panel([
                heading('Chainstack Snap'),
                text(
                  'The transaction was successful. You should receive the testnet ETH shortly.',
                ),
              ]),
            },
          });
        }

        return snap.request({
          method: 'snap_dialog',
          params: {
            type: 'alert',
            content: panel([
              heading('Chainstack Snap'),
              text(
                'The transaction failed. Please check your API key and try again.',
              ),
            ]),
          },
        });
      } catch (error) {
        return snap.request({
          method: 'snap_dialog',
          params: {
            type: 'alert',
            content: panel([
              heading('Chainstack Snap'),
              text('An error occurred. Please try again later.'),
            ]),
          },
        });
      }
    }
    default:
      throw new Error('Method not found.');
  }
};

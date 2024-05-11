/* eslint-disable jsdoc/require-returns */
import type {
  OnInstallHandler,
  OnRpcRequestHandler,
  OnUserInputHandler,
} from '@metamask/snaps-sdk';
import {
  ManageStateOperation,
  UserInputEventType,
  heading,
  input,
  panel,
  text,
} from '@metamask/snaps-sdk';

const fetchChainStack = async (apiKey: string, address: string) => {
  const options = {
    body: JSON.stringify({ address }),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      accept: 'application/json',
    },
  };

  console.log('fetchChainStack', options);
  return await fetch('https://api.chainstack.com/v1/faucet/sepolia', options);
};

const createInputApiKeyInterface = async () => {
  return await snap.request({
    method: 'snap_createInterface',
    params: {
      ui: panel([
        heading('Chainstack Snap'),
        text(
          'Enter your public API key to receive up to 0.5 testnet ETH from the Chainstack Faucet.',
        ),
        input({
          name: 'api-key-input',
          placeholder: 'Enter your public API key here',
        }),
      ]),
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
  const interfaceId = await createInputApiKeyInterface();

  await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'alert',
      id: interfaceId,
    },
  });
};

export const onUserInput: OnUserInputHandler = async ({ event }) => {
  if (
    event.type === UserInputEventType.InputChangeEvent &&
    event.name === 'api-key-input'
  ) {
    await snap.request({
      method: 'snap_manageState',
      params: {
        operation: ManageStateOperation.UpdateState,
        newState: { apiKey: event.value },
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
  switch (request.method) {
    case 'sendETH': {
      try {
        const persistedData = await snap.request({
          method: 'snap_manageState',
          params: { operation: ManageStateOperation.GetState },
        });

        if (!persistedData) {
          throw new Error('API key not found.');
        }

        const { apiKey } = persistedData as { apiKey: string };
        const { address } = request.params as { address: string };

        const response = await fetchChainStack(apiKey, address);

        const responseJson = await response.json();

        if (response.ok) {
          return snap.request({
            method: 'snap_dialog',
            params: {
              type: 'alert',
              content: panel([
                heading('Chainstack Snap'),
                text(
                  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                  `The transaction was successful. You should receive ${responseJson.amountSent} SepoliaETH shortly. Check the transaction here - ${responseJson.transaction}`,
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
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              text(`The transaction failed. ${responseJson?.message}`),
            ]),
          },
        });
      } catch (error) {
        console.error('sendETH error:', error);
        return snap.request({
          method: 'snap_dialog',
          params: {
            type: 'alert',
            content: panel([
              heading('Chainstack Snap'),
              text(
                `An error occurred. Please try again later. ${
                  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                  (error as any)?.message
                }`,
              ),
            ]),
          },
        });
      }
    }
    default:
      throw new Error('Method not found.');
  }
};

/* eslint-disable jsdoc/require-returns */
import type {
  OnInstallHandler,
  OnRpcRequestHandler,
  OnUserInputHandler,
} from '@metamask/snaps-sdk';
import {
  UserInputEventType,
  button,
  heading,
  input,
  panel,
  spinner,
  text,
  address as addressComponent,
  row,
} from '@metamask/snaps-sdk';

import { getCurrentState, patchState } from './utils';

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

  return await fetch('https://api.chainstack.com/v1/faucet/sepolia', options);
};

const getApiKeyAndAddressFromState = async () => {
  const persistedData = await getCurrentState();

  const { apiKey, sendETHAddress } = persistedData as {
    apiKey: string;
    sendETHAddress: string;
  };

  if (!apiKey) {
    throw new Error('API key not found.');
  }

  if (!sendETHAddress) {
    throw new Error('Address not found.');
  }

  return { apiKey, sendETHAddress };
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

export const onUserInput: OnUserInputHandler = async ({ id, event }) => {
  if (
    event.type === UserInputEventType.InputChangeEvent &&
    event.name === 'api-key-input'
  ) {
    await patchState({ apiKey: event.value });
  }

  if (
    event.type === UserInputEventType.ButtonClickEvent &&
    event.name === 'send-it'
  ) {
    try {
      await snap.request({
        method: 'snap_updateInterface',
        params: {
          id,
          ui: panel([
            text(
              'Getting you some testnet ETH from the Chainstack Faucet. This may take a few seconds.',
            ),
            spinner(),
          ]),
        },
      });

      const { apiKey, sendETHAddress } = await getApiKeyAndAddressFromState();
      const response = await fetchChainStack(apiKey, sendETHAddress);
      const responseJson = await response.json();

      if (response.ok) {
        await snap.request({
          method: 'snap_updateInterface',
          params: {
            id,
            ui: panel([
              heading('Chainstack Snap'),
              text(
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `The transaction was successful. You should receive ${responseJson.amountSent} SepoliaETH shortly. Check the transaction here - ${responseJson.transaction}`,
              ),
            ]),
          },
        });
      } else {
        await snap.request({
          method: 'snap_updateInterface',
          params: {
            id,
            ui: panel([
              heading('Chainstack Snap'),
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              text(`The transaction failed. ${responseJson?.message}`),
            ]),
          },
        });
      }
    } catch (error) {
      await snap.request({
        method: 'snap_updateInterface',
        params: {
          id,
          ui: panel([
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
        const { address } = request.params as { address: `0x${string}` };
        const sendETHInterfaceId = await snap.request({
          method: 'snap_createInterface',
          params: {
            ui: panel([
              heading('Chainstack Snap'),
              text(
                'You are about to get some sepoliaETH from the Chainstack Faucet.',
              ),
              row('Account to top up:', addressComponent(address)),
              button({ value: 'Send it', name: 'send-it' }),
            ]),
          },
        });

        await patchState({ sendETHInterfaceId, sendETHAddress: address });

        return snap.request({
          method: 'snap_dialog',
          params: {
            type: 'alert',
            id: sendETHInterfaceId,
          },
        });
      } catch (error) {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        throw new Error(`Error sending ETH: ${(error as any)?.message}`);
      }
    }
    default:
      throw new Error('Method not found.');
  }
};

import type { Json } from '@metamask/snaps-sdk';
import { ManageStateOperation } from '@metamask/snaps-sdk';

/**
 * Get the current state.
 * @returns The current state.
 */
export async function getCurrentState() {
  const state = await snap.request({
    method: 'snap_manageState',
    params: { operation: ManageStateOperation.GetState },
  });

  return state ?? {};
}

/**
 * Patch the current state.
 * @param state - The new state to be patched.
 */
export async function patchState(state: Record<string, Json>) {
  const currentState = await getCurrentState();

  const newState = { ...currentState, ...state };

  await snap.request({
    method: 'snap_manageState',
    params: { operation: ManageStateOperation.UpdateState, newState },
  });
}

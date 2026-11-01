import { studiosText } from '../protocol.mjs'

/**
 * Studio discovery. This is not a Studio tool; it is answered by the host on the control
 * channel, so it needs no `studio_id` and works even when nothing is connected.
 */
export const listStudios = {
  name: 'list_roblox_studios',
  title: 'List Roblox Studios',
  description:
    'Lists every Roblox Studio instance this machine has open, with its id and name. Call it first, then pass the chosen id as `studio_id` on every other tool.',
  inputSchema: { type: 'object', properties: {}, required: [] },
  async handler({ bridge }) {
    const { studios, error } = await bridge.listStudios()
    if (error) return { text: error.message, isError: true }
    return { text: studiosText(studios) }
  },
}

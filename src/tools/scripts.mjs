import { requireStringArray, requireStudioId } from '../args.mjs'
import { resultText } from '../protocol.mjs'

/**
 * Reads many scripts in one MCP round-trip.
 *
 * The unit tool (`script_read`) has to be called once per script; this one keeps the
 * caller from paying that per file. Faults stay per path so one bad path does not blank
 * the whole response.
 */
export const scriptReadMany = {
  name: 'script_read_many',
  title: 'Read Many Scripts',
  description:
    'Reads several scripts at once and returns each one under its path. A path that cannot be read reports its own error and the rest still return.',
  inputSchema: {
    type: 'object',
    properties: {
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Full dot paths, e.g. game.ServerScriptService.Main.',
      },
      studio_id: { type: 'string', description: 'From list_roblox_studios.' },
    },
    required: ['paths', 'studio_id'],
  },
  async handler({ bridge }, args) {
    const paths = requireStringArray(args.paths, 'paths')
    const studioId = requireStudioId(args)

    const blocks = []
    for (const path of paths) {
      const { result, error } = await bridge.callTool('script_read', { target_file: path, studio_id: studioId })
      if (error) blocks.push(`### ${path}\nERROR: ${error.message}`)
      else if (result?.isError) blocks.push(`### ${path}\nERROR: ${resultText(result)}`)
      else blocks.push(`### ${path}\n${resultText(result)}`)
    }
    return { text: blocks.join('\n\n') }
  },
}

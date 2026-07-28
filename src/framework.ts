/**
 * This app's binding to the DocType engine: the shared client from
 * `@hanzo/ui/framework` over the bearer transport, pointed at this host's brand
 * API. That is the entire data layer — there is no per-collection code here,
 * because there is no per-collection code anywhere.
 */
import { createFrameworkClient, fetchTransport, type FrameworkClient } from '@hanzo/ui/framework'

import { currentConfig } from './config'
import { accessToken } from './session'

let client: FrameworkClient | null = null

export function frameworkClient(): FrameworkClient {
  if (!client) {
    client = createFrameworkClient(
      fetchTransport({ baseUrl: currentConfig().frameworkUrl, token: accessToken }),
    )
  }
  return client
}

'use client'

/**
 * The PKCE landing. IAM redirects here with `code` + `state`; the SDK completes
 * the exchange in the browser (public client, no secret) and stores the token.
 * Then back to wherever the user was.
 */
import { useEffect, useState } from 'react'
import { Text, YStack } from '@hanzo/gui'

import { iam, takeReturnTo } from '../../../src/session'

export default function Callback() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let done = false
    void (async () => {
      try {
        await iam().handleCallback(window.location.href)
        if (!done) window.location.replace(takeReturnTo())
      } catch (e) {
        if (!done) setError(e instanceof Error ? e.message : 'Sign-in could not be completed.')
      }
    })()
    return () => {
      done = true
    }
  }, [])

  return (
    <YStack flex={1} minH="100vh" items="center" justify="center" gap="$2" p="$4">
      <Text fontSize="$4" fontWeight="700">
        {error ? 'Sign-in failed' : 'Signing you in…'}
      </Text>
      {error ? (
        <Text fontSize="$2" color="$red11">
          {error}
        </Text>
      ) : null}
    </YStack>
  )
}

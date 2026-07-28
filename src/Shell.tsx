'use client'

/**
 * The chrome. `AppHeader` and the brand mark come from `@hanzo/ui/product`, so
 * these four properties sit at the same 52px bar, with the same launcher and the
 * same identity menu, as the console and every other Hanzo surface — white-label
 * follows automatically because the wordmark is the resolved brand's name.
 *
 * The only thing this adds is the product name beside the mark, which is how a
 * visitor knows whether they are in ERP or the Help Center when everything else
 * about the shell is deliberately identical.
 */
import type { ReactNode } from 'react'
import { Button, ScrollView, Text, XStack, YStack } from '@hanzo/gui'
import { AppHeader } from '@hanzo/ui/product'
import type { BrandId } from '@hanzo/brand/registry'

import { BrandLockup } from './BrandLockup'
import { useSession } from './session'

export function Shell({
  brand,
  brandName,
  productLabel,
  onHome,
  children,
}: {
  brand: BrandId
  brandName: string
  productLabel: string
  onHome: () => void
  children: ReactNode
}) {
  const { status, user, signIn, signOut } = useSession()

  return (
    <YStack flex={1} minH="100vh" bg="$background">
      <AppHeader
        brand={<BrandLockup brand={brand} name={brandName} />}
        onBrand={onHome}
        user={user?.name}
        onSignOut={status === 'authenticated' ? signOut : undefined}
        // Product name, not a nav: the module is fixed by the host, so there is
        // nothing here to navigate BETWEEN.
        org={
          <XStack items="center" gap="$2" pl="$2" minW={0}>
            <Text fontSize="$2" color="$color10">
              /
            </Text>
            <Text fontSize="$3" fontWeight="700" numberOfLines={1}>
              {productLabel}
            </Text>
          </XStack>
        }
      >
        {status === 'anonymous' ? (
          <XStack flex={1} justify="flex-end">
            <Button size="$2" onPress={signIn}>
              Sign in
            </Button>
          </XStack>
        ) : null}
      </AppHeader>

      <ScrollView flex={1} contentContainerStyle={{ p: '$4', pb: '$10' }}>
        <YStack width="100%" maxW={1200} self="center" gap="$3">
          {children}
        </YStack>
      </ScrollView>
    </YStack>
  )
}

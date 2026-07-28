'use client'

/**
 * The whole application.
 *
 * A path is read as `[] | [doctype] | [doctype, name]` and rendered by the three
 * generic components from `@hanzo/ui/framework`. There is no per-module branch in
 * this file and there must never be one: the module is a value, the collections
 * come from the engine's registry, and the fields come from each DocType. That is
 * the entire reason four products can be one app.
 */
import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Text, YStack } from '@hanzo/gui'
import { CollectionsBrowser, DocTypeDetail, DocTypeRecords, Loading } from '@hanzo/ui/framework'
import { EmptyState, PageHeader, PrimaryButton } from '@hanzo/ui/product'
import { Boxes, LogIn } from '@hanzogui/lucide-icons-2'
import type { BrandId } from '@hanzo/brand/registry'

import { SITE_IDS, SITES, type Site } from './sites'
import { frameworkClient } from './framework'
import { useSession } from './session'
import { Shell } from './Shell'

/** `/erp-item/erp-so-00001` → `['erp-item','erp-so-00001']`. */
export function segments(path: string[] | undefined): { doctype?: string; name?: string } {
  const parts = (path ?? []).filter(Boolean).map(decodeURIComponent)
  return { doctype: parts[0], name: parts[1] }
}

export function Site({ site, brand, brandName, path }: { site: Site; brand: BrandId; brandName: string; path?: string[] }) {
  const router = useRouter()
  const { status, signIn } = useSession()
  const { doctype, name } = segments(path)
  const client = frameworkClient()

  const openCollection = useCallback((dt: string) => router.push(`/${encodeURIComponent(dt)}`), [router])
  const openRecord = useCallback(
    (dt: string, n: string) => router.push(`/${encodeURIComponent(dt)}/${encodeURIComponent(n)}`),
    [router],
  )

  const body = () => {
    // Every framework read needs a validated principal, so an anonymous visitor
    // gets the sign-in door, not an error card pretending the backend is down.
    if (status === 'loading') return <Loading label={`Loading ${site.label}…`} />
    if (status === 'anonymous') {
      return (
        <>
          <PageHeader title={site.label} subtitle={site.tagline} />
          <EmptyState
            icon={LogIn}
            title={`Sign in to ${brandName} ${site.label}`}
            description={site.setup.description}
            bullets={site.setup.bullets}
            primary={{ label: 'Sign in', onPress: signIn }}
          />
        </>
      )
    }

    if (doctype && name) {
      return (
        <DocTypeDetail
          client={client}
          doctype={doctype}
          name={name}
          onBack={() => openCollection(doctype)}
          onView={(n) => openRecord(doctype, n)}
        />
      )
    }

    if (doctype) {
      return (
        <DocTypeRecords
          client={client}
          doctype={doctype}
          title={doctype}
          onOpen={(n) => openRecord(doctype, n)}
          onCreate={() => openRecord(doctype, 'new')}
        />
      )
    }

    return (
      <CollectionsBrowser
        client={client}
        module={site.module}
        label={site.label}
        subtitle={site.tagline}
        onOpen={openCollection}
        setupDescription={site.setup.description}
        setupBullets={site.setup.bullets}
      />
    )
  }

  return (
    <Shell
      brand={brand}
      brandName={brandName}
      productLabel={site.label}
      crumb={doctype}
      onCrumb={() => (doctype ? openCollection(doctype) : undefined)}
      onHome={() => router.push('/')}
    >
      {body()}
    </Shell>
  )
}

/**
 * A host that names no site. Rather than defaulting to one of the four (which
 * would silently serve the wrong product), say what the four are.
 */
export function SiteChooser({ brand, brandName }: { brand: BrandId; brandName: string }) {
  return (
    <Shell brand={brand} brandName={brandName} productLabel="Apps" onHome={() => {}}>
      <PageHeader title={`${brandName} apps`} subtitle="Each app is this same shell with its module fixed by the hostname." />
      <YStack gap="$2">
        {SITE_IDS.map((id) => (
          <YStack key={id} borderWidth={1} borderColor="$borderColor" rounded="$4" p="$4" gap="$1">
            <Text fontSize="$4" fontWeight="700">
              {SITES[id].label}
            </Text>
            <Text fontSize="$2" color="$color10">
              {SITES[id].tagline}
            </Text>
            <Text fontSize="$1" color="$color9" className="hz-mono">
              {id}.&lt;brand&gt; · module {SITES[id].module}
            </Text>
          </YStack>
        ))}
      </YStack>
      <PrimaryButton size="$2" icon={<Boxes size={15} />} onPress={() => {}} disabled>
        Open one by visiting its host
      </PrimaryButton>
    </Shell>
  )
}

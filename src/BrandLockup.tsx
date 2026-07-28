'use client'

/**
 * The brand lockup: the RESOLVED brand's own mark plus its name.
 *
 * White-label is not a wordmark swap — `erp.lux.network` must show the Lux mark,
 * not Hanzo's H with different text. `@hanzo/brand` already owns every brand's
 * mark geometry, so this renders THAT rather than a mark from one brand's logo
 * package, and the four hosts brand themselves correctly on any domain.
 *
 * The mark inherits `currentColor`, and a Tamagui View sets no text color — so
 * the colour is stated explicitly here. Without it the mark renders black on a
 * black header and simply disappears.
 */
import { Text, XStack, useTheme } from '@hanzo/gui'
import { renderMarkSVG, type BrandId } from '@hanzo/brand/registry'

export function BrandLockup({ brand, name, size = 18 }: { brand: BrandId; name: string; size?: number }) {
  const theme = useTheme()
  const color = theme.color12?.get() ?? '#ffffff'
  return (
    <XStack items="center" gap="$2" minW={0}>
      <span
        style={{ display: 'inline-flex', width: size, height: size }}
        // The registry returns a complete, self-contained <svg> for the brand.
        dangerouslySetInnerHTML={{ __html: renderMarkSVG(brand, { size, color, title: name }) }}
      />
      <Text fontSize="$3" fontWeight="800" numberOfLines={1}>
        {name}
      </Text>
    </XStack>
  )
}

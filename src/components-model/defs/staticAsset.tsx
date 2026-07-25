/**
 * `staticAsset` — host for the sanitized imported brand art (PLAN.md §5.2,
 * §11 Phase 2 step 2). The markup comes from src/assets/brand/generated/,
 * produced by `npm run assets` from the untouched exports in assets/protora/.
 *
 * Fidelity first: an asset renders exactly as delivered, baked-in colors and
 * all. Setting `inkRole` flattens it to one brand role, which is what the
 * contract describes for the single-ink pieces (wordmarks, craft silhouettes).
 *
 * ONLY fixed marks belong here (docs/NORTH_STAR.md) — the radar scenes are
 * generated composites, not imports. Since the art is opaque markup, the only
 * motion available to it is a whole-asset reveal.
 */
import type { ColorRole, StaticAssetProps } from "@/components-model/types";
import { defineComponent, type RenderProps } from "@/components-model/registry";
import { baseNode, COLOR_ROLE_OPTIONS } from "@/components-model/defaults";
import { BRAND_ASSETS, brandAsset, assetPlacementSize } from "@/assets/brand/assets";
import { behaviorOf, cycle, timing } from "@/lib/anim";

const DEFAULT_ASSET = BRAND_ASSETS[0]?.id ?? "protoraWordmark";
const ASSET_BEHAVIORS = ["fadeIn", "blink"] as const;

function factory() {
  const asset = brandAsset(DEFAULT_ASSET);
  return baseNode(
    "staticAsset",
    asset?.label ?? "Static Asset",
    // `inkRole` is declared even though it's undefined by default: a factory is
    // the list of props a kind supports, and `npm run conform` reads it as such
    // when it checks that every control drives something real.
    { assetId: DEFAULT_ASSET, inkRole: undefined } satisfies StaticAssetProps,
    { layout: asset ? assetPlacementSize(asset) : { w: 220, h: 120 } },
  );
}

/**
 * Single-ink flattening is a string rewrite over the sanitized markup rather
 * than a DOM walk — the markup is injected as-is (see Render), and the result
 * is memoized because the big lockups run to a few hundred KB and this would
 * otherwise re-run on every drag frame.
 */
const inkCache = new Map<string, string>();

function flattenInk(markup: string, cacheKey: string, hex: string): string {
  const cached = inkCache.get(cacheKey);
  if (cached) return cached;
  const flattened = markup
    .replace(/(fill|stroke)="#[0-9A-Fa-f]{3,8}"/g, `$1="${hex}"`)
    .replace(/(fill|stroke):\s*#[0-9A-Fa-f]{3,8}/g, `$1:${hex}`);
  inkCache.set(cacheKey, flattened);
  return flattened;
}

function Render({ node, animate, color }: RenderProps<"staticAsset">) {
  const { assetId, inkRole } = node.props;
  const asset = brandAsset(assetId);
  const behavior = animate ? behaviorOf(node.animation.behavior, ASSET_BEHAVIORS) : null;

  if (!asset) {
    const { w, h } = node.layout;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
        <rect x={1.5} y={1.5} width={w - 3} height={h - 3} rx={4} fill="none" stroke={color("ink")} strokeWidth={1.5} strokeDasharray="6 4" />
        <text x={w / 2} y={h / 2} textAnchor="middle" dominantBaseline="middle" fontFamily="'IBM Plex Mono', ui-monospace, monospace" fontSize={12} fill={color("ink")}>
          MISSING ASSET: {assetId}
        </text>
      </svg>
    );
  }

  const ink = inkRole ? color(inkRole) : null;
  const markup = ink ? flattenInk(asset.markup, `${asset.id}:${ink}`, ink) : asset.markup;

  // The reveal has to be a sibling of the injected markup, so it animates the
  // wrapping <g> rather than fighting dangerouslySetInnerHTML for children.
  return (
    <svg viewBox={`0 0 ${asset.viewBox.w} ${asset.viewBox.h}`} width="100%" height="100%">
      {behavior === "fadeIn" && <animate attributeName="opacity" {...timing(node.animation, "0", "1")} />}
      {behavior === "blink" && <animate attributeName="opacity" values="1;0.25;1" {...cycle(node.animation)} />}
      <g dangerouslySetInnerHTML={{ __html: markup }} />
    </svg>
  );
}

const INK_OPTIONS: { value: ColorRole | ""; label: string }[] = [
  { value: "", label: "Original colors" },
  ...COLOR_ROLE_OPTIONS,
];

defineComponent({
  kind: "staticAsset",
  label: "Brand Asset",
  category: "logos",
  tags: ["logo", "craft"],
  describe: "Sanitized imported brand art — wordmarks, lockups, HUD scenes and craft from the Protora kit.",
  factory,
  Render,
  controls: [
    {
      kind: "select",
      key: "assetId",
      label: "Asset",
      options: BRAND_ASSETS.map((a) => ({ value: a.id, label: a.label })),
    },
    {
      kind: "select",
      key: "inkRole",
      label: "Ink",
      options: INK_OPTIONS,
      hint: "Flatten the whole asset to one brand color, or keep its delivered palette.",
    },
  ],
  animBehaviors: [...ASSET_BEHAVIORS],
  // Imported art keeps the ratio it was drawn at — and it varies per asset, so
  // switching `assetId` re-locks the box to the new one.
  aspectOf: (node) => {
    const asset = brandAsset(node.props.assetId);
    return asset ? asset.viewBox.w / asset.viewBox.h : null;
  },
  acceptsChildren: false,
});

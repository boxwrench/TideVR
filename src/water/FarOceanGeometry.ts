import * as THREE from 'three'

export const DEFAULT_FAR_OCEAN_SIZE = 900

interface GridBounds {
  readonly minX: number
  readonly maxX: number
  readonly minY: number
  readonly maxY: number
}

function appendGrid(
  bounds: GridBounds,
  positions: number[],
  indices: number[],
  targetVertexSpacing: number,
): void {
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const segmentsX = Math.max(
    1,
    Math.ceil(width / targetVertexSpacing),
  )
  const segmentsY = Math.max(
    1,
    Math.ceil(height / targetVertexSpacing),
  )
  const firstVertex = positions.length / 3

  for (let y = 0; y <= segmentsY; y += 1) {
    const yPosition =
      bounds.minY + (height * y) / segmentsY

    for (let x = 0; x <= segmentsX; x += 1) {
      positions.push(
        bounds.minX + (width * x) / segmentsX,
        yPosition,
        0,
      )
    }
  }

  const rowLength = segmentsX + 1
  for (let y = 0; y < segmentsY; y += 1) {
    for (let x = 0; x < segmentsX; x += 1) {
      const lowerLeft = firstVertex + y * rowLength + x
      const lowerRight = lowerLeft + 1
      const upperLeft = lowerLeft + rowLength
      const upperRight = upperLeft + 1

      indices.push(
        lowerLeft,
        lowerRight,
        upperLeft,
        lowerRight,
        upperRight,
        upperLeft,
      )
    }
  }
}

/**
 * Builds one draw-call square skirt around the simulated near-water patch.
 *
 * Geometry is authored in the same XY plane as PlaneGeometry and is rotated
 * into XZ by OceanSurface. The central square remains empty so the far layer
 * cannot consume fill rate underneath the detailed near water.
 */
export function createFarOceanGeometry(
  nearWorldSize: number,
  farWorldSize = DEFAULT_FAR_OCEAN_SIZE,
  targetVertexSpacing = 6,
): THREE.BufferGeometry {
  if (
    !Number.isFinite(nearWorldSize) ||
    !Number.isFinite(farWorldSize) ||
    !Number.isFinite(targetVertexSpacing) ||
    nearWorldSize <= 0 ||
    farWorldSize <= nearWorldSize ||
    targetVertexSpacing <= 0
  ) {
    throw new Error(
      'Far ocean dimensions and vertex spacing must be positive; the far ocean must be larger than the near ocean.',
    )
  }

  const inner = nearWorldSize * 0.5
  const outer = farWorldSize * 0.5
  const positions: number[] = []
  const indices: number[] = []

  // The long north/south strips include the outer corners. East/west only
  // bridge the central span, avoiding overlapping triangles.
  appendGrid(
    { minX: -outer, maxX: outer, minY: -outer, maxY: -inner },
    positions,
    indices,
    targetVertexSpacing,
  )
  appendGrid(
    { minX: -outer, maxX: outer, minY: inner, maxY: outer },
    positions,
    indices,
    targetVertexSpacing,
  )
  appendGrid(
    { minX: -outer, maxX: -inner, minY: -inner, maxY: inner },
    positions,
    indices,
    targetVertexSpacing,
  )
  appendGrid(
    { minX: inner, maxX: outer, minY: -inner, maxY: inner },
    positions,
    indices,
    targetVertexSpacing,
  )

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setIndex(indices)
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

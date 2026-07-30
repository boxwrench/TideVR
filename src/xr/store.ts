import { createXRStore } from '@react-three/xr'
import {
  selectQuestFrameRate,
  shouldEnableXrEmulator,
} from './sessionPolicy'

export const xrStore = createXRStore({
  offerSession: false,
  emulate: shouldEnableXrEmulator(
    import.meta.env.DEV,
    window.location.search,
  ),
  foveation: 0.5,
  frameRate: selectQuestFrameRate,
  layers: true,
  domOverlay: false,
  handTracking: false,
  anchors: false,
  hitTest: false,
  meshDetection: false,
  planeDetection: false,
  bodyTracking: false,
})

import type { SceneState } from "./scene.ts";
import type { ShellIntent } from "./shell.ts";
import type { Transition } from "./transition.ts";

/**
 * Three concepts kept separate: stable scene state, how we arrived, host-shell configuration.
 *
 * A frame with no `transition` IS a reconstruction — cold start, process death, deep link.
 * That is stop condition G-5 answered by the shape rather than by discipline.
 *
 * Renderer extension happens by COMPOSITION, never an untyped `extensions` bag:
 *   interface NativeExperienceFrame { frame: ExperienceFrame; haptics?: ...; }
 */
export interface ExperienceFrame {
  scene: SceneState;
  shell?: ShellIntent;
  transition?: Transition;
}
